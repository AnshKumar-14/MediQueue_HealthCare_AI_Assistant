const mongoose = require("mongoose");

/**
 * Message bodies are encrypted at rest with AES-256-GCM. Only the controller
 * decrypts them for authorised participants. `content` uses select:false so an
 * accidental `.lean()` never leaks ciphertext into an API response.
 */
const chatMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system", "staff"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      select: false,
    },
    intent: {
      type: String,
      default: "",
    },
    faqKey: {
      type: String,
      default: "",
    },
    suggestions: {
      type: [String],
      default: [],
    },
    feedback: {
      type: String,
      enum: ["up", "down", ""],
      default: "",
    },
    feedbackComment: {
      type: String,
      select: false,
    },
    toolCalls: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    author: {
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

chatMessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
