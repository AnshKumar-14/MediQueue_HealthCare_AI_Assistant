const mongoose = require("mongoose");

const SUPPORTED_LOCALES = ["en", "hi", "es", "fr", "ar"];

const chatConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    // Anonymous channel identity (e.g. WhatsApp number). Web widget guests
    // get a per-browser visitor id only, never treated as authenticated.
    externalId: {
      type: String,
      trim: true,
    },
    channel: {
      type: String,
      enum: ["web", "mobile", "whatsapp", "sms"],
      default: "web",
      index: true,
    },
    locale: {
      type: String,
      enum: SUPPORTED_LOCALES,
      default: "en",
    },
    status: {
      type: String,
      enum: [
        "active",
        "handoff-requested",
        "handoff-active",
        "closed",
      ],
      default: "active",
      index: true,
    },
    state: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastIntent: {
      type: String,
      default: "",
    },
    consent: {
      given: { type: Boolean, default: false },
      givenAt: Date,
      version: { type: String, default: "2026-01" },
    },
    handoff: {
      requestedAt: Date,
      reason: String,
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      resolvedAt: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      summary: String,
    },
    resolution: {
      type: String,
      enum: ["open", "resolved", "dropped", "escalated"],
      default: "open",
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessageAt: Date,
    closedAt: Date,
    tags: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // TTL retention (default 30 days).
    expiresAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

chatConversationSchema.index({ user: 1, createdAt: -1 });
chatConversationSchema.index({ status: 1, lastMessageAt: -1 });
chatConversationSchema.index({ channel: 1, externalId: 1 });

module.exports = mongoose.model("ChatConversation", chatConversationSchema);
module.exports.SUPPORTED_LOCALES = SUPPORTED_LOCALES;
