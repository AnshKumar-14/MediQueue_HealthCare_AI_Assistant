const mongoose = require("mongoose");

const DoctorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },

    qualification: {
      type: String,
      required: true,
    },

    experience: {
      type: Number,
      required: true,
    },

    profileImage: {
      type: String,
    },

    hospitalName: {
      type: String,
      required: true,
    },

    clinicAddress: {
      type: String,
      required: true,
    },

    consultationFee: {
      type: Number,
      required: true,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    dailyPatientCapacity: {
      type: Number,
      required: true,
    },

    avgConsultationMinutes: {
      type: Number,
      default: 10,
      min: 1,
    },

    availability: [
      {
        day: String,
        startTime: String,
        endTime: String,
      },
    ],

    bio: {
      type: String,
      required: true,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const DoctorProfile = mongoose.model("DoctorProfile", DoctorProfileSchema);
module.exports = DoctorProfile;
