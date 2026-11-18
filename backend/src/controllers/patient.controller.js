const User = require("../models/User");
const Appointment = require("../models/Appointment");
const QueueEntry = require("../models/QueueEntry");
const MedicalRecord = require("../models/MedicalRecord");
const { encrypt, decrypt } = require("../utils/crypto");

function serializeProfile(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    patientProfile: user.patientProfile || {},
    consentAccepted: user.consentAccepted,
    createdAt: user.createdAt,
  };
}

async function getMyProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select("+medicalInfo").lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const medicalInfo = user.medicalInfo ? JSON.parse(decrypt(user.medicalInfo) || "{}") : {};

    return res.json({
      success: true,
      profile: serializeProfile(user),
      medicalInfo,
    });
  } catch (error) {
    console.error("Get patient profile error:", error);
    return res.status(500).json({ success: false, message: "Failed to load profile" });
  }
}

async function updateMyProfile(req, res) {
  try {
    const { name, phone, patientProfile, medicalInfo, consentAccepted } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (patientProfile !== undefined) updates.patientProfile = patientProfile;
    if (consentAccepted !== undefined) updates.consentAccepted = consentAccepted;

    if (medicalInfo !== undefined) {
      updates.medicalInfo = encrypt(
        JSON.stringify({
          bloodGroup: medicalInfo.bloodGroup || "",
          allergies: medicalInfo.allergies || "",
          conditions: medicalInfo.conditions || "",
          medications: medicalInfo.medications || "",
          notes: medicalInfo.notes || "",
        })
      );
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    })
      .select("+medicalInfo")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      message: "Profile updated",
      profile: serializeProfile(user),
      medicalInfo: user.medicalInfo
        ? JSON.parse(decrypt(user.medicalInfo) || "{}")
        : {},
    });
  } catch (error) {
    console.error("Update patient profile error:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
}

async function getMyHistory(req, res) {
  try {
    const [appointments, records, queueEntries] = await Promise.all([
      Appointment.find({ patient: req.user.id })
        .populate("doctor", "name specialty")
        .populate("department", "name")
        .sort({ date: -1, startTime: -1 })
        .lean(),
      MedicalRecord.find({ patient: req.user.id })
        .populate("doctor", "name specialty")
        .sort({ visitDate: -1 })
        .lean(),
      QueueEntry.find({ patient: req.user.id })
        .populate("doctor", "name specialty")
        .populate("department", "name")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return res.json({
      success: true,
      appointments,
      records: records.map((record) => ({
        ...record,
        diagnosis: decrypt(record.diagnosis),
        notes: decrypt(record.notes),
        prescription: decrypt(record.prescription),
      })),
      queueEntries,
    });
  } catch (error) {
    console.error("Get patient history error:", error);
    return res.status(500).json({ success: false, message: "Failed to load history" });
  }
}

async function exportMyData(req, res) {
  try {
    const [profile, history] = await Promise.all([
      User.findById(req.user.id).select("+medicalInfo").lean(),
      getMyHistoryData(req.user.id),
    ]);

    return res.json({
      success: true,
      exportedAt: new Date(),
      profile: serializeProfile(profile),
      medicalInfo: profile.medicalInfo
        ? JSON.parse(decrypt(profile.medicalInfo) || "{}")
        : {},
      ...history,
    });
  } catch (error) {
    console.error("Export data error:", error);
    return res.status(500).json({ success: false, message: "Failed to export data" });
  }
}

async function getMyHistoryData(patientId) {
  const [appointments, records, queueEntries] = await Promise.all([
    Appointment.find({ patient: patientId })
      .populate("doctor", "name specialty")
      .populate("department", "name")
      .lean(),
    MedicalRecord.find({ patient: patientId }).lean(),
    QueueEntry.find({ patient: patientId }).lean(),
  ]);

  return {
    appointments,
    records: records.map((record) => ({
      ...record,
      diagnosis: decrypt(record.diagnosis),
      notes: decrypt(record.notes),
      prescription: decrypt(record.prescription),
    })),
    queueEntries,
  };
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  getMyHistory,
  exportMyData,
};
