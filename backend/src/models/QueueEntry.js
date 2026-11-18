const mongoose = require("mongoose");

const queueEntrySchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    tokenNumber: {
      type: Number,
      required: true,
    },
    priority: {
      type: String,
      enum: ["normal", "senior", "pregnant", "emergency"],
      default: "normal",
    },
    status: {
      type: String,
      enum: [
        "waiting",
        "called",
        "in-progress",
        "completed",
        "skipped",
        "cancelled",
        "no-show",
      ],
      default: "waiting",
    },
    type: {
      type: String,
      enum: ["pre-booked", "walk-in"],
      default: "pre-booked",
    },
    notes: {
      type: String,
      default: "",
    },
    checkedInAt: {
      type: Date,
      default: Date.now,
    },
    calledAt: Date,
    startedAt: Date,
    completedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

queueEntrySchema.index(
  { doctor: 1, date: 1, tokenNumber: 1 },
  { unique: true }
);
queueEntrySchema.index({ doctor: 1, date: 1, status: 1 });
queueEntrySchema.index({ patient: 1, date: 1 });

module.exports = mongoose.model("QueueEntry", queueEntrySchema);
