const MedicalRecord = require("../models/MedicalRecord");
const Appointment = require("../models/Appointment");
const QueueEntry = require("../models/QueueEntry");
const { encrypt, decrypt } = require("../utils/crypto");

function isStaffOrAdmin(user) {
  return ["admin", "receptionist", "staff"].includes(user.role);
}

function serialize(record) {
  return {
    ...record,
    diagnosis: decrypt(record.diagnosis),
    notes: decrypt(record.notes),
    prescription: decrypt(record.prescription),
  };
}

async function createRecord(req, res) {
  try {
    if (!["doctor", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only doctors can create medical records",
      });
    }

    const {
      patientId,
      appointmentId,
      queueEntryId,
      diagnosis = "",
      notes = "",
      prescription = "",
      followUpDate = "",
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "patientId is required",
      });
    }

    const record = await MedicalRecord.create({
      patient: patientId,
      doctor: req.user.id,
      appointment: appointmentId || undefined,
      queueEntry: queueEntryId || undefined,
      visitDate: new Date(),
      diagnosis: encrypt(diagnosis),
      notes: encrypt(notes),
      prescription: encrypt(prescription),
      followUpDate,
    });

    if (queueEntryId) {
      await QueueEntry.findByIdAndUpdate(queueEntryId, { status: "completed" });
    }

    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, { status: "completed" });
    }

    const populated = await MedicalRecord.findById(record._id)
      .populate("patient", "name email phone")
      .populate("doctor", "name specialty")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Medical record saved",
      record: serialize(populated),
    });
  } catch (error) {
    console.error("Create medical record error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save medical record",
    });
  }
}

async function listRecordsForPatient(req, res) {
  try {
    const patientId = req.params.patientId;

    if (
      req.user.role === "patient" &&
      String(req.user.id) !== String(patientId)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (
      req.user.role === "doctor" &&
      req.query.mine === "true"
    ) {
      // Doctors can opt to see only their own records (filtered below).
    }

    const filter = { patient: patientId };
    if (req.user.role === "doctor") filter.doctor = req.user.id;

    const records = await MedicalRecord.find(filter)
      .populate("doctor", "name specialty")
      .sort({ visitDate: -1 })
      .lean();

    return res.json({
      success: true,
      records: records.map(serialize),
    });
  } catch (error) {
    console.error("List medical records error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load medical records",
    });
  }
}

async function getRecord(req, res) {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate("patient", "name email phone")
      .populate("doctor", "name specialty")
      .lean();

    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    const isPatient = String(record.patient?._id) === req.user.id;
    const isDoctor = String(record.doctor?._id) === req.user.id;

    if (!isPatient && !isDoctor && !isStaffOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.json({ success: true, record: serialize(record) });
  } catch (error) {
    console.error("Get medical record error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load medical record",
    });
  }
}

module.exports = { createRecord, listRecordsForPatient, getRecord };
