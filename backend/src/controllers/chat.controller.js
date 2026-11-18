const crypto = require("crypto");

const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const IntakeSummary = require("../models/IntakeSummary");
const Reminder = require("../models/Reminder");
const User = require("../models/User");
const { encrypt, decrypt } = require("../utils/crypto");
const { t, normalizeLocale, SUPPORTED_LOCALES, LANGUAGE_NAMES } = require("../services/chat/i18n");
const engine = require("../services/chat/engine");
const tools = require("../services/chat/tools.service");
const { getAnalytics } = require("../services/chat/analytics.service");

const VISITOR_COOKIE = "mediqueue_chat_visitor";
const MESSAGE_LIMIT_PER_HOUR = Math.max(
  Number(process.env.CHAT_MESSAGES_PER_HOUR) || 60,
  5
);
const MAX_MESSAGE_LENGTH = 1500;
const STAFF_ROLES = ["receptionist", "staff", "admin"];
const HANDOFF_ROLES = ["receptionist", "staff", "admin"];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function ensureVisitorId(req, res) {
  let visitorId = req.cookies?.[VISITOR_COOKIE];
  if (!visitorId || typeof visitorId !== "string" || visitorId.length < 12) {
    visitorId = crypto.randomUUID();
    res.cookie?.(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }
  return visitorId;
}

async function loadSessionUser(req) {
  if (!req.user?.id) return null;
  const doc = await User.findById(req.user.id)
    .select(
      "name email phone role patientProfile chatPreferences lastChatAt consentAccepted"
    )
    .lean();
  if (!doc) return null;
  return { ...doc, id: String(doc._id) };
}

function initialSuggestions(locale) {
  return [
    t(locale, "sugBook"),
    t(locale, "sugQueue"),
    t(locale, "sugFaq"),
    t(locale, "sugHandoff"),
  ];
}

function messageToDto(message) {
  if (!message) return null;
  return {
    _id: String(message._id),
    role: message.role,
    content: decrypt(message.content),
    intent: message.intent || "",
    faqKey: message.faqKey || "",
    suggestions: message.suggestions || [],
    feedback: message.feedback || "",
    author: message.author || null,
    createdAt: message.createdAt,
  };
}

function conversationToDto(conversation, user) {
  const locale = normalizeLocale(conversation.locale);
  return {
    id: String(conversation._id),
    channel: conversation.channel,
    locale,
    language: LANGUAGE_NAMES[locale],
    status: conversation.status,
    resolution: conversation.resolution,
    consent: conversation.consent || { given: false },
    handoff: conversation.handoff || {},
    tags: conversation.tags || [],
    messageCount: conversation.messageCount || 0,
    lastIntent: conversation.lastIntent || "",
    lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
    createdAt: conversation.createdAt,
    signedIn: Boolean(user),
    user: user
      ? { name: user.name, role: user.role, email: user.email }
      : null,
    consentPrompt: t(locale, "consentAsk"),
    disclaimer: t(locale, "disclaimer"),
  };
}

async function loadMessages(conversationId, limit = 40) {
  const docs = await ChatMessage.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("+content")
    .lean();
  return docs.reverse();
}

function historyFrom(messages) {
  return messages
    .filter((message) => ["user", "assistant", "staff"].includes(message.role))
    .slice(-10)
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: decrypt(message.content),
    }));
}

async function createAssistantMessage({
  conversation,
  content,
  intent = "",
  faqKey = "",
  suggestions = [],
  role = "assistant",
  author = null,
}) {
  const doc = await ChatMessage.create({
    conversation: conversation._id,
    role,
    content: encrypt(content),
    intent,
    faqKey,
    suggestions,
    author,
    expiresAt: tools.retentionDate(),
  });
  return doc;
}

async function ensureConversationAccess(req, response, { staff = false } = {}) {
  const { id } = req.params;
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
    throw httpError(400, "A valid conversation id is required");
  }

  const conversation = await ChatConversation.findById(id);
  if (!conversation) throw httpError(404, "Conversation not found");

  const user = await loadSessionUser(req);
  const visitorId = ensureVisitorId(req, response);
  const isStaff = Boolean(user && STAFF_ROLES.includes(user.role));

  if (staff && !isStaff) {
    throw httpError(403, "Access denied");
  }

  let allowed = staff && isStaff;
  if (!allowed && conversation.user) {
    allowed = Boolean(user && String(conversation.user) === String(user.id));
  }
  if (!allowed && !conversation.user && conversation.externalId) {
    allowed = conversation.externalId === visitorId;
  }
  if (!allowed) {
    throw httpError(403, "You do not have access to this conversation");
  }

  // A guest conversation can be claimed after the patient signs in.
  if (
    !conversation.user &&
    user &&
    conversation.externalId === visitorId &&
    user.role === "patient"
  ) {
    conversation.user = user._id;
    await conversation.save();
  }

  return { conversation, user, isStaff, visitorId };
}

async function findOrCreateSession({ req, res: response, user, conversationId }) {
  const visitorId = ensureVisitorId(req, response);
  let conversation = null;

  if (conversationId && /^[a-f0-9]{24}$/i.test(conversationId)) {
    conversation = await ChatConversation.findById(conversationId);
    if (conversation) {
      const ownedByUser = conversation.user
        ? user && String(conversation.user) === String(user.id)
        : conversation.externalId === visitorId;
      if (!ownedByUser) {
        throw httpError(403, "You do not have access to this conversation");
      }
      if (!conversation.user && user?.role === "patient") {
        conversation.user = user._id;
        await conversation.save();
      }
      return conversation;
    }
  }

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const filter = user
    ? { user: user.id, createdAt: { $gte: since }, status: { $ne: "closed" } }
    : {
        externalId: visitorId,
        createdAt: { $gte: since },
        status: { $ne: "closed" },
      };

  conversation = await ChatConversation.findOne(filter)
    .sort({ lastMessageAt: -1, createdAt: -1 });

  if (conversation) return conversation;

  const locale = normalizeLocale(user?.chatPreferences?.language || "en");
  conversation = await ChatConversation.create({
    user: user?._id || undefined,
    externalId: visitorId,
    channel: "web",
    locale,
    status: "active",
    resolution: "open",
    consent: user?.consentAccepted
      ? { given: true, givenAt: new Date(), version: "2026-01" }
      : { given: false, version: "2026-01" },
    expiresAt: tools.retentionDate(),
    messageCount: 1,
    lastMessageAt: new Date(),
    lastIntent: "greeting",
  });

  const greetingKey = user?.name ? "greeting" : "greeting";
  const greeting = t(locale, greetingKey, {
    name: user?.name ? ` ${String(user.name).split(" ")[0]}` : "",
  });
  await createAssistantMessage({
    conversation,
    content: greeting,
    intent: "greeting",
    suggestions: initialSuggestions(locale),
  });

  await User.findByIdAndUpdate(user?.id, { lastChatAt: new Date() }).catch(() => {});
  return conversation;
}

async function enforceMessageRate(conversation, locale) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await ChatMessage.countDocuments({
    conversation: conversation._id,
    role: "user",
    createdAt: { $gte: since },
  });
  if (count >= MESSAGE_LIMIT_PER_HOUR) {
    const error = httpError(429, t(locale, "sessionRateLimited"));
    error.code = "CHAT_RATE_LIMITED";
    throw error;
  }
}

async function replyToConversation({ app, conversation, user, text, channel = "web" }) {
  const locale = normalizeLocale(conversation.locale || user?.chatPreferences?.language);
  const value = String(text || "").trim();

  if (!value) {
    return {
      reply: t(locale, "noInput"),
      suggestions: initialSuggestions(locale),
      intent: "empty",
      assistantMessage: null,
      userMessage: null,
    };
  }
  if (value.length > MAX_MESSAGE_LENGTH) {
    return {
      reply: t(locale, "tooLong"),
      suggestions: initialSuggestions(locale),
      intent: "too-long",
      assistantMessage: null,
      userMessage: null,
    };
  }

  await enforceMessageRate(conversation, locale);

  const previousMessages = await loadMessages(conversation._id, 20);
  const history = historyFrom(previousMessages);

  const userMessage = await ChatMessage.create({
    conversation: conversation._id,
    role: "user",
    content: encrypt(value),
    intent: "",
    expiresAt: tools.retentionDate(),
  });

  let result;
  try {
    result = await engine.respond({
      app,
      conversation,
      user,
      text: value,
      channel,
      history,
    });
  } catch (error) {
    console.error("Chat engine error:", error);
    result = {
      reply: `${t(locale, "errorGeneric")}\n\n${t(locale, "disclaimer")}`,
      suggestions: initialSuggestions(locale),
      intent: "error",
    };
  }

  if (!result?.reply) {
    result = {
      reply: t(locale, "fallback"),
      suggestions: initialSuggestions(locale),
      intent: "fallback",
    };
  }

  const assistantMessage = await createAssistantMessage({
    conversation,
    content: result.reply,
    intent: result.intent || "",
    faqKey: result.faqKey || "",
    suggestions: result.suggestions || [],
  });

  conversation.messageCount = (conversation.messageCount || 0) + 2;
  conversation.lastIntent = result.intent || conversation.lastIntent;
  conversation.lastMessageAt = new Date();
  conversation.locale = normalizeLocale(conversation.locale);

  if (result.intent === "handoff") {
    conversation.status = conversation.status === "active" ? "handoff-requested" : conversation.status;
    conversation.resolution = "escalated";
  }
  if (result.intent?.startsWith("triage")) {
    conversation.tags = Array.from(new Set([...(conversation.tags || []), "triage"]));
  }
  if (result.redFlags?.length) {
    conversation.tags = Array.from(
      new Set([...(conversation.tags || []), "red-flag"])
    );
  }

  // `state` is a Mixed field, so nested flow/step/draft mutations are invisible
  // to Mongoose's change tracking. Mark it explicitly or the next turn would
  // start from an empty state.
  conversation.markModified("state");
  await conversation.save();
  await User.findByIdAndUpdate(user?.id, { lastChatAt: new Date() }).catch(() => {});

  return {
    reply: result.reply,
    suggestions: result.suggestions || [],
    intent: result.intent || "",
    faqKey: result.faqKey || "",
    redFlags: result.redFlags || [],
    assistantMessage: messageToDto(assistantMessage),
    userMessage: messageToDto(userMessage),
  };
}

/* ------------------------------------------------------------------ */
/* Session + messaging                                                 */
/* ------------------------------------------------------------------ */

async function createSession(req, res) {
  try {
    const user = await loadSessionUser(req);
    const { conversationId } = req.body || {};
    const conversation = await findOrCreateSession({
      req,
      res,
      user,
      conversationId,
    });

    const messages = await loadMessages(conversation._id, 40);
    const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
    const locale = normalizeLocale(conversation.locale);

    return res.json({
      success: true,
      conversation: conversationToDto(conversation, user),
      messages: messages.map(messageToDto),
      suggestions:
        lastAssistant?.suggestions?.length
          ? lastAssistant.suggestions
          : initialSuggestions(locale),
      preferences: user?.chatPreferences || null,
      remindersEnabled: process.env.CHAT_REMINDERS_ENABLED !== "false",
      streaming: true,
      locales: SUPPORTED_LOCALES.map((code) => ({
        code,
        label: LANGUAGE_NAMES[code],
      })),
    });
  } catch (error) {
    console.error("Chat session error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to start chat",
    });
  }
}

async function getConversation(req, res) {
  try {
    const { conversation, user } = await ensureConversationAccess(req, res);
    const messages = await loadMessages(conversation._id, 80);
    const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
    return res.json({
      success: true,
      conversation: conversationToDto(conversation, user),
      messages: messages.map(messageToDto),
      suggestions: lastAssistant?.suggestions || initialSuggestions(conversation.locale),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function sendMessage(req, res) {
  try {
    const { conversation, user } = await ensureConversationAccess(req, res);
    const result = await replyToConversation({
      app: req.app,
      conversation,
      user,
      text: req.body?.text ?? req.body?.message,
      channel: conversation.channel,
    });

    return res.json({
      success: true,
      conversationId: String(conversation._id),
      reply: result.reply,
      suggestions: result.suggestions,
      intent: result.intent,
      faqKey: result.faqKey,
      redFlags: result.redFlags,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      conversation: conversationToDto(conversation, user),
    });
  } catch (error) {
    console.error("Chat message error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to send message",
      code: error.code,
    });
  }
}

function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamMessage(req, res) {
  try {
    const { conversation, user } = await ensureConversationAccess(req, res);

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    sseWrite(res, {
      type: "start",
      conversationId: String(conversation._id),
    });

    const result = await replyToConversation({
      app: req.app,
      conversation,
      user,
      text: req.body?.text ?? req.body?.message,
      channel: conversation.channel,
    });

    if (result.userMessage) {
      sseWrite(res, { type: "user", message: result.userMessage });
    }

    const reply = result.reply || "";
    const chunks = reply.match(/(\s+|\S+)/g) || [reply];
    let buffer = "";
    for (let index = 0; index < chunks.length; index += 1) {
      buffer += chunks[index];
      if (buffer.length >= 12 || index === chunks.length - 1) {
        sseWrite(res, { type: "chunk", delta: buffer });
        buffer = "";
        if (index % 8 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
      }
    }

    sseWrite(res, {
      type: "done",
      conversationId: String(conversation._id),
      reply,
      suggestions: result.suggestions,
      intent: result.intent,
      faqKey: result.faqKey,
      redFlags: result.redFlags,
      assistantMessage: result.assistantMessage,
      conversation: conversationToDto(conversation, user),
    });
    return res.end();
  } catch (error) {
    console.error("Chat stream error:", error);
    if (res.headersSent) {
      sseWrite(res, {
        type: "error",
        message: error.message || "Failed to send message",
        code: error.code,
      });
      return res.end();
    }
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to send message",
    });
  }
}

async function giveConsent(req, res) {
  try {
    const { conversation, user } = await ensureConversationAccess(req, res);
    conversation.consent = {
      given: true,
      givenAt: new Date(),
      version: req.body?.version || "2026-01",
    };
    await conversation.save();

    if (user?.role === "patient" && !user.consentAccepted) {
      await User.findByIdAndUpdate(user.id, { consentAccepted: true }).catch(() => {});
    }

    return res.json({
      success: true,
      conversation: conversationToDto(conversation, user),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function setConversationLanguage(req, res) {
  try {
    const { conversation, user } = await ensureConversationAccess(req, res);
    const locale = normalizeLocale(req.body?.locale);
    if (!SUPPORTED_LOCALES.includes(locale)) {
      return res.status(400).json({ success: false, message: "Unsupported language" });
    }

    conversation.locale = locale;
    await conversation.save();

    if (user?.role === "patient") {
      await tools.updatePreferences(user.id, { language: locale }).catch(() => {});
    }

    const reply = t(locale, "languageChanged", { language: LANGUAGE_NAMES[locale] });
    const assistantMessage = await createAssistantMessage({
      conversation,
      content: reply,
      intent: "language",
      suggestions: initialSuggestions(locale),
    });
    conversation.lastMessageAt = new Date();
    conversation.messageCount = (conversation.messageCount || 0) + 1;
    await conversation.save();

    return res.json({
      success: true,
      reply,
      assistantMessage: messageToDto(assistantMessage),
      conversation: conversationToDto(conversation, user),
      suggestions: initialSuggestions(locale),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function submitFeedback(req, res) {
  try {
    const { conversation } = await ensureConversationAccess(req, res);
    const { messageId, rating, comment = "" } = req.body || {};
    if (!["up", "down"].includes(rating)) {
      return res.status(400).json({ success: false, message: "Rating must be up or down" });
    }

    const message = await ChatMessage.findOne({
      _id: messageId,
      conversation: conversation._id,
      role: "assistant",
    });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    message.feedback = rating;
    message.feedbackComment = comment ? encrypt(String(comment).slice(0, 1000)) : "";
    await message.save();

    return res.json({
      success: true,
      message: t(conversation.locale, "feedbackThanks"),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function requestHandoff(req, res) {
  try {
    const { conversation, user } = await ensureConversationAccess(req, res);
    const locale = normalizeLocale(conversation.locale);

    if (["handoff-requested", "handoff-active"].includes(conversation.status)) {
      return res.json({
        success: true,
        reply: t(locale, "handoffAlready"),
        conversation: conversationToDto(conversation, user),
      });
    }

    conversation.status = "handoff-requested";
    conversation.resolution = "escalated";
    conversation.handoff = {
      ...(conversation.handoff || {}),
      requestedAt: new Date(),
      reason: String(req.body?.reason || "Patient requested a human team member").slice(0, 500),
      summary: `Last intent: ${conversation.lastIntent || "unknown"}`,
    };
    conversation.tags = Array.from(new Set([...(conversation.tags || []), "handoff"]));
    conversation.lastMessageAt = new Date();
    conversation.messageCount = (conversation.messageCount || 0) + 1;
    await conversation.save();

    const reply = t(locale, "handoffRequested");
    const assistantMessage = await createAssistantMessage({
      conversation,
      content: reply,
      intent: "handoff",
      suggestions: initialSuggestions(locale),
    });

    try {
      await tools.notifyStaff({
        title: "Chat handoff requested",
        message:
          "A patient asked to speak with a human. Open the chat handoffs panel to see the conversation context and reply.",
        type: "chat-handoff",
        meta: {
          conversationId: String(conversation._id),
          channel: conversation.channel,
          userId: user?.id ? String(user.id) : undefined,
        },
      });
    } catch (error) {
      console.error("Handoff notification failed:", error.message);
    }

    return res.json({
      success: true,
      reply,
      assistantMessage: messageToDto(assistantMessage),
      conversation: conversationToDto(conversation, user),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function closeConversation(req, res) {
  try {
    const { conversation } = await ensureConversationAccess(req, res);
    conversation.status = "closed";
    conversation.closedAt = new Date();
    if (conversation.resolution !== "escalated") {
      conversation.resolution = "resolved";
    }
    await conversation.save();
    return res.json({ success: true, conversation: conversationToDto(conversation) });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function deleteConversation(req, res) {
  try {
    const { conversation } = await ensureConversationAccess(req, res);
    await ChatMessage.deleteMany({ conversation: conversation._id });
    await ChatConversation.deleteOne({ _id: conversation._id });
    return res.json({
      success: true,
      message: "This conversation has been permanently deleted.",
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function listMyConversations(req, res) {
  try {
    const conversations = await ChatConversation.find({ user: req.user.id })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(20)
      .select("channel locale status resolution lastIntent messageCount lastMessageAt createdAt")
      .lean();
    return res.json({ success: true, conversations });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load conversations" });
  }
}

/* ------------------------------------------------------------------ */
/* Preferences + reminders                                             */
/* ------------------------------------------------------------------ */

async function getPreferences(req, res) {
  try {
    const preferences = await tools.getPreferences(req.user.id);
    return res.json({ success: true, preferences });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load preferences" });
  }
}

async function updatePreferences(req, res) {
  try {
    const preferences = await tools.updatePreferences(req.user.id, req.body || {});
    return res.json({
      success: true,
      preferences,
      message: t(preferences.language, "preferencesSaved"),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function listReminders(req, res) {
  try {
    const reminders = await Reminder.find({ user: req.user.id })
      .sort({ scheduledFor: 1 })
      .limit(50)
      .select("+message")
      .lean();
    return res.json({
      success: true,
      reminders: reminders.map((reminder) => ({
        ...reminder,
        message: decrypt(reminder.message),
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load reminders" });
  }
}

async function createReminder(req, res) {
  try {
    if (process.env.CHAT_REMINDERS_ENABLED === "false") {
      return res.status(503).json({ success: false, message: "Reminders are disabled" });
    }
    const { type = "medication", title, message, scheduledFor, channel } = req.body || {};
    if (!title || !message || !scheduledFor) {
      return res.status(400).json({
        success: false,
        message: "title, message and scheduledFor are required",
      });
    }
    const when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid scheduledFor date" });
    }
    if (when.getTime() < Date.now() - 60 * 1000) {
      return res.status(400).json({ success: false, message: "Reminder time must be in the future" });
    }
    if (!["medication", "follow-up", "appointment"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid reminder type" });
    }

    const user = await User.findById(req.user.id).select("chatPreferences").lean();
    const reminder = await tools.createReminder({
      userId: req.user.id,
      type,
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 1000),
      scheduledFor: when,
      channel:
        channel && ["in-app", "sms", "email", "whatsapp"].includes(channel)
          ? channel
          : user?.chatPreferences?.contactMethod || "in-app",
    });

    return res.status(201).json({
      success: true,
      reminder: {
        ...reminder.toObject(),
        message: decrypt(reminder.message),
      },
    });
  } catch (error) {
    console.error("Create reminder error:", error);
    return res.status(500).json({ success: false, message: "Failed to create reminder" });
  }
}

async function cancelReminder(req, res) {
  try {
    const reminder = await tools.cancelReminder(req.user.id, req.params.id);
    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }
    return res.json({ success: true, reminder });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to cancel reminder" });
  }
}

async function acknowledgeReminder(req, res) {
  try {
    const reminder = await tools.acknowledgeReminder(req.user.id, req.params.id);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found or already acknowledged",
      });
    }
    return res.json({
      success: true,
      reminder: {
        ...reminder.toObject(),
        message: decrypt(reminder.message),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to acknowledge reminder" });
  }
}

/* ------------------------------------------------------------------ */
/* Intake summaries                                                    */
/* ------------------------------------------------------------------ */

async function listIntakes(req, res) {
  try {
    const user = await loadSessionUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    let summaries = [];
    if (user.role === "doctor") {
      summaries = await tools.listIntakesForDoctor(user.id);
    } else if (["admin", "staff", "receptionist"].includes(user.role)) {
      summaries = await tools.listAllIntakes();
    } else if (user.role === "patient") {
      summaries = await IntakeSummary.find({ patient: user.id })
        .populate("doctor", "name specialty")
        .populate("appointment", "date startTime status")
        .populate("department", "name")
        .sort({ createdAt: -1 })
        .limit(20)
        .select("+reason +symptoms +duration +medications +allergies +staffNotes")
        .lean();
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.json({
      success: true,
      intakes: summaries.map((summary) => tools.serializeIntake(summary)),
    });
  } catch (error) {
    console.error("List intakes error:", error);
    return res.status(500).json({ success: false, message: "Failed to load intake summaries" });
  }
}

async function updateIntake(req, res) {
  try {
    const user = await loadSessionUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });

    const summary = await IntakeSummary.findById(req.params.id);
    if (!summary) return res.status(404).json({ success: false, message: "Intake summary not found" });

    const canEdit =
      user.role === "admin" ||
      user.role === "staff" ||
      user.role === "receptionist" ||
      (user.role === "doctor" && String(summary.doctor) === String(user.id));
    if (!canEdit) return res.status(403).json({ success: false, message: "Access denied" });

    const { status, staffNotes, suggestedPriority } = req.body || {};
    if (["pending", "confirmed", "seen"].includes(status)) {
      summary.status = status;
      summary.confirmedBy = user._id;
    }
    if (staffNotes !== undefined) {
      summary.staffNotes = encrypt(String(staffNotes).slice(0, 2000));
    }
    if (
      suggestedPriority &&
      ["normal", "senior", "pregnant", "emergency"].includes(suggestedPriority)
    ) {
      summary.suggestedPriority = suggestedPriority;
    }
    await summary.save();

    const populated = await IntakeSummary.findById(summary._id)
      .populate("patient", "name email phone")
      .populate("doctor", "name specialty")
      .populate("appointment", "date startTime status")
      .populate("department", "name")
      .select("+reason +symptoms +duration +medications +allergies +staffNotes")
      .lean();

    return res.json({
      success: true,
      intake: tools.serializeIntake(populated),
    });
  } catch (error) {
    console.error("Update intake error:", error);
    return res.status(500).json({ success: false, message: "Failed to update intake summary" });
  }
}

/* ------------------------------------------------------------------ */
/* Staff handoffs                                                      */
/* ------------------------------------------------------------------ */

async function listHandoffs(req, res) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ["handoff-requested", "handoff-active", "closed"].includes(status)) {
      filter.status = status;
    } else {
      filter.status = { $in: ["handoff-requested", "handoff-active"] };
    }

    const conversations = await ChatConversation.find(filter)
      .sort({ "handoff.requestedAt": 1, lastMessageAt: -1 })
      .limit(100)
      .populate("user", "name email phone role")
      .populate("handoff.assignedTo", "name role")
      .select(
        "user channel locale status resolution lastIntent messageCount lastMessageAt createdAt tags handoff"
      )
      .lean();

    return res.json({
      success: true,
      handoffs: conversations.map((conversation) => ({
        ...conversation,
        id: String(conversation._id),
      })),
    });
  } catch (error) {
    console.error("List handoffs error:", error);
    return res.status(500).json({ success: false, message: "Failed to load chat handoffs" });
  }
}

async function getHandoff(req, res) {
  try {
    const conversation = await ChatConversation.findById(req.params.id)
      .populate("user", "name email phone role patientProfile")
      .populate("handoff.assignedTo", "name role");
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const messages = await loadMessages(conversation._id, 100);

    if (["handoff-requested", "handoff-active"].includes(conversation.status)) {
      conversation.status = "handoff-active";
      conversation.handoff = {
        ...(conversation.handoff || {}),
        assignedTo: conversation.handoff?.assignedTo?._id || req.user.id,
      };
      await conversation.save();
    }

    return res.json({
      success: true,
      conversation: {
        ...conversationToDto(conversation, conversation.user),
        user: conversation.user,
        handoff: conversation.handoff,
      },
      messages: messages.map(messageToDto),
    });
  } catch (error) {
    console.error("Get handoff error:", error);
    return res.status(500).json({ success: false, message: "Failed to load conversation" });
  }
}

async function replyToHandoff(req, res) {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ success: false, message: "Reply text is required" });
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: "Reply is too long" });
    }

    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!["handoff-requested", "handoff-active"].includes(conversation.status)) {
      return res.status(400).json({
        success: false,
        message: "This conversation is not waiting for a staff reply",
      });
    }

    const message = await createAssistantMessage({
      conversation,
      content: text,
      intent: "staff-reply",
      suggestions: [],
      role: "staff",
      author: req.user.id,
    });

    conversation.status = "handoff-active";
    conversation.resolution = "open";
    conversation.handoff = {
      ...(conversation.handoff || {}),
      assignedTo: req.user.id,
      requestedAt: conversation.handoff?.requestedAt || new Date(),
    };
    conversation.messageCount = (conversation.messageCount || 0) + 1;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    if (conversation.user) {
      const { notifyUser } = require("../services/notification.service");
      await notifyUser(conversation.user, {
        type: "chat-reply",
        title: "MediQueue chat reply",
        message: text.slice(0, 500),
        meta: { conversationId: String(conversation._id) },
      });
    }

    return res.json({ success: true, message: messageToDto(message) });
  } catch (error) {
    console.error("Staff handoff reply error:", error);
    return res.status(500).json({ success: false, message: "Failed to send reply" });
  }
}

async function resolveHandoff(req, res) {
  try {
    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    conversation.status = "closed";
    conversation.resolution = "resolved";
    conversation.closedAt = new Date();
    conversation.handoff = {
      ...(conversation.handoff || {}),
      resolvedAt: new Date(),
      resolvedBy: req.user.id,
    };
    await conversation.save();

    const locale = normalizeLocale(conversation.locale);
    await createAssistantMessage({
      conversation,
      content: t(locale, "bye"),
      intent: "handoff-resolved",
    });

    return res.json({ success: true, conversation: conversationToDto(conversation) });
  } catch (error) {
    console.error("Resolve handoff error:", error);
    return res.status(500).json({ success: false, message: "Failed to resolve conversation" });
  }
}

/* ------------------------------------------------------------------ */
/* Analytics + channel webhook                                        */
/* ------------------------------------------------------------------ */

async function analytics(req, res) {
  try {
    const data = await getAnalytics({ days: req.query.days });
    return res.json({ success: true, analytics: data });
  } catch (error) {
    console.error("Chat analytics error:", error);
    return res.status(500).json({ success: false, message: "Failed to load chatbot analytics" });
  }
}

async function channelWebhook(req, res) {
  try {
    const secret = process.env.CHAT_WEBHOOK_SECRET;
    if (secret && req.get("x-chat-secret") !== secret) {
      return res.status(401).json({ success: false, message: "Invalid webhook secret" });
    }

    const channel = req.params.channel;
    if (!["whatsapp", "sms"].includes(channel)) {
      return res.status(400).json({ success: false, message: "Unsupported channel" });
    }

    const externalId = String(req.body?.from || req.body?.externalId || "").trim();
    const text = String(req.body?.text || req.body?.message || "").trim();
    if (!externalId || !text) {
      return res.status(400).json({ success: false, message: "from and text are required" });
    }

    let conversation = await ChatConversation.findOne({
      channel,
      externalId,
      status: { $ne: "closed" },
    }).sort({ lastMessageAt: -1 });

    if (!conversation) {
      conversation = await ChatConversation.create({
        externalId,
        channel,
        locale: normalizeLocale(req.body?.locale || "en"),
        status: "active",
        resolution: "open",
        expiresAt: tools.retentionDate(),
        messageCount: 0,
      });
    }

    const result = await replyToConversation({
      app: req.app,
      conversation,
      user: null,
      text,
      channel,
    });

    return res.json({
      success: true,
      conversationId: String(conversation._id),
      reply: result.reply,
      suggestions: result.suggestions,
      intent: result.intent,
    });
  } catch (error) {
    console.error("Chat webhook error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to process webhook message",
    });
  }
}

module.exports = {
  createSession,
  getConversation,
  sendMessage,
  streamMessage,
  giveConsent,
  setConversationLanguage,
  submitFeedback,
  requestHandoff,
  closeConversation,
  deleteConversation,
  listMyConversations,
  getPreferences,
  updatePreferences,
  listReminders,
  createReminder,
  cancelReminder,
  acknowledgeReminder,
  listIntakes,
  updateIntake,
  listHandoffs,
  getHandoff,
  replyToHandoff,
  resolveHandoff,
  analytics,
  channelWebhook,
};
