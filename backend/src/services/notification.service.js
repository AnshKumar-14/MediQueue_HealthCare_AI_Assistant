const Notification = require("../models/Notification");

/**
 * Creates an in-app notification and writes a delivery log entry.
 * A real deployment would plug in an email/SMS/push provider here.
 */
async function notifyUser(userId, { type, title, message, channel = "in-app", meta = {} }) {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      channel,
      meta,
      sentAt: new Date(),
    });

    console.log(
      `[notification:${channel}] user=${userId} type=${type} :: ${title} - ${message}`
    );

    return notification;
  } catch (error) {
    console.error("Notification failed:", error.message);
    return null;
  }
}

/**
 * Simulates sending the same notification over email/SMS in addition to the
 * in-app record. Swap the console.log calls for a real provider integration.
 */
async function notifyUserMultiChannel(userId, payload) {
  const inApp = await notifyUser(userId, { ...payload, channel: "in-app" });

  for (const channel of ["email", "sms"]) {
    await notifyUser(userId, { ...payload, channel });
  }

  return inApp;
}

module.exports = { notifyUser, notifyUserMultiChannel };
