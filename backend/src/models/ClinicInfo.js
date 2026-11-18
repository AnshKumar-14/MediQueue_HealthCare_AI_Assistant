const mongoose = require("mongoose");

/**
 * Grounded source of truth for clinic-specific FAQ answers. The chatbot only
 * answers from these records (or live MediQueue data) and never invents details.
 */
const clinicInfoSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      enum: [
        "hours",
        "location",
        "directions",
        "parking",
        "fees",
        "insurance",
        "documents",
        "preparation",
        "app",
        "emergency",
        "policy",
        "facility",
        "general",
      ],
      default: "general",
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    // Optional localized overrides: { hi: { title, content }, es: {...} }
    translations: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    keywords: {
      type: [String],
      default: [],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

clinicInfoSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model("ClinicInfo", clinicInfoSchema);
