const Appointment = require("../models/Appointment");
const DoctorProfile = require("../models/DoctorProfile");
const User = require("../models/User");
const QueueEntry = require("../models/QueueEntry");
const { formatDate, generateSlots } = require("../utils/queue");
const { notifyUserMultiChannel, notifyUser } = require("../services/notification.service");
const { broadcastQueue } = require("../services/queue.service");

const APPOINTMENT_POPULATE = [
  { path: "patient", select: "name email phone patientProfile" },
  { path: "doctor", select: "name specialty" },
  { path: "department", select: "name location" },
];

function isStaffOrAdmin(user) {
  return ["admin", "receptionist", "staff"].includes(user.role);
}

async function bookAppointment(req, res) {
  try {
    const {
      doctorId,
      departmentId,
      date,
      startTime,
      reason = "",
      priority = "normal",
      patientId,
    } = req.body;

    const patient =
      req.user.role === "patient" ? req.user.id : patientId || req.body.patientId;

    if (!patient) {
      return res.status(400).json({
        success: false,
        message: "A patient is required to book an appointment",
      });
    }

    if (!doctorId || !date || !startTime) {
      return res.status(400).json({
        success: false,
        message: "Doctor, date and time slot are required",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    if (date < formatDate()) {
      return res.status(400).json({
        success: false,
        message: "Appointments cannot be booked in the past",
      });
    }

    const [doctor, profile, patientUser] = await Promise.all([
      User.findOne({ _id: doctorId, role: "doctor", status: "approved" }).lean(),
      DoctorProfile.findOne({ userId: doctorId }).lean(),
      User.findOne({ _id: patient, role: "patient" }).lean(),
    ]);

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    if (!profile?.profileCompleted) {
      return res.status(400).json({
        success: false,
        message: "This doctor has not completed their profile",
      });
    }

    if (!patientUser) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const department = departmentId || profile.department;
    if (!department) {
      return res.status(400).json({
        success: false,
        message: "A department is required for this doctor",
      });
    }

    const booked = await Appointment.find({
      doctor: doctorId,
      date,
      isActive: true,
    })
      .select("startTime")
      .lean();

    const availableSlots = generateSlots(
      profile.availability,
      date,
      booked.map((item) => item.startTime),
      30
    );

    const slot = availableSlots.find((item) => item.startTime === startTime);

    if (!slot) {
      return res.status(409).json({
        success: false,
        message: "That time slot is not available. Please choose another slot.",
      });
    }

    let chosenPriority = ["normal", "senior", "pregnant"].includes(priority)
      ? priority
      : "normal";

    if (priority === "emergency" && isStaffOrAdmin(req.user)) {
      chosenPriority = "emergency";
    }

    const appointment = await Appointment.create({
      patient,
      doctor: doctorId,
      department,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      reason,
      priority: chosenPriority,
      status: "booked",
      createdBy: req.user.id,
    });

    const populated = await Appointment.findById(appointment._id)
      .populate(APPOINTMENT_POPULATE)
      .lean();

    await notifyUserMultiChannel(patient, {
      type: "booking-confirmation",
      title: "Appointment confirmed",
      message: `Your appointment with Dr. ${doctor.name} is booked for ${date} at ${slot.startTime}.`,
      meta: { appointmentId: String(appointment._id) },
    });

    await notifyUser(patient, {
      type: "reminder",
      title: "Appointment reminder",
      message: `Reminder: you have an appointment with Dr. ${doctor.name} on ${date} at ${slot.startTime}.`,
      meta: { appointmentId: String(appointment._id) },
    });

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That slot was just taken. Please choose another slot.",
      });
    }
    console.error("Book appointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to book appointment",
    });
  }
}

async function listMyAppointments(req, res) {
  try {
    const appointments = await Appointment.find({ patient: req.user.id })
      .populate(APPOINTMENT_POPULATE)
      .sort({ date: -1, startTime: -1 })
      .lean();

    const today = formatDate();
    const activeQueue = await QueueEntry.find({
      patient: req.user.id,
      date: today,
      status: { $in: ["waiting", "called", "in-progress"] },
    })
      .populate("doctor", "name specialty")
      .populate("department", "name")
      .lean();

    return res.json({
      success: true,
      today,
      appointments,
      activeQueue,
    });
  } catch (error) {
    console.error("List appointments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load appointments",
    });
  }
}

async function listDoctorAppointments(req, res) {
  try {
    const doctorId =
      req.user.role === "doctor" ? req.user.id : req.query.doctorId;
    const date = req.query.date || formatDate();

    if (!doctorId) {
      return res.status(400).json({ success: false, message: "doctorId is required" });
    }

    const appointments = await Appointment.find({ doctor: doctorId, date })
      .populate(APPOINTMENT_POPULATE)
      .sort({ startTime: 1 })
      .lean();

    return res.json({ success: true, date, appointments });
  } catch (error) {
    console.error("List doctor appointments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load appointments",
    });
  }
}

async function getAppointment(req, res) {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate(APPOINTMENT_POPULATE)
      .lean();

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const isOwner = String(appointment.patient?._id) === req.user.id;
    const isDoctor = String(appointment.doctor?._id) === req.user.id;
    if (!isOwner && !isDoctor && !isStaffOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.json({ success: true, appointment });
  } catch (error) {
    console.error("Get appointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load appointment",
    });
  }
}

async function cancelAppointment(req, res) {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const isOwner = String(appointment.patient) === req.user.id;
    const isDoctor = String(appointment.doctor) === req.user.id;
    if (!isOwner && !isDoctor && !isStaffOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (["completed", "cancelled"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Appointment is already ${appointment.status}`,
      });
    }

    appointment.status = "cancelled";
    appointment.isActive = false;
    appointment.cancelledBy = req.user.id;
    appointment.cancelReason = req.body.reason || "";
    await appointment.save();

    const queueEntry = await QueueEntry.findOne({
      appointment: appointment._id,
      status: { $in: ["waiting", "called", "in-progress"] },
    });

    if (queueEntry) {
      queueEntry.status = "cancelled";
      queueEntry.completedAt = new Date();
      await queueEntry.save();
    }

    await notifyUser(appointment.patient, {
      type: "cancellation",
      title: "Appointment cancelled",
      message: `Your appointment on ${appointment.date} at ${appointment.startTime} has been cancelled.`,
      meta: { appointmentId: String(appointment._id) },
    });

    await broadcastQueue(req.app, appointment.doctor, appointment.date);

    return res.json({
      success: true,
      message: "Appointment cancelled",
      appointment,
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel appointment",
    });
  }
}

async function rescheduleAppointment(req, res) {
  try {
    const { date, startTime } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const isOwner = String(appointment.patient) === req.user.id;
    if (!isOwner && !isStaffOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!date || !startTime) {
      return res.status(400).json({
        success: false,
        message: "New date and start time are required",
      });
    }

    if (date < formatDate()) {
      return res.status(400).json({
        success: false,
        message: "Appointments cannot be moved to the past",
      });
    }

    const profile = await DoctorProfile.findOne({ userId: appointment.doctor }).lean();
    const booked = await Appointment.find({
      doctor: appointment.doctor,
      date,
      isActive: true,
      _id: { $ne: appointment._id },
    })
      .select("startTime")
      .lean();

    const slot = generateSlots(
      profile?.availability || [],
      date,
      booked.map((item) => item.startTime),
      30
    ).find((item) => item.startTime === startTime);

    if (!slot) {
      return res.status(409).json({
        success: false,
        message: "That time slot is not available",
      });
    }

    appointment.date = date;
    appointment.startTime = slot.startTime;
    appointment.endTime = slot.endTime;
    appointment.status = "booked";
    appointment.isActive = true;
    await appointment.save();

    await notifyUser(appointment.patient, {
      type: "queue-update",
      title: "Appointment rescheduled",
      message: `Your appointment is now on ${date} at ${slot.startTime}.`,
      meta: { appointmentId: String(appointment._id) },
    });

    return res.json({
      success: true,
      message: "Appointment rescheduled",
      appointment,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That slot was just taken",
      });
    }
    console.error("Reschedule appointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reschedule appointment",
    });
  }
}

module.exports = {
  bookAppointment,
  listMyAppointments,
  listDoctorAppointments,
  getAppointment,
  cancelAppointment,
  rescheduleAppointment,
};
