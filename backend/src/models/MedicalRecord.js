const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
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
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    queueEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QueueEntry",
    },
    visitDate: {
      type: Date,
      default: Date.now,
    },
    // Encrypted at rest (AES-256-GCM)
    diagnosis: String,
    notes: String,
    prescription: String,
    followUpDate: String,
  },
  { timestamps: true }
);

medicalRecordSchema.index({ patient: 1, visitDate: -1 });
medicalRecordSchema.index({ doctor: 1, visitDate: -1 });

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);
