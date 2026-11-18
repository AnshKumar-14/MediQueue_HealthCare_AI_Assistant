const User = require("../../models/User");
const DoctorProfile = require("../../models/DoctorProfile");
const Department = require("../../models/Department");
const Appointment = require("../../models/Appointment");
const QueueEntry = require("../../models/QueueEntry");
const MedicalRecord = require("../../models/MedicalRecord");
const IntakeSummary = require("../../models/IntakeSummary");
const Reminder = require("../../models/Reminder");
const { formatDate, generateSlots } = require("../../utils/queue");
const {
  getDoctorQueue,
  createQueueEntry,
  broadcastQueue,
} = require("../queue.service");
const { notifyUser, notifyUserMultiChannel } = require("../notification.service");
const { encrypt, decrypt } = require("../../utils/crypto");

const RETENTION_DAYS = Math.max(
  Number(process.env.CHAT_RETENTION_DAYS) || 30,
  1
);

function retentionDate(days = RETENTION_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function formatDateLabel(dateString) {
  if (!dateString) return "";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function userError(message, code = "CHAT_ACTION_FAILED") {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function getDepartments() {
  return Department.find({ isActive: true })
    .select("name location description")
    .sort({ name: 1 })
    .lean();
}

async function findDepartment(value) {
  if (!value) return null;
  if (/^[a-f0-9]{24}$/i.test(String(value))) {
    return Department.findOne({ _id: value, isActive: true }).lean();
  }
  return Department.findOne({
    name: { $regex: `^${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    isActive: true,
  }).lean();
}

async function getDoctorsByDepartment(departmentId) {
  const doctorFilter = { role: "doctor", status: "approved" };
  const users = await User.find(doctorFilter)
    .select("name specialty department")
    .lean();

  const ids = users.map((user) => user._id);
  const profileFilter = { userId: { $in: ids }, profileCompleted: true };
  if (departmentId) profileFilter.department = departmentId;

  const profiles = await DoctorProfile.find(profileFilter)
    .populate("department", "name location")
    .lean();
  const profileMap = new Map(
    profiles.map((profile) => [String(profile.userId), profile])
  );

  return users
    .filter((user) => profileMap.has(String(user._id)))
    .map((user) => {
      const profile = profileMap.get(String(user._id));
      return {
        _id: user._id,
        name: user.name,
        specialty: user.specialty,
        department: profile.department || user.department,
        consultationFee: profile.consultationFee,
        qualification: profile.qualification,
        experience: profile.experience,
        availability: profile.availability,
        avgConsultationMinutes: profile.avgConsultationMinutes,
      };
    });
}

async function getSlots(doctorId, date) {
  const [profile, booked] = await Promise.all([
    DoctorProfile.findOne({ userId: doctorId }).lean(),
    Appointment.find({ doctor: doctorId, date, isActive: true })
      .select("startTime")
      .lean(),
  ]);

  if (!profile?.profileCompleted) return [];
  return generateSlots(
    profile.availability,
    date,
    booked.map((item) => item.startTime),
    30
  );
}

async function getUpcomingAppointments(patientId) {
  return Appointment.find({
    patient: patientId,
    status: { $in: ["booked", "checked-in", "in-queue"] },
    date: { $gte: formatDate() },
  })
    .populate("doctor", "name specialty")
    .populate("department", "name location")
    .sort({ date: 1, startTime: 1 })
    .lean();
}

async function getQueueStatus(patientId) {
  const today = formatDate();
  const entries = await QueueEntry.find({
    patient: patientId,
    date: today,
    status: { $in: ["waiting", "called", "in-progress"] },
  })
    .populate("doctor", "name specialty")
    .populate("department", "name location")
    .lean();

  const statuses = [];
  for (const entry of entries) {
    const queue = await getDoctorQueue(entry.doctor?._id || entry.doctor, today);
    const waiting = queue.waiting.find(
      (item) => String(item._id) === String(entry._id)
    );
    const current =
      String(queue.current?._id) === String(entry._id) ? queue.current : null;
    statuses.push({
      entry,
      doctor: entry.doctor,
      department: entry.department,
      position: waiting?.position ?? null,
      estimatedWaitMinutes: waiting?.estimatedWaitMinutes ?? 0,
      currentToken: queue.current?.tokenNumber ?? null,
      nowServing: current,
      totalWaiting: queue.waiting.length,
    });
  }
  return statuses;
}

async function getVisitHistory(patientId, limit = 5) {
  const records = await MedicalRecord.find({ patient: patientId })
    .populate("doctor", "name specialty")
    .sort({ visitDate: -1 })
    .limit(limit)
    .lean();

  return records.map((record) => ({
    ...record,
    diagnosis: decrypt(record.diagnosis),
    notes: decrypt(record.notes),
    prescription: decrypt(record.prescription),
  }));
}

async function bookAppointmentForPatient({
  patientId,
  doctorId,
  departmentId,
  date,
  startTime,
  reason = "",
  priority = "normal",
  createdBy,
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    throw userError("Please provide a valid date.", "INVALID_DATE");
  }
  if (date < formatDate()) {
    throw userError("Appointments cannot be booked in the past.", "PAST_DATE");
  }

  const [doctor, profile, patient] = await Promise.all([
    User.findOne({ _id: doctorId, role: "doctor", status: "approved" }).lean(),
    DoctorProfile.findOne({ userId: doctorId }).lean(),
    User.findOne({ _id: patientId, role: "patient" }).lean(),
  ]);

  if (!doctor) throw userError("That doctor is not available.", "DOCTOR_NOT_FOUND");
  if (!profile?.profileCompleted) {
    throw userError("That doctor's profile is not complete.", "DOCTOR_NOT_READY");
  }
  if (!patient) throw userError("Patient account was not found.", "PATIENT_NOT_FOUND");

  const department = departmentId || profile.department;
  if (!department) throw userError("The doctor has no department assigned.", "NO_DEPARTMENT");

  const slots = await getSlots(doctorId, date);
  const slot = slots.find((item) => item.startTime === startTime);
  if (!slot) {
    throw userError("That time slot is no longer available.", "SLOT_TAKEN");
  }

  const chosenPriority = ["normal", "senior", "pregnant"].includes(priority)
    ? priority
    : "normal";

  const appointment = await Appointment.create({
    patient: patientId,
    doctor: doctorId,
    department,
    date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    reason,
    priority: chosenPriority,
    status: "booked",
    createdBy: createdBy || patientId,
  });

  const populated = await Appointment.findById(appointment._id)
    .populate("doctor", "name specialty")
    .populate("department", "name location")
    .lean();

  await notifyUserMultiChannel(patientId, {
    type: "booking-confirmation",
    title: "Appointment confirmed",
    message: `Your appointment with ${doctor.name} is booked for ${formatDateLabel(
      date
    )} at ${slot.startTime}.`,
    meta: { appointmentId: String(appointment._id) },
  });

  await User.findByIdAndUpdate(patientId, {
    "chatPreferences.preferredDoctor": doctorId,
    lastChatAt: new Date(),
  });

  return populated;
}

async function rescheduleAppointmentForPatient({
  patientId,
  appointmentId,
  date,
  startTime,
}) {
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patient: patientId,
  });
  if (!appointment) throw userError("Appointment not found.", "NOT_FOUND");
  if (["completed", "cancelled", "no-show"].includes(appointment.status)) {
    throw userError("This appointment can no longer be changed.", "NOT_ACTIVE");
  }
  if (date < formatDate()) {
    throw userError("Appointments cannot be moved to the past.", "PAST_DATE");
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

  if (!slot) throw userError("That time slot is not available.", "SLOT_TAKEN");

  appointment.date = date;
  appointment.startTime = slot.startTime;
  appointment.endTime = slot.endTime;
  appointment.status = "booked";
  appointment.isActive = true;
  await appointment.save();

  const populated = await Appointment.findById(appointment._id)
    .populate("doctor", "name specialty")
    .populate("department", "name location")
    .lean();

  await notifyUser(patientId, {
    type: "queue-update",
    title: "Appointment rescheduled",
    message: `Your appointment is now on ${formatDateLabel(date)} at ${slot.startTime}.`,
    meta: { appointmentId: String(appointment._id) },
  });

  return populated;
}

async function cancelAppointmentForPatient({ patientId, appointmentId, reason = "" }) {
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patient: patientId,
  }).populate("doctor", "name");

  if (!appointment) throw userError("Appointment not found.", "NOT_FOUND");
  if (["completed", "cancelled"].includes(appointment.status)) {
    throw userError(`This appointment is already ${appointment.status}.`, "NOT_ACTIVE");
  }

  appointment.status = "cancelled";
  appointment.isActive = false;
  appointment.cancelledBy = patientId;
  appointment.cancelReason = reason || "Cancelled from chat";
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

  await notifyUser(patientId, {
    type: "cancellation",
    title: "Appointment cancelled",
    message: `Your appointment on ${formatDateLabel(appointment.date)} at ${
      appointment.startTime
    } has been cancelled.`,
    meta: { appointmentId: String(appointment._id) },
  });

  return appointment;
}

async function checkInOwnAppointment({ patientId, appointmentId }) {
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patient: patientId,
  })
    .populate("doctor", "name")
    .populate("department", "name");

  if (!appointment) throw userError("Appointment not found.", "NOT_FOUND");
  if (appointment.date !== formatDate()) {
    throw userError("Check-in is only available on the appointment date.", "NOT_TODAY");
  }
  if (["cancelled", "completed", "no-show"].includes(appointment.status)) {
    throw userError(`This appointment is ${appointment.status}.`, "NOT_ACTIVE");
  }

  const existing = await QueueEntry.findOne({
    appointment: appointment._id,
    status: { $in: ["waiting", "called", "in-progress"] },
  }).lean();
  if (existing) return { entry: existing, already: true };

  const entry = await createQueueEntry({
    patient: patientId,
    doctor: appointment.doctor._id,
    department: appointment.department._id,
    appointment: appointment._id,
    priority: appointment.priority,
    type: "pre-booked",
    createdBy: patientId,
  });

  appointment.status = "checked-in";
  await appointment.save();

  return { entry, appointment, already: false };
}

async function joinWalkInQueue({
  app,
  patientId,
  doctorId,
  suggestedPriority = "normal",
  notes = "",
}) {
  const doctor = await User.findOne({
    _id: doctorId,
    role: "doctor",
    status: "approved",
  }).lean();
  if (!doctor) throw userError("That doctor is not available.", "DOCTOR_NOT_FOUND");

  const profile = await DoctorProfile.findOne({ userId: doctorId }).lean();
  if (!profile?.department) {
    throw userError("This doctor has no department assigned.", "NO_DEPARTMENT");
  }

  const existing = await QueueEntry.findOne({
    patient: patientId,
    doctor: doctorId,
    date: formatDate(),
    status: { $in: ["waiting", "called", "in-progress"] },
  }).lean();

  if (existing) {
    const statuses = await getQueueStatus(patientId);
    const match = statuses.find(
      (item) => String(item.entry._id) === String(existing._id)
    );
    return { entry: existing, already: true, status: match };
  }

  const priority = ["normal", "senior", "pregnant"].includes(suggestedPriority)
    ? suggestedPriority
    : "normal";

  const entry = await createQueueEntry({
    patient: patientId,
    doctor: doctorId,
    department: profile.department,
    priority,
    type: "walk-in",
    notes: `${notes}${
      suggestedPriority && suggestedPriority !== priority
        ? ` | Chat suggested priority: ${suggestedPriority} (staff confirmation pending)`
        : " | Joined remotely from chat"
    }`.trim(),
    createdBy: patientId,
  });

  await broadcastQueue(app, doctorId, entry.date);
  const statuses = await getQueueStatus(patientId);
  const status = statuses.find((item) => String(item.entry._id) === String(entry._id));

  return { entry, doctor, already: false, status };
}

async function saveIntakeSummary({
  conversationId,
  patientId,
  appointmentId,
  doctorId,
  departmentId,
  reason = "",
  symptoms = "",
  duration = "",
  severity = null,
  medications = "",
  allergies = "",
  redFlags = [],
  suggestedDepartment,
  suggestedPriority = "normal",
}) {
  const filter = appointmentId
    ? { patient: patientId, appointment: appointmentId }
    : { patient: patientId, conversation: conversationId };

  const summary = await IntakeSummary.findOneAndUpdate(
    filter,
    {
      conversation: conversationId,
      patient: patientId,
      appointment: appointmentId,
      doctor: doctorId,
      department: departmentId,
      reason: encrypt(reason),
      symptoms: encrypt(symptoms),
      duration: encrypt(duration),
      severity: severity === null ? undefined : severity,
      medications: encrypt(medications),
      allergies: encrypt(allergies),
      redFlags,
      suggestedDepartment,
      suggestedPriority,
      status: "pending",
      doctorVisible: true,
      expiresAt: retentionDate(),
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  if (doctorId) {
    await notifyUser(doctorId, {
      type: "intake",
      title: "New pre-visit intake",
      message:
        "A patient completed a pre-visit summary. Open your intake summaries to review it before the appointment.",
      meta: {
        intakeId: String(summary._id),
        appointmentId: appointmentId ? String(appointmentId) : undefined,
      },
    });
  } else {
    await notifyStaff({
      title: "New pre-visit intake",
      message:
        "A patient completed a pre-visit summary. Review it from the staff dashboard.",
      type: "intake",
      meta: { intakeId: String(summary._id) },
    });
  }

  return summary;
}

async function listIntakesForDoctor(doctorId) {
  return IntakeSummary.find({ doctor: doctorId, doctorVisible: true })
    .populate("patient", "name email phone patientProfile")
    .populate("appointment", "date startTime status")
    .populate("department", "name")
    .sort({ createdAt: -1 })
    .select("+reason +symptoms +duration +medications +allergies +staffNotes")
    .lean();
}

async function listAllIntakes() {
  return IntakeSummary.find({})
    .populate("patient", "name email phone")
    .populate("doctor", "name specialty")
    .populate("appointment", "date startTime status")
    .populate("department", "name")
    .sort({ createdAt: -1 })
    .limit(200)
    .select("+reason +symptoms +duration +medications +allergies +staffNotes")
    .lean();
}

function serializeIntake(summary) {
  return {
    ...summary,
    reason: decrypt(summary.reason),
    symptoms: decrypt(summary.symptoms),
    duration: decrypt(summary.duration),
    medications: decrypt(summary.medications),
    allergies: decrypt(summary.allergies),
    staffNotes: decrypt(summary.staffNotes),
  };
}

async function notifyStaff({
  title,
  message,
  type = "chat-handoff",
  meta = {},
  roles = ["receptionist", "staff", "admin"],
}) {
  const staff = await User.find({
    role: { $in: roles },
    status: "approved",
  })
    .select("_id")
    .lean();

  await Promise.allSettled(
    staff.map((member) =>
      notifyUser(member._id, { type, title, message, meta })
    )
  );
}

async function getPreferences(userId) {
  const user = await User.findById(userId)
    .select("chatPreferences")
    .populate("chatPreferences.preferredDoctor", "name specialty")
    .lean();
  return user?.chatPreferences || {};
}

async function updatePreferences(userId, preferences = {}) {
  const allowed = {};
  if (["en", "hi", "es", "fr", "ar"].includes(preferences.language)) {
    allowed["chatPreferences.language"] = preferences.language;
  }
  if (["in-app", "sms", "email", "whatsapp"].includes(preferences.contactMethod)) {
    allowed["chatPreferences.contactMethod"] = preferences.contactMethod;
  }
  if (preferences.preferredDoctor !== undefined) {
    allowed["chatPreferences.preferredDoctor"] = preferences.preferredDoctor || null;
  }
  if (typeof preferences.medicationReminders === "boolean") {
    allowed["chatPreferences.medicationReminders"] = preferences.medicationReminders;
  }
  if (typeof preferences.followUpReminders === "boolean") {
    allowed["chatPreferences.followUpReminders"] = preferences.followUpReminders;
  }
  if (typeof preferences.voiceReplies === "boolean") {
    allowed["chatPreferences.voiceReplies"] = preferences.voiceReplies;
  }

  await User.findByIdAndUpdate(userId, allowed, { runValidators: true });
  return getPreferences(userId);
}

async function createReminder({
  userId,
  type = "medication",
  title,
  message,
  scheduledFor,
  channel = "in-app",
}) {
  const reminder = await Reminder.create({
    user: userId,
    type,
    title,
    message: encrypt(message),
    scheduledFor,
    channel,
    status: "pending",
    createdBy: userId,
    expiresAt: retentionDate(),
  });

  await User.findByIdAndUpdate(userId, {
    "chatPreferences.medicationReminders": true,
  });

  return reminder;
}

async function listReminders(userId) {
  return Reminder.find({
    user: userId,
    status: { $in: ["pending", "sent"] },
  })
    .sort({ scheduledFor: 1 })
    .limit(50)
    .lean();
}

async function cancelReminder(userId, reminderId) {
  return Reminder.findOneAndUpdate(
    { _id: reminderId, user: userId },
    { status: "cancelled" },
    { new: true }
  );
}

async function acknowledgeReminder(userId, reminderId) {
  return Reminder.findOneAndUpdate(
    {
      _id: reminderId,
      user: userId,
      status: { $in: ["pending", "sent"] },
    },
    { status: "acknowledged", acknowledgedAt: new Date() },
    { new: true }
  ).select("+message");
}

module.exports = {
  RETENTION_DAYS,
  retentionDate,
  formatDateLabel,
  userError,
  getDepartments,
  findDepartment,
  getDoctorsByDepartment,
  getSlots,
  getUpcomingAppointments,
  getQueueStatus,
  getVisitHistory,
  bookAppointmentForPatient,
  rescheduleAppointmentForPatient,
  cancelAppointmentForPatient,
  checkInOwnAppointment,
  joinWalkInQueue,
  saveIntakeSummary,
  listIntakesForDoctor,
  listAllIntakes,
  serializeIntake,
  notifyStaff,
  getPreferences,
  updatePreferences,
  createReminder,
  listReminders,
  cancelReminder,
  acknowledgeReminder,
};
