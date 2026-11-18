/**
 * Symptom triage, pre-visit intake, preferences and reminders end-to-end test.
 *
 * Run directly:  BASE_URL=http://localhost:5000 node tests/triage-intake-e2e.js
 * Or run all:    npm test
 */

const {
  makeClient,
  makeChecker,
  startFreshSession,
  giveConsent,
} = require("./helpers");

(async () => {
  const { check, finish } = makeChecker();
  const client = makeClient();

  let response = await client.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "patient@mediqueue.com",
      password: "Patient@123",
    }),
  });
  check("patient login", response.status === 200, `status ${response.status}`);

  response = await startFreshSession(client);
  const conversationId = response.body?.conversation?.id;
  check("chat session", Boolean(conversationId), `status ${response.status}`);
  await giveConsent(client, conversationId);

  const say = async (text) => {
    const result = await client.req(`/api/chat/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    console.log(`\n>>> ${text}\n[${result.status}] ${String(result.body?.reply).slice(0, 500)}`);
    return result.body;
  };

  let reply = (await say("I have a headache and fever"))?.reply || "";
  check("triage asks duration", /how long|duration|when did/i.test(reply));

  reply = (await say("3 days"))?.reply || "";
  check("triage asks severity", /1.*10|severity|scale/i.test(reply));

  reply = (await say("6"))?.reply || "";
  check(
    "triage recommends specialty",
    /General Medicine|department|recommend/i.test(reply)
  );
  check(
    "triage includes disclaimer",
    /not a substitute|diagnose|prescrib/i.test(reply)
  );

  reply = (await say("yes"))?.reply || "";
  check("triage offers booking", /doctor/i.test(reply));

  reply = (await say("restart"))?.reply || "";
  reply = (await say("pre-visit intake"))?.reply || "";
  check("intake asks reason", /reason|why|visit/i.test(reply));

  reply = (await say("Recurring headaches"))?.reply || "";
  check("intake asks symptoms", /symptom/i.test(reply));

  reply = (await say("Throbbing pain, light sensitivity"))?.reply || "";
  check("intake asks duration", /how long|duration/i.test(reply));

  reply = (await say("3 days"))?.reply || "";
  check("intake asks meds", /medicine|medication/i.test(reply));

  reply = (await say("Paracetamol"))?.reply || "";
  check("intake asks allergies", /allerg/i.test(reply));

  reply = (await say("None"))?.reply || "";
  check("intake saved", /saved|summary|doctor|thank/i.test(reply));

  reply = (await say("set a medication reminder"))?.reply || "";
  check("reminder asks details", /remind|medication|when|what/i.test(reply));

  // Patient preferences
  response = await client.req("/api/chat/preferences", {
    method: "PATCH",
    body: JSON.stringify({ language: "en", contactMethod: "sms" }),
  });
  check("update preferences (PATCH)", response.status === 200);

  response = await client.req("/api/chat/preferences", {
    method: "PUT",
    body: JSON.stringify({ contactMethod: "email", voiceReplies: true }),
  });
  check(
    "update preferences (PUT)",
    response.status === 200 &&
      response.body?.preferences?.contactMethod === "email" &&
      response.body?.preferences?.voiceReplies === true
  );

  response = await client.req("/api/chat/preferences");
  check(
    "read preferences",
    response.status === 200 && response.body?.preferences?.contactMethod === "email"
  );

  // Reminder create + acknowledge
  response = await client.req("/api/chat/reminders", {
    method: "POST",
    body: JSON.stringify({
      type: "medication",
      title: "Take medicine",
      message: "Take one tablet after dinner",
      scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
  });
  check(
    "create reminder",
    response.status === 201 && response.body?.reminder?._id,
    `status=${response.status}`
  );
  const reminderId = response.body?.reminder?._id;

  if (reminderId) {
    response = await client.req("/api/chat/reminders");
    check(
      "list reminders",
      response.status === 200 &&
        response.body?.reminders?.some((item) => item._id === reminderId),
      `count=${response.body?.reminders?.length}`
    );

    response = await client.req(`/api/chat/reminders/${reminderId}/ack`, {
      method: "POST",
    });
    check(
      "acknowledge reminder",
      response.status === 200 && response.body?.reminder?.status === "acknowledged"
    );

    response = await client.req(`/api/chat/reminders/${reminderId}/ack`, {
      method: "POST",
    });
    check("re-acknowledge rejected", response.status === 404);
  } else {
    check("acknowledge reminder", false, "no reminder id");
  }

  // Reminder create + cancel
  response = await client.req("/api/chat/reminders", {
    method: "POST",
    body: JSON.stringify({
      type: "follow-up",
      title: "Follow-up visit",
      message: "Call the clinic to book a follow-up",
      scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }),
  });
  const cancelId = response.body?.reminder?._id;
  if (cancelId) {
    response = await client.req(`/api/chat/reminders/${cancelId}`, {
      method: "DELETE",
    });
    check(
      "cancel reminder",
      response.status === 200 && response.body?.reminder?.status === "cancelled"
    );
  } else {
    check("cancel reminder", false, "no reminder id");
  }

  // Staff can see intake
  const staff = makeClient();
  await staff.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "reception@mediqueue.com",
      password: "Reception@123",
    }),
  });
  response = await staff.req("/api/chat/intakes");
  check(
    "staff sees intakes",
    response.status === 200 && response.body?.intakes?.length > 0,
    `count=${response.body?.intakes?.length}`
  );

  const intake = response.body?.intakes?.[0];
  if (intake) {
    response = await staff.req(`/api/chat/intakes/${intake._id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "confirmed",
        staffNotes: "Verified by phone",
      }),
    });
    check(
      "staff updates intake",
      response.status === 200 && response.body?.intake?.status === "confirmed"
    );
  } else {
    check("staff updates intake", false, "no intake");
  }

  finish();
})();
