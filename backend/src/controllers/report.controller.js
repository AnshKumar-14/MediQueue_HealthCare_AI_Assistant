const Appointment = require("../models/Appointment");
const QueueEntry = require("../models/QueueEntry");
const User = require("../models/User");
const { formatDate } = require("../utils/queue");

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

async function summary(req, res) {
  try {
    const from = req.query.from || dateOffset(-30);
    const to = req.query.to || formatDate();
    const doctorId = req.user.role === "doctor" ? req.user.id : req.query.doctorId;

    const appointmentFilter = { date: { $gte: from, $lte: to } };
    const queueFilter = { date: { $gte: from, $lte: to } };

    if (doctorId) {
      appointmentFilter.doctor = doctorId;
      queueFilter.doctor = doctorId;
    }

    const [appointments, queueEntries, doctors] = await Promise.all([
      Appointment.find(appointmentFilter)
        .populate("doctor", "name specialty")
        .lean(),
      QueueEntry.find(queueFilter).lean(),
      User.find({ role: "doctor", status: "approved" }).select("name specialty").lean(),
    ]);

    const completedAppointments = appointments.filter(
      (appointment) => appointment.status === "completed"
    );
    const cancelled = appointments.filter(
      (appointment) => appointment.status === "cancelled"
    );
    const noShow = appointments.filter(
      (appointment) => appointment.status === "no-show"
    );

    const waitTimes = queueEntries
      .filter((entry) => entry.checkedInAt && entry.startedAt)
      .map(
        (entry) =>
          (new Date(entry.startedAt).getTime() -
            new Date(entry.checkedInAt).getTime()) /
          60000
      );

    const consultTimes = queueEntries
      .filter((entry) => entry.startedAt && entry.completedAt)
      .map(
        (entry) =>
          (new Date(entry.completedAt).getTime() -
            new Date(entry.startedAt).getTime()) /
          60000
      );

    const avg = (values) =>
      values.length
        ? Math.round(
            (values.reduce((sum, value) => sum + value, 0) / values.length) * 10
          ) / 10
        : 0;

    const peakHourMap = new Map();
    for (const appointment of appointments) {
      const hour = appointment.startTime?.split(":")[0];
      if (hour === undefined) continue;
      peakHourMap.set(hour, (peakHourMap.get(hour) || 0) + 1);
    }

    const peakHours = [...peakHourMap.entries()]
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => Number(a.hour.split(":")[0]) - Number(b.hour.split(":")[0]));

    const doctorLoadMap = new Map();
    for (const appointment of appointments) {
      const id = String(appointment.doctor?._id || appointment.doctor);
      const name = appointment.doctor?.name || "Unknown doctor";
      if (!doctorLoadMap.has(id)) {
        doctorLoadMap.set(id, { doctorId: id, name, total: 0, completed: 0 });
      }
      const item = doctorLoadMap.get(id);
      item.total += 1;
      if (appointment.status === "completed") item.completed += 1;
    }

    const dailyMap = new Map();
    for (const appointment of appointments) {
      dailyMap.set(appointment.date, (dailyMap.get(appointment.date) || 0) + 1);
    }

    const dailyTrend = [...dailyMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const noShowRate = appointments.length
      ? Math.round((noShow.length / appointments.length) * 1000) / 10
      : 0;

    return res.json({
      success: true,
      range: { from, to },
      totals: {
        appointments: appointments.length,
        completed: completedAppointments.length,
        cancelled: cancelled.length,
        noShow: noShow.length,
        noShowRate,
        queueEntries: queueEntries.length,
        patientsWaiting: queueEntries.filter((entry) =>
          ["waiting", "called", "in-progress"].includes(entry.status)
        ).length,
      },
      averages: {
        waitMinutes: avg(waitTimes),
        consultationMinutes: avg(consultTimes),
      },
      peakHours,
      doctorLoad: [...doctorLoadMap.values()].sort((a, b) => b.total - a.total),
      dailyTrend,
      doctors: doctors.map((doctor) => ({
        _id: doctor._id,
        name: doctor.name,
        specialty: doctor.specialty,
      })),
    });
  } catch (error) {
    console.error("Report summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
}

module.exports = { summary };
