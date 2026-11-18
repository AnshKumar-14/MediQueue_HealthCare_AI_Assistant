/**
 * Chatbot smoke test: sessions, consent, FAQ, streaming, language, triage,
 * feedback, handoff, staff inbox and admin analytics.
 *
 * Run directly:  BASE_URL=http://localhost:5000 node tests/chat-smoke.js
 * Or run all:    npm test
 */

const {
  BASE_URL,
  makeClient,
  makeChecker,
  startFreshSession,
  giveConsent,
} = require("./helpers");

async function readSse(response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((frame) => {
      const line = frame.split("\n").find((item) => item.startsWith("data:"));
      try {
        return JSON.parse(line.slice(5).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

(async () => {
  const { check, finish } = makeChecker();
  const guest = makeClient();

  let response = await guest.req("/api/chat/session", {
    method: "POST",
    body: "{}",
  });
  check(
    "guest session",
    response.status === 200 && response.body?.conversation?.id,
    `status ${response.status}`
  );
  const conversationId = response.body?.conversation?.id;
  check(
    "consent gate defaults closed",
    response.body?.conversation?.consent?.given === false,
    `given=${response.body?.conversation?.consent?.given}`
  );

  response = await giveConsent(guest, conversationId);
  check(
    "give consent",
    response.status === 200 && response.body?.conversation?.consent?.given === true,
    `status ${response.status}`
  );

  response = await guest.req(`/api/chat/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "What are your opening hours?" }),
  });
  check(
    "faq hours",
    response.status === 200 &&
      typeof response.body?.reply === "string" &&
      response.body.reply.length > 10,
    `status ${response.status} reply=${String(response.body?.reply).slice(0, 60)}`
  );

  const streamResponse = await fetch(`${BASE_URL}/api/chat/${conversationId}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: guest.cookieHeader(),
    },
    body: JSON.stringify({ text: "Where are you located?" }),
  });
  const frames = await readSse(streamResponse);
  const done = frames.find((frame) => frame.type === "done");
  check(
    "streaming reply",
    streamResponse.status === 200 && Boolean(done?.reply),
    `status ${streamResponse.status} frames=${frames.length}`
  );

  response = await guest.req(`/api/chat/${conversationId}/language`, {
    method: "POST",
    body: JSON.stringify({ locale: "hi" }),
  });
  check(
    "switch language",
    response.status === 200 && response.body?.conversation?.locale === "hi",
    `status ${response.status} locale=${response.body?.conversation?.locale}`
  );

  response = await guest.req(`/api/chat/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "मुझे अपॉइंटमेंट बुक करनी है" }),
  });
  check(
    "hindi reply",
    response.status === 200 &&
      typeof response.body?.reply === "string" &&
      response.body.reply.length > 5,
    `status ${response.status} reply=${String(response.body?.reply).slice(0, 50)}`
  );

  response = await guest.req(`/api/chat/${conversationId}/language`, {
    method: "POST",
    body: JSON.stringify({ locale: "en" }),
  });
  check("back to english", response.status === 200, `status ${response.status}`);

  response = await guest.req(`/api/chat/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "I have chest pain and shortness of breath" }),
  });
  check(
    "red flag triage",
    response.status === 200 && /emergency|112|urgent/i.test(String(response.body?.reply)),
    `reply=${String(response.body?.reply).slice(0, 90)}`
  );

  response = await guest.req(`/api/chat/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "I want to book an appointment" }),
  });
  check(
    "booking flow starts",
    response.status === 200 && response.body?.reply,
    `reply=${String(response.body?.reply).slice(0, 80)}`
  );

  const assistantMessageId = response.body?.assistantMessage?._id;
  if (assistantMessageId) {
    response = await guest.req(`/api/chat/${conversationId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ messageId: assistantMessageId, rating: "up" }),
    });
    check("feedback", response.status === 200, `status ${response.status}`);
  } else {
    check("feedback", false, "no assistantMessage id");
  }

  response = await guest.req(`/api/chat/${conversationId}/handoff`, {
    method: "POST",
    body: JSON.stringify({ reason: "test" }),
  });
  check(
    "handoff",
    response.status === 200 && response.body?.conversation?.status?.includes("handoff"),
    `status=${response.body?.conversation?.status}`
  );

  response = await guest.req(`/api/chat/${conversationId}`);
  check(
    "get conversation",
    response.status === 200 && Array.isArray(response.body?.messages),
    `messages=${response.body?.messages?.length}`
  );

  response = await guest.req("/api/chat/analytics?days=30");
  check(
    "analytics requires auth",
    response.status === 401 || response.status === 403,
    `status ${response.status}`
  );

  response = await guest.req("/api/chat/handoffs");
  check(
    "handoffs require auth",
    response.status === 401 || response.status === 403,
    `status ${response.status}`
  );

  // Patient login
  const patient = makeClient();
  response = await patient.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "patient@mediqueue.com",
      password: "Patient@123",
    }),
  });
  check("patient login", response.status === 200, `status ${response.status}`);

  response = await startFreshSession(patient);
  check(
    "patient session",
    response.status === 200 && response.body?.conversation?.id,
    `status ${response.status}`
  );
  const patientConversation = response.body?.conversation?.id;
  await giveConsent(patient, patientConversation);

  response = await patient.req(`/api/chat/${patientConversation}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "What appointments do I have?" }),
  });
  check(
    "patient appointments",
    response.status === 200 && response.body?.reply,
    `reply=${String(response.body?.reply).slice(0, 80)}`
  );

  response = await patient.req(`/api/chat/${patientConversation}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "What is my queue position?" }),
  });
  check(
    "patient queue",
    response.status === 200 && response.body?.reply,
    `reply=${String(response.body?.reply).slice(0, 80)}`
  );

  // Staff login + handoff inbox
  const staff = makeClient();
  response = await staff.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "reception@mediqueue.com",
      password: "Reception@123",
    }),
  });
  check("staff login", response.status === 200, `status ${response.status}`);

  response = await staff.req("/api/chat/handoffs");
  check(
    "staff handoff inbox",
    response.status === 200 &&
      Array.isArray(response.body?.handoffs) &&
      response.body.handoffs.length > 0,
    `count=${response.body?.handoffs?.length}`
  );

  const handoffId = response.body?.handoffs?.[0]?.id;
  if (handoffId) {
    response = await staff.req(`/api/chat/handoffs/${handoffId}`);
    check(
      "staff handoff detail",
      response.status === 200 && Array.isArray(response.body?.messages),
      `messages=${response.body?.messages?.length}`
    );

    response = await staff.req(`/api/chat/handoffs/${handoffId}/reply`, {
      method: "POST",
      body: JSON.stringify({ text: "Hi, this is reception. How can I help?" }),
    });
    check("staff reply", response.status === 200, `status ${response.status}`);

    response = await guest.req(`/api/chat/${conversationId}`);
    const hasStaffReply = response.body?.messages?.some(
      (message) => message.role === "staff"
    );
    check(
      "patient sees staff reply",
      hasStaffReply === true,
      `messages=${response.body?.messages?.length}`
    );

    response = await staff.req(`/api/chat/handoffs/${handoffId}/resolve`, {
      method: "POST",
    });
    check("resolve handoff", response.status === 200, `status ${response.status}`);
  } else {
    check("staff handoff detail", false, "no handoff id");
  }

  response = await staff.req("/api/chat/analytics?days=30");
  check(
    "analytics requires admin",
    response.status === 401 || response.status === 403,
    `status ${response.status}`
  );

  // Admin analytics
  const admin = makeClient();
  response = await admin.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@mediqueue.com", password: "Admin@123" }),
  });
  check("admin login", response.status === 200, `status ${response.status}`);

  response = await admin.req("/api/chat/analytics?days=30");
  check(
    "admin analytics",
    response.status === 200 && response.body?.analytics?.overview,
    `conversations=${response.body?.analytics?.overview?.conversations}`
  );

  response = await admin.req("/api/chat/intakes");
  check(
    "admin intakes",
    response.status === 200 && Array.isArray(response.body?.intakes),
    `count=${response.body?.intakes?.length}`
  );

  // Delete guest conversation
  response = await guest.req(`/api/chat/${conversationId}`, { method: "DELETE" });
  check("delete conversation", response.status === 200, `status ${response.status}`);

  finish();
})();
