/**
 * Optional outbound delivery for chat reminders.
 *
 * The chatbot itself is channel-agnostic: inbound WhatsApp/SMS messages arrive
 * through `POST /api/chat/webhook/:channel`. This module handles the other
 * direction so a reminder created with `channel: "sms"` or `"whatsapp"` can be
 * delivered by a provider.
 *
 * Two providers are supported without extra dependencies:
 *   - Twilio (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SMS_FROM /
 *     TWILIO_WHATSAPP_FROM)
 *   - Any gateway that accepts a JSON webhook (CHANNEL_OUTBOUND_URL), which is
 *     useful for local SMS/WhatsApp gateways.
 *
 * When nothing is configured the reminder is still stored, marked sent and
 * delivered in-app, so the feature degrades gracefully.
 */

const DELIVERABLE = new Set(["sms", "whatsapp", "email"]);
const TIMEOUT_MS = Number(process.env.CHANNEL_TIMEOUT_MS) || 10000;

function twilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    smsFrom: process.env.TWILIO_SMS_FROM,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
  };
}

function isConfigured(channel) {
  if (!DELIVERABLE.has(channel)) return false;
  if (process.env.CHANNEL_OUTBOUND_URL) return true;
  const twilio = twilioConfig();
  if (channel === "sms") {
    return Boolean(twilio.accountSid && twilio.authToken && twilio.smsFrom);
  }
  if (channel === "whatsapp") {
    return Boolean(
      twilio.accountSid && twilio.authToken && twilio.whatsappFrom
    );
  }
  return false;
}

async function sendViaTwilio({ channel, to, text }) {
  const twilio = twilioConfig();
  const from = channel === "whatsapp" ? twilio.whatsappFrom : twilio.smsFrom;
  const recipient = channel === "whatsapp" ? `whatsapp:${to}` : to;

  const body = new URLSearchParams({
    To: recipient,
    From: from,
    Body: text,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${twilio.accountSid}:${twilio.authToken}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Twilio responded ${response.status}: ${detail.slice(0, 200)}`);
  }

  return { provider: "twilio" };
}

async function sendViaWebhook({ channel, to, text, meta }) {
  const headers = { "Content-Type": "application/json" };
  if (process.env.CHANNEL_OUTBOUND_SECRET) {
    headers["x-channel-secret"] = process.env.CHANNEL_OUTBOUND_SECRET;
  }

  const response = await fetch(process.env.CHANNEL_OUTBOUND_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ channel, to, text, meta }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Outbound gateway responded ${response.status}`);
  }

  return { provider: "webhook" };
}

/**
 * Deliver a message to an external channel.
 * Returns `{ delivered, provider?, reason? }`; it never throws so a provider
 * outage cannot stop the reminder scheduler or the chat reply.
 */
async function deliver({ channel, to, text, meta }) {
  if (!DELIVERABLE.has(channel)) {
    return { delivered: false, reason: "channel does not need outbound delivery" };
  }
  if (!to) {
    return { delivered: false, reason: "recipient address is missing" };
  }
  if (!text) {
    return { delivered: false, reason: "message is empty" };
  }
  if (!isConfigured(channel)) {
    return { delivered: false, reason: "no outbound provider configured" };
  }

  try {
    const twilio = twilioConfig();
    const canUseTwilio =
      (channel === "sms" && twilio.smsFrom) ||
      (channel === "whatsapp" && twilio.whatsappFrom);

    const result =
      canUseTwilio && twilio.accountSid && twilio.authToken
        ? await sendViaTwilio({ channel, to, text })
        : await sendViaWebhook({ channel, to, text, meta });

    return { delivered: true, ...result };
  } catch (error) {
    console.error(`Outbound ${channel} delivery failed:`, error.message);
    return { delivered: false, reason: error.message };
  }
}

module.exports = { deliver, isConfigured, DELIVERABLE };
