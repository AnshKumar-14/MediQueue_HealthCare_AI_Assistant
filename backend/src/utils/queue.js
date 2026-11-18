const PRIORITY_WEIGHT = {
  emergency: 0,
  pregnant: 1,
  senior: 1,
  normal: 2,
};

const ACTIVE_QUEUE_STATUSES = ["waiting", "called", "in-progress"];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayFor(dateString) {
  return WEEKDAYS[new Date(`${dateString}T00:00:00`).getDay()];
}

function timeToMinutes(time) {
  if (!time || !time.includes(":")) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function priorityWeight(priority) {
  return PRIORITY_WEIGHT[priority] ?? PRIORITY_WEIGHT.normal;
}

function sortQueueEntries(entries) {
  return [...entries].sort((a, b) => {
    const priorityDiff = priorityWeight(a.priority) - priorityWeight(b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const aTime = new Date(a.checkedInAt || a.createdAt).getTime();
    const bTime = new Date(b.checkedInAt || b.createdAt).getTime();
    if (aTime !== bTime) return aTime - bTime;

    return a.tokenNumber - b.tokenNumber;
  });
}

function generateSlots(availability, dateString, bookedStartTimes = [], stepMinutes = 30) {
  const day = weekdayFor(dateString);
  const dayAvailability = (availability || []).filter(
    (item) => item.day === day && item.startTime && item.endTime
  );

  const booked = new Set(bookedStartTimes);
  const slots = [];

  for (const window of dayAvailability) {
    let cursor = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);

    while (cursor + stepMinutes <= end) {
      const startTime = minutesToTime(cursor);
      const endTime = minutesToTime(cursor + stepMinutes);
      if (!booked.has(startTime)) {
        slots.push({ startTime, endTime, available: true });
      }
      cursor += stepMinutes;
    }
  }

  return slots;
}

module.exports = {
  PRIORITY_WEIGHT,
  ACTIVE_QUEUE_STATUSES,
  formatDate,
  weekdayFor,
  timeToMinutes,
  minutesToTime,
  priorityWeight,
  sortQueueEntries,
  generateSlots,
};
