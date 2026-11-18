const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const QueueEntry = require("../models/QueueEntry");
const DoctorProfile = require("../models/DoctorProfile");
const { formatDate } = require("../utils/queue");
const {
  getDoctorQueue,
  getDisplayData,
  createQueueEntry,
  broadcastQueue,
  notifyNearTurn,
  QUEUE_POPULATE,
} = require("../services/queue.service");
const { notifyUser, notifyUserMultiChannel } = require("../services/notification.service");

function isStaffOrAdmin(user) {
  return ["admin", "receptionist", "staff"].includes(user.role);
}

function resolveDoctorId(req) {
  if (req.user.role === "doctor") return req.user.id;
  return req.body?.doctorId || req.query?.doctorId || null;
}

async function checkIn(req, res) {
  try {
    const { appointmentId, priority } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ success: false, message: "appointmentId is required" });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "name")
      .populate("doctor", "name")
      .populate("department", "name");

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const isOwner = String(appointment.patient._id) === req.user.id;
    const isDoctor = String(appointment.doctor._id) === req.user.id;
    if (!isOwner && !isDoctor && !isStaffOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (appointment.date !== formatDate()) {
      return res.status(400).json({
        success: false,
        message: "Check-in is only available on the appointment date",
      });
    }

    if (["cancelled", "completed", "no-show"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `This appointment is ${appointment.status}`,
      });
    }

    const existing = await QueueEntry.findOne({
      appointment: appointment._id,
      status: { $in: ["waiting", "called", "in-progress"] },
    }).populate(QUEUE_POPULATE);

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Patient is already checked in",
        queueEntry: existing,
      });
    }

    const entry = await createQueueEntry({
      patient: appointment.patient._id,
      doctor: appointment.doctor._id,
      department: appointment.department._id,
      appointment: appointment._id,
      priority:
        priority && ["normal", "senior", "pregnant", "emergency"].includes(priority)
          ? priority
          : appointment.priority,
      type: "pre-booked",
      createdBy: req.user.id,
    });

    appointment.status = "checked-in";
    appointment.priority = entry.priority;
    await appointment.save();

    await broadcastQueue(req.app, appointment.doctor._id, entry.date);

    const queue = await getDoctorQueue(appointment.doctor._id, entry.date);

    return res.status(201).json({
      success: true,
      message: `Checked in. Token #${entry.tokenNumber}`,
      queueEntry: queue.waiting.find(
        (item) => String(item._id) === String(entry._id)
      ) || entry,
      queue,
    });
  } catch (error) {
    console.error("Check-in error:", error);
    return res.status(500).json({ success: false, message: "Check-in failed" });
  }
}

async function walkIn(req, res) {
  try {
    if (!isStaffOrAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only reception staff can add walk-in patients",
      });
    }

    const {
      patientId,
      name,
      phone,
      email,
      doctorId,
      priority = "normal",
      notes = "",
    } = req.body;

    if (!doctorId) {
      return res.status(400).json({ success: false, message: "doctorId is required" });
    }

    const doctor = await User.findOne({
      _id: doctorId,
      role: "doctor",
      status: "approved",
    }).lean();

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const profile = await DoctorProfile.findOne({ userId: doctorId }).lean();
    if (!profile?.department) {
      return res.status(400).json({
        success: false,
        message: "Doctor has no department assigned",
      });
    }

    let patient;

    if (patientId) {
      patient = await User.findOne({ _id: patientId, role: "patient" });
      if (!patient) {
        return res.status(404).json({ success: false, message: "Patient not found" });
      }
    } else {
      if (!name || !phone) {
        return res.status(400).json({
          success: false,
          message: "Patient name and phone are required for walk-ins",
        });
      }

      const identifier = email ? { email: email.toLowerCase() } : { phone };
      patient = await User.findOne({ ...identifier, role: "patient" });

      if (!patient) {
        const randomPassword = crypto.randomBytes(16).toString("hex");
        patient = await User.create({
          role: "patient",
          name,
          phone,
          email: email || `walkin-${Date.now()}@mediqueue.local`,
          password: await bcrypt.hash(randomPassword, 10),
          status: "approved",
          consentAccepted: false,
        });
      }
    }

    const entry = await createQueueEntry({
      patient: patient._id,
      doctor: doctorId,
      department: profile.department,
      priority: ["normal", "senior", "pregnant", "emergency"].includes(priority)
        ? priority
        : "normal",
      type: "walk-in",
      notes,
      createdBy: req.user.id,
    });

    await broadcastQueue(req.app, doctorId, entry.date);

    const queue = await getDoctorQueue(doctorId, entry.date);

    return res.status(201).json({
      success: true,
      message: `Walk-in added. Token #${entry.tokenNumber}`,
      patient: {
        _id: patient._id,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
      },
      queueEntry: queue.waiting.find(
        (item) => String(item._id) === String(entry._id)
      ) || entry,
      queue,
    });
  } catch (error) {
    console.error("Walk-in error:", error);
    return res.status(500).json({ success: false, message: "Failed to add walk-in" });
  }
}

async function getQueue(req, res) {
  try {
    const doctorId = resolveDoctorId(req);

    if (!doctorId) {
      return res.status(400).json({ success: false, message: "doctorId is required" });
    }

    if (
      req.user.role === "doctor" &&
      String(req.user.id) !== String(doctorId)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const date = req.query.date || formatDate();
    const queue = await getDoctorQueue(doctorId, date);

    return res.json({ success: true, queue });
  } catch (error) {
    console.error("Get queue error:", error);
    return res.status(500).json({ success: false, message: "Failed to load queue" });
  }
}

async function getMyStatus(req, res) {
  try {
    const today = formatDate();
    const entries = await QueueEntry.find({
      patient: req.user.id,
      date: today,
      status: { $in: ["waiting", "called", "in-progress"] },
    })
      .populate(QUEUE_POPULATE)
      .lean();

    const statuses = [];

    for (const entry of entries) {
      const queue = await getDoctorQueue(entry.doctor?._id || entry.doctor, today);
      const waitingEntry = queue.waiting.find(
        (item) => String(item._id) === String(entry._id)
      );
      const currentEntry =
        String(queue.current?._id) === String(entry._id) ? queue.current : null;

      statuses.push({
        entry,
        doctor: entry.doctor,
        department: entry.department,
        position: waitingEntry?.position ?? null,
        estimatedWaitMinutes: waitingEntry?.estimatedWaitMinutes ?? 0,
        currentToken: queue.current?.tokenNumber ?? null,
        nowServing: currentEntry,
        totalWaiting: queue.waiting.length,
        queue,
      });
    }

    return res.json({ success: true, today, active: statuses });
  } catch (error) {
    console.error("Get my queue status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load queue status",
    });
  }
}

async function callNext(req, res) {
  try {
    const doctorId = resolveDoctorId(req);

    if (!doctorId) {
      return res.status(400).json({ success: false, message: "doctorId is required" });
    }

    if (req.user.role === "doctor" && String(req.user.id) !== String(doctorId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const date = req.query.date || req.body?.date || formatDate();
    const queue = await getDoctorQueue(doctorId, date);

    if (queue.current) {
      return res.status(409).json({
        success: false,
        message: `Token #${queue.current.tokenNumber} is still active. Complete or skip it first.`,
        current: queue.current,
      });
    }

    const next = queue.waiting[0];

    if (!next) {
      return res.status(404).json({
        success: false,
        message: "No patients are waiting in the queue",
      });
    }

    const entry = await QueueEntry.findByIdAndUpdate(
      next._id,
      { status: "called", calledAt: new Date() },
      { new: true }
    );

    if (entry.appointment) {
      await Appointment.findByIdAndUpdate(entry.appointment, { status: "in-queue" });
    }

    await notifyUserMultiChannel(entry.patient, {
      type: "your-turn",
      title: "It's your turn",
      message: `Token #${entry.tokenNumber}, please proceed to the doctor's room now.`,
      meta: { queueEntryId: String(entry._id), doctorId: String(doctorId) },
    });

    await notifyNearTurn(doctorId, date);
    await broadcastQueue(req.app, doctorId, date);

    const updated = await getDoctorQueue(doctorId, date);

    return res.json({
      success: true,
      message: `Now serving token #${entry.tokenNumber}`,
      called: updated.current,
      queue: updated,
    });
  } catch (error) {
    console.error("Call next error:", error);
    return res.status(500).json({ success: false, message: "Failed to call next patient" });
  }
}

async function getAuthorizedEntry(req) {
  const entry = await QueueEntry.findById(req.params.id);

  if (!entry) return { error: { status: 404, message: "Queue entry not found" } };

  const isDoctor = String(entry.doctor) === req.user.id;
  if (!isDoctor && !isStaffOrAdmin(req.user)) {
    return { error: { status: 403, message: "Access denied" } };
  }

  return { entry };
}

async function startConsultation(req, res) {
  try {
    const { entry, error } = await getAuthorizedEntry(req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (entry.status !== "called") {
      return res.status(400).json({
        success: false,
        message: "Only a called patient can be started",
      });
    }

    entry.status = "in-progress";
    entry.startedAt = new Date();
    await entry.save();

    if (entry.appointment) {
      await Appointment.findByIdAndUpdate(entry.appointment, { status: "in-queue" });
    }

    await broadcastQueue(req.app, entry.doctor, entry.date);

    return res.json({ success: true, message: "Consultation started", entry });
  } catch (error) {
    console.error("Start consultation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start consultation",
    });
  }
}

async function completeEntry(req, res) {
  try {
    const { entry, error } = await getAuthorizedEntry(req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (!["called", "in-progress"].includes(entry.status)) {
      return res.status(400).json({
        success: false,
        message: "Only a called or in-progress patient can be completed",
      });
    }

    entry.status = "completed";
    entry.completedAt = new Date();
    if (!entry.startedAt) entry.startedAt = new Date();
    await entry.save();

    if (entry.appointment) {
      await Appointment.findByIdAndUpdate(entry.appointment, { status: "completed" });
    }

    await notifyUser(entry.patient, {
      type: "queue-update",
      title: "Visit completed",
      message: "Your visit has been marked as completed. Thank you!",
      meta: { queueEntryId: String(entry._id) },
    });

    await broadcastQueue(req.app, entry.doctor, entry.date);

    const queue = await getDoctorQueue(entry.doctor, entry.date);

    return res.json({
      success: true,
      message: "Patient marked as completed",
      entry,
      queue,
    });
  } catch (error) {
    console.error("Complete entry error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete patient",
    });
  }
}

async function skipEntry(req, res) {
  try {
    const { entry, error } = await getAuthorizedEntry(req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (!["waiting", "called", "in-progress"].includes(entry.status)) {
      return res.status(400).json({
        success: false,
        message: "This queue entry can no longer be skipped",
      });
    }

    entry.status = "skipped";
    entry.completedAt = new Date();
    await entry.save();

    await notifyUser(entry.patient, {
      type: "queue-update",
      title: "Patient skipped",
      message:
        "You were skipped in the queue. Please contact the reception desk if you are still waiting.",
      meta: { queueEntryId: String(entry._id) },
    });

    await broadcastQueue(req.app, entry.doctor, entry.date);

    const queue = await getDoctorQueue(entry.doctor, entry.date);

    return res.json({
      success: true,
      message: "Patient skipped",
      entry,
      queue,
    });
  } catch (error) {
    console.error("Skip entry error:", error);
    return res.status(500).json({ success: false, message: "Failed to skip patient" });
  }
}

async function markNoShow(req, res) {
  try {
    const { entry, error } = await getAuthorizedEntry(req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (!["waiting", "called", "in-progress"].includes(entry.status)) {
      return res.status(400).json({
        success: false,
        message: "This queue entry can no longer be marked as a no-show",
      });
    }

    entry.status = "no-show";
    entry.completedAt = new Date();
    await entry.save();

    if (entry.appointment) {
      await Appointment.findByIdAndUpdate(entry.appointment, {
        status: "no-show",
        isActive: false,
      });
    }

    await notifyUser(entry.patient, {
      type: "cancellation",
      title: "Marked as no-show",
      message: `Token #${entry.tokenNumber} was marked as a no-show.`,
      meta: { queueEntryId: String(entry._id) },
    });

    await broadcastQueue(req.app, entry.doctor, entry.date);

    const queue = await getDoctorQueue(entry.doctor, entry.date);

    return res.json({
      success: true,
      message: "Marked as no-show",
      entry,
      queue,
    });
  } catch (error) {
    console.error("No-show error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark no-show",
    });
  }
}

async function display(req, res) {
  try {
    const data = await getDisplayData(req.query.date || formatDate());
    return res.json({ success: true, display: data });
  } catch (error) {
    console.error("Display error:", error);
    return res.status(500).json({ success: false, message: "Failed to load display" });
  }
}

module.exports = {
  checkIn,
  walkIn,
  getQueue,
  getMyStatus,
  callNext,
  startConsultation,
  completeEntry,
  skipEntry,
  markNoShow,
  display,
};
