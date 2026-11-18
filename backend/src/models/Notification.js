const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "booking-confirmation",
        "reminder",
        "turn-near",
        "your-turn",
        "cancellation",
        "queue-update",
        "account",
        "chat-handoff",
        "chat-reply",
        "intake",
        "medication-reminder",
        "follow-up",
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ["in-app", "email", "sms", "push", "whatsapp"],
      default: "in-app",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
