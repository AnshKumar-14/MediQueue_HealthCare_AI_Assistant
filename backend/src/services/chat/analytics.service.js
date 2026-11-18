/**
 * Chatbot analytics. Everything here is metadata only: message bodies stay
 * encrypted and are never read by this service.
 */

const ChatConversation = require("../../models/ChatConversation");
const ChatMessage = require("../../models/ChatMessage");

function daysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

async function getAnalytics({ days = 30 } = {}) {
  const rangeDays = Math.min(Math.max(Number(days) || 30, 1), 180);
  const since = daysAgo(rangeDays);

  const conversationFilter = { createdAt: { $gte: since } };
  const messageFilter = { createdAt: { $gte: since } };

  const [
    conversationCount,
    messageCount,
    userMessageCount,
    statusCounts,
    resolutionCounts,
    feedback,
    channelGroups,
    localeGroups,
    intentGroups,
    faqGroups,
    fallbackCount,
    handoffCount,
    trend,
    recent,
  ] = await Promise.all([
    ChatConversation.countDocuments(conversationFilter),
    ChatMessage.countDocuments(messageFilter),
    ChatMessage.countDocuments({ ...messageFilter, role: "user" }),
    ChatConversation.aggregate([
      { $match: conversationFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ChatConversation.aggregate([
      { $match: conversationFilter },
      { $group: { _id: "$resolution", count: { $sum: 1 } } },
    ]),
    ChatMessage.aggregate([
      {
        $match: {
          ...messageFilter,
          role: "assistant",
          feedback: { $in: ["up", "down"] },
        },
      },
      { $group: { _id: "$feedback", count: { $sum: 1 } } },
    ]),
    ChatConversation.aggregate([
      { $match: conversationFilter },
      { $group: { _id: "$channel", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ChatConversation.aggregate([
      { $match: conversationFilter },
      { $group: { _id: "$locale", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ChatMessage.aggregate([
      {
        $match: {
          ...messageFilter,
          role: "assistant",
          intent: { $nin: ["", "llm", "fallback", "greeting", "thanks", "bye"] },
        },
      },
      { $group: { _id: "$intent", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    ChatMessage.aggregate([
      {
        $match: {
          ...messageFilter,
          role: "assistant",
          faqKey: { $nin: ["", null] },
        },
      },
      { $group: { _id: "$faqKey", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    ChatMessage.countDocuments({
      ...messageFilter,
      role: "assistant",
      intent: "fallback",
    }),
    ChatConversation.countDocuments({
      ...conversationFilter,
      resolution: "escalated",
    }),
    ChatConversation.aggregate([
      { $match: conversationFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          conversations: { $sum: 1 },
          handoffs: {
            $sum: {
              $cond: [{ $eq: ["$resolution", "escalated"] }, 1, 0],
            },
          },
          messages: { $sum: "$messageCount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ChatConversation.find(conversationFilter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(12)
      .populate("user", "name email role")
      .select(
        "user channel locale status resolution lastIntent messageCount lastMessageAt createdAt tags handoff"
      )
      .lean(),
  ]);

  const toMap = (groups, key = "_id") =>
    Object.fromEntries(groups.map((group) => [String(group[key] || "unknown"), group.count]));

  const statuses = toMap(statusCounts);
  const resolutions = toMap(resolutionCounts);
  const feedbackMap = toMap(feedback);
  const positive = feedbackMap.up || 0;
  const negative = feedbackMap.down || 0;
  const rated = positive + negative;

  const handoffRequested = statuses["handoff-requested"] || 0;
  const handoffActive = statuses["handoff-active"] || 0;
  const escalated = resolutions.escalated || handoffCount;
  const resolved = resolutions.resolved || 0;
  const dropped = resolutions.dropped || 0;

  const open = await ChatConversation.countDocuments({
    ...conversationFilter,
    resolution: "open",
    messageCount: { $gt: 0 },
  });

  const dropOff = await ChatConversation.aggregate([
    {
      $match: {
        ...conversationFilter,
        messageCount: { $gt: 0 },
        $or: [{ resolution: "open" }, { resolution: "dropped" }],
      },
    },
    { $group: { _id: "$lastIntent", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  return {
    rangeDays,
    since,
    overview: {
      conversations: conversationCount,
      messages: messageCount,
      userMessages: userMessageCount,
      avgMessages: conversationCount
        ? Math.round((messageCount / conversationCount) * 10) / 10
        : 0,
      resolved,
      escalated,
      dropped,
      open,
      handoffRequested,
      handoffActive,
      handoffRate: conversationCount
        ? Math.round((escalated / conversationCount) * 1000) / 10
        : 0,
      fallbackCount,
      fallbackRate: messageCount
        ? Math.round((fallbackCount / messageCount) * 1000) / 10
        : 0,
      positiveFeedback: positive,
      negativeFeedback: negative,
      satisfaction: rated ? Math.round((positive / rated) * 1000) / 10 : null,
    },
    channels: channelGroups.map((group) => ({
      channel: group._id || "web",
      count: group.count,
    })),
    languages: localeGroups.map((group) => ({
      locale: group._id || "en",
      count: group.count,
    })),
    intents: intentGroups.map((group) => ({
      intent: group._id || "unknown",
      count: group.count,
    })),
    commonQuestions: faqGroups.map((group) => ({
      faqKey: group._id,
      count: group.count,
    })),
    unresolved: {
      fallbacks: fallbackCount,
      handoffs: escalated,
      negativeFeedback: negative,
      openConversations: open,
    },
    dropOff: dropOff.map((group) => ({
      lastIntent: group._id || "unknown",
      count: group.count,
    })),
    trend: trend.map((item) => ({
      date: item._id,
      conversations: item.conversations,
      handoffs: item.handoffs,
      messages: item.messages,
    })),
    recent,
  };
}

module.exports = { getAnalytics };
