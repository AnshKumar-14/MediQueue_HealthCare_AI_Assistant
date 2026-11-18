const Reminder = require("../../models/Reminder");
const { decrypt } = require("../../utils/crypto");
const { notifyUser } = require("../notification.service");
const { deliver } = require("./channel.service");

let timer = null;
let running = false;

function reminderNotificationType(type) {
  if (type === "follow-up") return "follow-up";
  if (type === "medication") return "medication-reminder";
  return "reminder";
}

function recipientFor(channel, user) {
  if (!user) return "";
  if (channel === "email") return user.email || "";
  if (channel === "sms" || channel === "whatsapp") return user.phone || "";
  return "";
}

async function processDueReminders(limit = 50) {
  if (running) return { processed: 0 };
  running = true;

  try {
    const due = await Reminder.find({
      status: "pending",
      scheduledFor: { $lte: new Date() },
    })
      .sort({ scheduledFor: 1 })
      .limit(limit)
      .select("+message")
      .populate("user", "name email phone")
      .lean();

    let processed = 0;
    for (const reminder of due) {
      const message = decrypt(reminder.message) || reminder.title;

      // Always create the in-app notification. External channels are additive.
      await notifyUser(reminder.user?._id || reminder.user, {
        type: reminderNotificationType(reminder.type),
        title: reminder.title,
        message,
        channel: reminder.channel === "in-app" ? "in-app" : reminder.channel,
        meta: { reminderId: String(reminder._id), reminderType: reminder.type },
      });

      const delivery = await deliver({
        channel: reminder.channel,
        to: recipientFor(reminder.channel, reminder.user),
        text: message,
        meta: {
          reminderId: String(reminder._id),
          reminderType: reminder.type,
          title: reminder.title,
        },
      });

      await Reminder.findByIdAndUpdate(reminder._id, {
        status: "sent",
        sentAt: new Date(),
        "meta.lastDelivery": delivery,
      });
      processed += 1;
    }

    return { processed };
  } catch (error) {
    console.error("Reminder scheduler error:", error.message);
    return { processed: 0, error: error.message };
  } finally {
    running = false;
  }
}

function startReminderScheduler() {
  if (process.env.CHAT_REMINDERS_ENABLED === "false") return null;
  if (timer) return timer;

  const intervalMs = Math.max(
    Number(process.env.CHAT_REMINDER_INTERVAL_MS) || 60 * 1000,
    15000
  );

  timer = setInterval(() => {
    processDueReminders().catch((error) =>
      console.error("Reminder tick failed:", error.message)
    );
  }, intervalMs);
  timer.unref?.();

  // Catch anything that became due while the API was offline.
  processDueReminders().catch(() => {});
  console.log(`Chat reminder scheduler started (every ${intervalMs / 1000}s)`);
  return timer;
}

function stopReminderScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  processDueReminders,
  startReminderScheduler,
  stopReminderScheduler,
};
