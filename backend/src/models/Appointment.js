const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
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
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    startTime: {
      type: String, // HH:mm
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    priority: {
      type: String,
      enum: ["normal", "senior", "pregnant", "emergency"],
      default: "normal",
    },
    status: {
      type: String,
      enum: [
        "booked",
        "checked-in",
        "in-queue",
        "completed",
        "cancelled",
        "no-show",
      ],
      default: "booked",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
