/**
 * Conversational booking end-to-end test: book, list, reschedule, cancel and
 * join the walk-in queue entirely through the chatbot.
 *
 * Run directly:  BASE_URL=http://localhost:5000 node tests/booking-e2e.js
 * Or run all:    npm test
 */

const {
  makeClient,
  makeChecker,
  startFreshSession,
  giveConsent,
} = require("./helpers");

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Demo doctors work Monday to Saturday, so never rely on "tomorrow" (which is
// Sunday when the suite runs on a Saturday).
function nextClinicDate(after = new Date()) {
  const date = new Date(after);
  date.setHours(0, 0, 0, 0);
  do {
    date.setDate(date.getDate() + 1);
  } while (date.getDay() === 0);
  return date;
}

const bookingDate = formatDate(nextClinicDate());
const rescheduleDate = formatDate(nextClinicDate(nextClinicDate()));

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
    console.log(`\n>>> ${text}\n[${result.status}] ${String(result.body?.reply).slice(0, 600)}`);
    return result.body;
  };

  let reply = (await say("I want to book an appointment"))?.reply || "";
  check("booking asks department", /department/i.test(reply));

  reply = (await say("1"))?.reply || "";
  check("booking asks doctor", /doctor/i.test(reply));

  reply = (await say("1"))?.reply || "";
  check("booking asks date", /date/i.test(reply));

  reply = (await say(bookingDate))?.reply || "";
  check("booking lists slots", /available|AM|PM/i.test(reply));

  reply = (await say("1"))?.reply || "";
  check("booking asks priority", /senior|pregnan|standard/i.test(reply));

  reply = (await say("normal"))?.reply || "";
  check("booking asks reason", /reason/i.test(reply));

  reply = (await say("Routine checkup"))?.reply || "";
  check(
    "booking shows confirmation",
    /confirm/i.test(reply) && /Routine checkup/i.test(reply)
  );

  reply = (await say("yes"))?.reply || "";
  check("booking confirmed", /confirmed/i.test(reply));

  reply = (await say("What appointments do I have?"))?.reply || "";
  check(
    "lists appointments",
    /appointment|Dr\./i.test(reply) && !/which department/i.test(reply)
  );

  reply = (await say("I need to reschedule my appointment"))?.reply || "";
  check("reschedule lists appointments", /which|choose|reschedul/i.test(reply));

  reply = (await say("1"))?.reply || "";
  check("reschedule asks date", /date/i.test(reply));

  reply = (await say(rescheduleDate))?.reply || "";
  check("reschedule lists slots", /available|AM|PM/i.test(reply));

  reply = (await say("2"))?.reply || "";
  check("reschedule shows confirmation", /confirm|Shall/i.test(reply));

  reply = (await say("yes"))?.reply || "";
  check("reschedule confirmed", /rescheduled|confirmed|moved/i.test(reply));

  reply = (await say("Cancel my appointment"))?.reply || "";
  check("cancel lists appointments", /which|choose|cancel/i.test(reply));

  reply = (await say("1"))?.reply || "";
  check("cancel shows confirmation", /confirm|Shall/i.test(reply));

  reply = (await say("yes"))?.reply || "";
  check("cancel confirmed", /cancel/i.test(reply));

  reply = (await say("I want to join the walk-in queue"))?.reply || "";
  check("walk-in asks department", /department/i.test(reply));

  reply = (await say("3"))?.reply || "";
  check("walk-in asks doctor", /doctor/i.test(reply));

  reply = (await say("1"))?.reply || "";
  check("walk-in shows confirmation", /confirm|Shall/i.test(reply));

  reply = (await say("yes"))?.reply || "";
  check("walk-in joined", /token|queue|joined|added/i.test(reply));

  finish();
})();
