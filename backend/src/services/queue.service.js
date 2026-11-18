const QueueEntry = require("../models/QueueEntry");
const DoctorProfile = require("../models/DoctorProfile");
const Notification = require("../models/Notification");
const {
  ACTIVE_QUEUE_STATUSES,
  formatDate,
  sortQueueEntries,
} = require("../utils/queue");
const { notifyUser } = require("./notification.service");

const QUEUE_POPULATE = [
  { path: "patient", select: "name email phone patientProfile priority" },
  { path: "doctor", select: "name specialty" },
  { path: "department", select: "name location" },
  { path: "appointment", select: "reason startTime endTime priority status date" },
];

function publicEntry(entry) {
  if (!entry) return null;

  return {
    _id: entry._id,
    tokenNumber: entry.tokenNumber,
    status: entry.status,
    priority: entry.priority,
    type: entry.type,
    notes: entry.notes,
    checkedInAt: entry.checkedInAt,
    calledAt: entry.calledAt,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    patient: entry.patient,
    doctor: entry.doctor,
    department: entry.department,
    appointment: entry.appointment,
    position: entry.position,
    estimatedWaitMinutes: entry.estimatedWaitMinutes,
  };
}

async function getDoctorQueue(doctorId, date = formatDate()) {
  const [entries, profile] = await Promise.all([
    QueueEntry.find({ doctor: doctorId, date })
      .populate(QUEUE_POPULATE)
      .lean(),
    DoctorProfile.findOne({ userId: doctorId }).lean(),
  ]);

  const avgConsultationMinutes = profile?.avgConsultationMinutes || 10;
  const sortedActive = sortQueueEntries(
    entries.filter((entry) => ACTIVE_QUEUE_STATUSES.includes(entry.status))
  );

  const current =
    sortedActive.find(
      (entry) => entry.status === "called" || entry.status === "in-progress"
    ) || null;

  const waiting = sortedActive.filter((entry) => entry.status === "waiting");

  const waitingWithPosition = waiting.map((entry, index) => ({
    ...entry,
    position: index + 1,
    estimatedWaitMinutes:
      (index + (current ? 1 : 0)) * avgConsultationMinutes,
  }));

  const completed = entries
    .filter((entry) => entry.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.updatedAt).getTime() -
        new Date(a.completedAt || a.updatedAt).getTime()
    );

  const skipped = entries.filter((entry) =>
    ["skipped", "no-show", "cancelled"].includes(entry.status)
  );

  const waitTimes = completed
    .filter((entry) => entry.checkedInAt && entry.startedAt)
    .map(
      (entry) =>
        (new Date(entry.startedAt).getTime() -
          new Date(entry.checkedInAt).getTime()) /
        60000
    );

  const avgWaitMinutes = waitTimes.length
    ? Math.round(
        (waitTimes.reduce((sum, value) => sum + value, 0) / waitTimes.length) *
          10
      ) / 10
    : 0;

  return {
    date,
    doctorId: String(doctorId),
    current: publicEntry(current),
    waiting: waitingWithPosition.map(publicEntry),
    completed: completed.map(publicEntry),
    skipped: skipped.map(publicEntry),
    stats: {
      total: entries.length,
      waiting: waiting.length,
      completed: completed.length,
      skipped: skipped.length,
      noShow: entries.filter((entry) => entry.status === "no-show").length,
      avgWaitMinutes,
      avgConsultationMinutes,
    },
  };
}

async function broadcastQueue(app, doctorId, date = formatDate()) {
  const io = app?.get ? app.get("io") : null;
  if (io) {
    io.emit("queue:update", {
      doctorId: doctorId ? String(doctorId) : null,
      date,
      at: Date.now(),
    });
  }
}

async function nextTokenNumber(doctorId, date) {
  const last = await QueueEntry.findOne({ doctor: doctorId, date })
    .sort({ tokenNumber: -1 })
    .select("tokenNumber")
    .lean();

  return (last?.tokenNumber || 0) + 1;
}

async function createQueueEntry({
  patient,
  doctor,
  department,
  appointment = null,
  priority = "normal",
  type = "pre-booked",
  notes = "",
  createdBy = null,
  date = formatDate(),
}) {
  const tokenNumber = await nextTokenNumber(doctor, date);

  const entry = await QueueEntry.create({
    patient,
    doctor,
    department,
    appointment,
    date,
    tokenNumber,
    priority,
    type,
    notes,
    createdBy,
    status: "waiting",
    checkedInAt: new Date(),
  });

  await notifyUser(patient, {
    type: "queue-update",
    title: "Checked in successfully",
    message: `Your token number is #${tokenNumber}. Please wait in the queue.`,
    meta: { queueEntryId: String(entry._id), doctorId: String(doctor) },
  });

  return entry;
}

async function notifyNearTurn(doctorId, date = formatDate()) {
  const queue = await getDoctorQueue(doctorId, date);
  const nextPatients = queue.waiting.slice(0, 2);

  for (const entry of nextPatients) {
    if (!entry.patient?._id) continue;

    const alreadyNotified = await Notification.findOne({
      user: entry.patient._id,
      type: "turn-near",
      "meta.queueEntryId": String(entry._id),
    }).lean();

    if (alreadyNotified) continue;

    await notifyUser(entry.patient._id, {
      type: "turn-near",
      title: "Your turn is near",
      message: `Token #${entry.tokenNumber}: you are position ${entry.position} in the queue (approx. ${entry.estimatedWaitMinutes} min).`,
      meta: { queueEntryId: String(entry._id), doctorId: String(doctorId) },
    });
  }
}

async function getDisplayData(date = formatDate()) {
  const entries = await QueueEntry.find({
    date,
    status: { $in: ["waiting", "called", "in-progress"] },
  })
    .populate(QUEUE_POPULATE)
    .lean();

  const grouped = new Map();

  for (const entry of entries) {
    const doctorId = String(entry.doctor?._id || entry.doctor);
    if (!grouped.has(doctorId)) {
      grouped.set(doctorId, {
        doctor: entry.doctor,
        department: entry.department,
        current: null,
        waiting: [],
      });
    }
    grouped.get(doctorId).waiting.push(entry);
  }

  const doctors = [];

  for (const group of grouped.values()) {
    const sorted = sortQueueEntries(group.waiting);
    const current = sorted.find(
      (entry) => entry.status === "called" || entry.status === "in-progress"
    );
    const waiting = sorted.filter((entry) => entry.status === "waiting");

    doctors.push({
      doctor: group.doctor,
      department: group.department,
      current: current
        ? {
            tokenNumber: current.tokenNumber,
            patientName: current.patient?.name,
            status: current.status,
            calledAt: current.calledAt,
          }
        : null,
      waiting: waiting.map((entry) => ({
        tokenNumber: entry.tokenNumber,
        patientName: entry.patient?.name,
        priority: entry.priority,
        position: waiting.indexOf(entry) + 1,
      })),
      remaining: waiting.length,
    });
  }

  doctors.sort((a, b) =>
    String(a.doctor?.name || "").localeCompare(String(b.doctor?.name || ""))
  );

  return { date, updatedAt: new Date(), doctors };
}

module.exports = {
  QUEUE_POPULATE,
  publicEntry,
  getDoctorQueue,
  broadcastQueue,
  nextTokenNumber,
  createQueueEntry,
  notifyNearTurn,
  getDisplayData,
};
