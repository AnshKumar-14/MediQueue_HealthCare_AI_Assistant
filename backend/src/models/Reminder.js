const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["medication", "follow-up", "appointment"],
      default: "medication",
    },
    title: {
      type: String,
      required: true,
    },
    // Reminder body is encrypted because it may contain medication details.
    message: {
      type: String,
      required: true,
      select: false,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["in-app", "sms", "email", "whatsapp"],
      default: "in-app",
    },
    status: {
      type: String,
      enum: ["pending", "sent", "acknowledged", "cancelled"],
      default: "pending",
      index: true,
    },
    sentAt: Date,
    acknowledgedAt: Date,
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    expiresAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

reminderSchema.index({ user: 1, status: 1, scheduledFor: 1 });

module.exports = mongoose.model("Reminder", reminderSchema);
