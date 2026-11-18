const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["patient", "doctor", "receptionist", "staff", "admin"],
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // Doctor fields
    specialty: {
      type: String,
      required: function () {
        return this.role === "doctor";
      },
    },

    licenseNumber: {
      type: String,
      required: function () {
        return this.role === "doctor";
      },
      unique: true,
      sparse: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },

    // Staff fields
    staffType: {
      type: String,
      enum: ["receptionist", "nurse", "admin"],
      required: function () {
        return this.role === "staff";
      },
    },

    // Patient profile
    patientProfile: {
      dateOfBirth: String,
      gender: {
        type: String,
        enum: ["male", "female", "other", ""],
        default: "",
      },
      address: String,
      bloodGroup: String,
      emergencyContact: String,
    },

    // Encrypted JSON string (AES-256-GCM) containing sensitive medical info
    medicalInfo: {
      type: String,
      select: false,
    },

    // Chatbot personalisation. Never contains medical data.
    chatPreferences: {
      language: {
        type: String,
        enum: ["en", "hi", "es", "fr", "ar"],
        default: "en",
      },
      contactMethod: {
        type: String,
        enum: ["in-app", "sms", "email", "whatsapp"],
        default: "in-app",
      },
      preferredDoctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      medicationReminders: {
        type: Boolean,
        default: false,
      },
      followUpReminders: {
        type: Boolean,
        default: false,
      },
      voiceReplies: {
        type: Boolean,
        default: false,
      },
    },

    lastChatAt: Date,

    consentAccepted: {
      type: Boolean,
      default: false,
    },

    // Approval status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function () {
        return ["patient", "admin", "receptionist"].includes(this.role)
          ? "approved"
          : "pending";
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1, status: 1 });

const User = mongoose.model("User", userSchema);
module.exports = User;
