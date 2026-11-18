const mongoose = require("mongoose");

/**
 * Short, doctor-visible pre-visit summary produced by the conversational
 * intake. Free-text medical fields are encrypted at rest.
 */
const intakeSummarySchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    reason: {
      type: String,
      select: false,
      default: "",
    },
    symptoms: {
      type: String,
      select: false,
      default: "",
    },
    duration: {
      type: String,
      select: false,
      default: "",
    },
    severity: {
      type: Number,
      min: 0,
      max: 10,
    },
    medications: {
      type: String,
      select: false,
      default: "",
    },
    allergies: {
      type: String,
      select: false,
      default: "",
    },
    redFlags: {
      type: [String],
      default: [],
    },
    suggestedDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    suggestedPriority: {
      type: String,
      enum: ["normal", "senior", "pregnant", "emergency"],
      default: "normal",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "seen"],
      default: "pending",
      index: true,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    doctorVisible: {
      type: Boolean,
      default: true,
    },
    staffNotes: {
      type: String,
      select: false,
      default: "",
    },
    expiresAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

intakeSummarySchema.index({ doctor: 1, status: 1, createdAt: -1 });
intakeSummarySchema.index({ patient: 1, createdAt: -1 });

module.exports = mongoose.model("IntakeSummary", intakeSummarySchema);
