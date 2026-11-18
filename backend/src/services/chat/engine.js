const tools = require("./tools.service");
const {
  t,
  detectLocale,
  normalizeLocale,
  languageName,
  SUPPORTED_LOCALES,
} = require("./i18n");
const { getClinicInfo, listClinicInfo } = require("./clinic.service");
const {
  detectRedFlags,
  recommendSpecialty,
  suggestPriority,
  parseSeverity,
} = require("./triage.service");
const { encrypt, decrypt } = require("../../utils/crypto");
const { formatDate } = require("../../utils/queue");
const llm = require("./llm");

const REMINDERS_ENABLED = process.env.CHAT_REMINDERS_ENABLED !== "false";
const MAX_OPTIONS = 12;

const PRIORITY_KEYS = {
  normal: "priorityNormal",
  senior: "prioritySenior",
  pregnant: "priorityPregnant",
  emergency: "priorityEmergency",
};

const LANGUAGE_LOOKUP = {
  english: "en",
  hindi: "hi",
  हिन्दी: "hi",
  हिंदी: "hi",
  spanish: "es",
  español: "es",
  espanol: "es",
  french: "fr",
  français: "fr",
  francais: "fr",
  arabic: "ar",
  العربية: "ar",
  عربي: "ar",
};

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const FAQ_RULES = [
  {
    key: "hours",
    patterns: [
      /clinic hours?/i,
      /opening hours?/i,
      /what time.*(open|close)/i,
      /when.*(open|closed)/i,
      /\btimings?\b/i,
      /visiting hours?/i,
      /समय/i,
      /खुला/i,
      /horario/i,
      /horaire/i,
      /الدوام|ساعات/i,
    ],
  },
  {
    key: "parking",
    patterns: [/parking/i, /car park/i, /park my car/i, /पार्किंग/i, /estacionamiento/i, /stationnement/i, /موقف سيارات/i],
  },
  {
    key: "directions",
    patterns: [
      /how (do i|can i) get/i,
      /how to (get|reach)/i,
      /directions?/i,
      /\bmetro\b/i,
      /\bbus\b/i,
      /route to/i,
      /पहुंच/i,
      /रास्ता/i,
      /cómo llegar/i,
      /comment (y )?aller/i,
      /كيف أصل/i,
    ],
  },
  {
    key: "location",
    patterns: [
      /where (are|is) (you|the clinic|the hospital)/i,
      /\baddress\b/i,
      /\blocation\b/i,
      /पता/i,
      /कहाँ/i,
      /dónde está/i,
      /adresse/i,
      /عنوان|أين/i,
    ],
  },
  {
    key: "fees",
    patterns: [
      /\bfees?\b/i,
      /\bcost\b/i,
      /\bprice\b/i,
      /how much/i,
      /charges?/i,
      /consultation fee/i,
      /शुल्क|कीमत/i,
      /tarifa|precio|cuesta/i,
      /tarif|prix|coûte/i,
      /رسوم|تكلفة/i,
    ],
  },
  {
    key: "insurance",
    patterns: [
      /insurance/i,
      /mediclaim/i,
      /cashless/i,
      /coverage/i,
      /बीमा/i,
      /seguro/i,
      /assurance/i,
      /تأمين/i,
    ],
  },
  {
    key: "documents",
    patterns: [
      /documents?/i,
      /what (should|do) i bring/i,
      /what to bring/i,
      /\bids?\b/i,
      /proof/i,
      /दस्तावेज|पहचान/i,
      /documentos|identificación/i,
      /documents|pièce d'identité/i,
      /مستندات|هوية/i,
    ],
  },
  {
    key: "preparation",
    patterns: [
      /prepare|preparation/i,
      /fasting|fast before/i,
      /empty stomach/i,
      /test prep/i,
      /तैयारी|खाली पेट/i,
      /preparar|ayuno/i,
      /préparer|à jeun/i,
      /تحضير|صائم/i,
    ],
  },
  {
    key: "app-help",
    patterns: [
      /\bapp\b/i,
      /website/i,
      /forgot password/i,
      /how (do i|to) (register|log ?in|sign ?in|pay)/i,
      /payment (help|issue)/i,
      /एप|लॉगिन|रजिस्टर/i,
      /aplicación|contraseña/i,
      /application|mot de passe/i,
      /تطبيق|تسجيل الدخول/i,
    ],
  },
  {
    key: "cancellation",
    patterns: [
      /cancel(l)?ation policy/i,
      /how late can i cancel/i,
      /reschedule policy/i,
      /no[- ]show policy/i,
    ],
  },
  {
    key: "pharmacy",
    patterns: [/pharmacy/i, /medicine shop/i, /laboratory/i, /\blab\b/i, /blood test/i, /फार्मेसी|प्रयोगशाला/i, /farmacia|laboratorio/i, /pharmacie|laboratoire/i, /صيدلية|مختبر/i],
  },
  {
    key: "accessibility",
    patterns: [/wheelchair/i, /accessible/i, /disabled/i, /\blift\b/i, /elevator/i],
  },
  {
    key: "wifi",
    patterns: [/\bwifi\b/i, /wi-fi/i, /internet access/i],
  },
];

const GREETING_PATTERNS = [
  /^(hi|hello|hey|good (morning|afternoon|evening))\b/i,
  /^(namaste|namaskar|salaam|salam)\b/i,
  /^(hola|buenos días|bonjour|salut)\b/i,
  /^(مرحبا|السلام عليكم|أهلا)\b/i,
];

const HANDOFF_PATTERNS = [
  /human/i,
  /receptionist/i,
  /real person/i,
  /talk to (someone|a person|staff)/i,
  /speak (to|with) (someone|a person|staff)/i,
  /agent/i,
  /customer (care|support)/i,
  /इंसान|रिसेप्शन/i,
  /persona|recepción/i,
  /quelqu'un|réception/i,
  /شخص|استقبال/i,
];

const SYMPTOM_PATTERNS = [
  /\b(pain|ache|hurts?|fever|cough|cold|headache|nausea|vomit|diarrhea|rash|dizzy|fatigue|sore throat|swelling|bleeding|injur|symptom|sick)\b/i,
  /\b(dard|bukhar|khansi|sirdard|pet|chakkar|ulti|khujli)\b/i,
  /(दर्द|बुखार|खांसी|उल्टी|चक्कर|लक्षण)/i,
  /\b(dolor|fiebre|tos|mareo|náusea|erupción|síntoma)\b/i,
  /\b(douleur|fièvre|toux|vertige|nausée|éruption|symptôme)\b/i,
  /(ألم|حمى|سعال|دوخة|غثيان|طفح|عرض)/i,
];

function norm(text = "") {
  return String(text).trim().toLowerCase();
}

function isYes(text = "") {
  return /^(y|yes|yeah|yep|sure|ok|okay|confirm|confirmed|please do|go ahead|haan|ha|han|sí|si|oui|naam|نعم|أكد|تمام)\b/i.test(
    String(text).trim()
  );
}

function isNo(text = "") {
  return /^(n|no|nope|not now|cancel|stop|don'?t|do not|nahi|na|non|pas maintenant|لا|إلغاء)\b/i.test(
    String(text).trim()
  );
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function getSecure(conversation) {
  if (!conversation?.state?.secure) return {};
  try {
    const parsed = JSON.parse(decrypt(conversation.state.secure));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setSecure(conversation, secure) {
  // Mutate the existing state object instead of replacing it. Callers often hold
  // a reference returned by ensureState(); replacing `conversation.state` would
  // detach that reference and silently drop flow/step changes.
  const state = ensureState(conversation);
  state.secure = encrypt(JSON.stringify(secure || {}));
}

function ensureState(conversation) {
  if (!conversation.state || typeof conversation.state !== "object") {
    conversation.state = {};
  }
  conversation.state.flow = conversation.state.flow || null;
  conversation.state.step = conversation.state.step || null;
  conversation.state.draft = conversation.state.draft || {};
  conversation.state.options = conversation.state.options || [];
  conversation.state.pending = conversation.state.pending || null;
  return conversation.state;
}

function clearFlow(conversation) {
  const state = ensureState(conversation);
  state.flow = null;
  state.step = null;
  state.draft = {};
  state.options = [];
  state.pending = null;
  state.pendingFlow = null;
  state.triageActive = false;
}

function localizedSuggestions(locale, keys) {
  return keys
    .slice(0, 6)
    .map((key) => (key.startsWith("sug") ? t(locale, key) : key));
}

function baseSuggestions(locale) {
  return localizedSuggestions(locale, ["sugBook", "sugQueue", "sugFaq", "sugHandoff"]);
}

function formatTimeLabel(time) {
  if (!time || !time.includes(":")) return time || "";
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 || 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function optionLabel(options) {
  return options
    .slice(0, MAX_OPTIONS)
    .map((option, index) => `${index + 1}. ${option.label}`)
    .join("\n");
}

function chooseOption(text, options) {
  const value = norm(text);
  const numeric = value.match(/^(\d{1,2})\b/) || value.match(/\b(\d{1,2})$/);
  if (numeric) {
    const choice = options[Number(numeric[1]) - 1];
    if (choice) return choice;
  }

  const exact = options.find((option) => norm(option.label) === value);
  if (exact) return exact;

  if (value.length >= 3) {
    return (
      options.find((option) => norm(option.label).includes(value)) ||
      options.find((option) => value.includes(norm(option.label))) ||
      null
    );
  }
  return null;
}

function parseDateText(text) {
  const value = norm(text);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const addDays = (days) => {
    const next = new Date(today);
    next.setDate(next.getDate() + days);
    return formatDate(next);
  };

  if (/\b(today|आज|hoy|aujourd'?hui|اليوم)\b/.test(value)) return addDays(0);
  if (/\b(tomorrow|कल|mañana|demain|غدا|غدًا)\b/.test(value)) return addDays(1);
  if (/day after tomorrow|परसों|pasado mañana|après-demain|بعد غد/.test(value)) {
    return addDays(2);
  }

  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = value.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }

  for (let index = 0; index < WEEKDAYS.length; index += 1) {
    if (new RegExp(`\\b${WEEKDAYS[index]}\\b`, "i").test(value)) {
      const current = today.getDay();
      const diff = (index - current + 7) % 7;
      return addDays(diff === 0 ? 0 : diff);
    }
  }

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  for (let index = 0; index < monthNames.length; index += 1) {
    if (new RegExp(`\\b${monthNames[index]}\\b`, "i").test(value)) {
      const dayMatch = value.match(/\b(\d{1,2})\b/);
      if (!dayMatch) return null;
      const year = today.getFullYear();
      const candidate = new Date(year, index, Number(dayMatch[1]));
      if (candidate < today) candidate.setFullYear(year + 1);
      return formatDate(candidate);
    }
  }

  return null;
}

function parseTimeText(text) {
  const value = norm(text);
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseDateTimeText(text) {
  const parsedDate = parseDateText(text);
  const parsedTime = parseTimeText(text);

  // Require an explicit date or time. Otherwise arbitrary text such as
  // "I want to book an appointment" would silently schedule a 9am reminder.
  if (!parsedDate && !parsedTime) return null;

  const date = parsedDate || formatDate();
  const time = parsedTime || "09:00";
  const result = new Date(`${date}T${time}:00`);
  if (Number.isNaN(result.getTime())) return null;

  const now = new Date();
  if (!parsedDate && result <= now) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

function parsePriority(text, locale) {
  const value = norm(text);
  if (/senior|elderly|वरिष्ठ|mayor|âgé|كبير/.test(value)) return "senior";
  if (/pregnan|गर्भ|embaraz|grossesse|حامل/.test(value)) return "pregnant";
  if (/^(normal|standard|regular|no|none|1)\b/.test(value)) return "normal";
  if (/^(2)\b/.test(value)) return "senior";
  if (/^(3)\b/.test(value)) return "pregnant";
  return null;
}

function priorityLabel(locale, priority) {
  return t(locale, PRIORITY_KEYS[priority] || "priorityNormal");
}

function clinicAnswer(locale, info) {
  return `${info.title}\n\n${info.content}`;
}

function buildBookingSummary(locale, draft, secure) {
  return t(locale, "bookSummary", {
    doctor: draft.doctorName || "-",
    department: draft.departmentName || "-",
    date: tools.formatDateLabel(draft.date),
    time: formatTimeLabel(draft.startTime),
    priority: priorityLabel(locale, draft.priority || "normal"),
    reason: secure.bookingReason || "-",
  });
}

function buildRescheduleSummary(locale, draft) {
  return t(locale, "rescheduleSummary", {
    doctor: draft.doctorName || "-",
    oldDate: tools.formatDateLabel(draft.oldDate),
    oldTime: formatTimeLabel(draft.oldTime),
    date: tools.formatDateLabel(draft.date),
    time: formatTimeLabel(draft.startTime),
  });
}

function buildCancelSummary(locale, draft) {
  return t(locale, "cancelSummary", {
    doctor: draft.doctorName || "-",
    date: tools.formatDateLabel(draft.date),
    time: formatTimeLabel(draft.startTime),
  });
}

function buildWalkInSummary(locale, draft) {
  return t(locale, "walkinConfirm", {
    doctor: draft.doctorName || "-",
    department: draft.departmentName || "-",
    priority: priorityLabel(locale, draft.priority || "normal"),
  });
}

async function handleEmergency({ conversation, user, text, locale, app }) {
  const flags = detectRedFlags(text);
  const secure = getSecure(conversation);
  secure.triage = {
    ...(secure.triage || {}),
    symptomText: text,
    redFlags: flags.map((flag) => flag.label),
    suggestedPriority: "emergency",
  };
  setSecure(conversation, secure);
  clearFlow(conversation);

  if (user?.role === "patient") {
    try {
      await tools.saveIntakeSummary({
        conversationId: conversation._id,
        patientId: user.id,
        reason: "",
        symptoms: text,
        redFlags: flags.map((flag) => flag.label),
        suggestedPriority: "emergency",
      });
    } catch (error) {
      console.error("Emergency intake save failed:", error.message);
    }

    await tools.notifyStaff({
      title: "Urgent chat triage flagged",
      message:
        "A patient chat was flagged for emergency symptoms. Please review the intake summary and contact the patient if appropriate.",
      type: "intake",
      meta: { conversationId: String(conversation._id), channel: conversation.channel },
    });
  }

  return {
    reply: t(locale, "emergency"),
    suggestions: localizedSuggestions(locale, ["sugHandoff", "sugFaq", "sugHours"]),
    intent: "emergency",
    redFlags: flags.map((flag) => flag.key),
  };
}

async function startBooking({ conversation, locale, departmentId = null, triage = null }) {
  const state = ensureState(conversation);
  const secure = getSecure(conversation);
  if (triage) secure.triage = { ...(secure.triage || {}), ...triage };
  setSecure(conversation, secure);

  if (departmentId) {
    return beginDoctorSelection({ conversation, locale, departmentId });
  }

  const departments = await tools.getDepartments();
  if (!departments.length) {
    clearFlow(conversation);
    return {
      reply: t(locale, "notAvailable"),
      suggestions: baseSuggestions(locale),
      intent: "book",
    };
  }

  state.flow = "book";
  state.step = "book-department";
  state.triageActive = Boolean(triage || secure.triage);
  state.options = departments.map((department) => ({
    id: String(department._id),
    name: department.name,
    location: department.location,
    label: `${department.name}${department.location ? ` — ${department.location}` : ""}`,
  }));
  state.draft = {};

  return {
    reply: `${t(locale, "bookAskDepartment")}\n\n${optionLabel(state.options)}`,
    suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
    intent: "book",
  };
}

async function beginDoctorSelection({ conversation, locale, departmentId }) {
  const state = ensureState(conversation);
  const department = await tools.findDepartment(departmentId);
  if (!department) {
    return {
      reply: t(locale, "bookNoDoctors"),
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "book",
    };
  }

  const doctors = await tools.getDoctorsByDepartment(department._id);
  if (!doctors.length) {
    state.flow = "book";
    state.step = "book-department";
    state.options = (await tools.getDepartments()).map((item) => ({
      id: String(item._id),
      name: item.name,
      label: item.name,
    }));
    return {
      reply: `${t(locale, "bookNoDoctors")}\n\n${optionLabel(state.options)}`,
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "book",
    };
  }

  state.flow = "book";
  state.step = "book-doctor";
  state.draft = {
    ...state.draft,
    departmentId: String(department._id),
    departmentName: department.name,
  };
  state.options = doctors.map((doctor) => ({
    id: String(doctor._id),
    name: doctor.name,
    specialty: doctor.specialty,
    fee: doctor.consultationFee,
    label: `${doctor.name} — ${doctor.specialty} · ₹${doctor.consultationFee}`,
  }));

  return {
    reply: `${t(locale, "bookAskDoctor", { department: department.name })}\n\n${optionLabel(
      state.options
    )}`,
    suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
    intent: "book",
  };
}

async function beginReschedule({ conversation, user, locale }) {
  if (!user || user.role !== "patient") {
    return {
      reply: t(locale, "authRequiredShort"),
      suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
      intent: "reschedule",
    };
  }

  const appointments = await tools.getUpcomingAppointments(user.id);
  if (!appointments.length) {
    clearFlow(conversation);
    return {
      reply: t(locale, "rescheduleNoAppointments"),
      suggestions: localizedSuggestions(locale, ["sugBook", "sugHandoff"]),
      intent: "reschedule",
    };
  }

  const state = ensureState(conversation);
  state.flow = "reschedule";
  state.step = "reschedule-select";
  state.options = appointments.map((appointment) => ({
    id: String(appointment._id),
    doctorId: String(appointment.doctor?._id || ""),
    doctorName: appointment.doctor?.name || "Doctor",
    departmentId: String(appointment.department?._id || ""),
    departmentName: appointment.department?.name || "",
    date: appointment.date,
    startTime: appointment.startTime,
    label: `${appointment.doctor?.name || "Doctor"} — ${tools.formatDateLabel(
      appointment.date
    )} at ${formatTimeLabel(appointment.startTime)}`,
  }));

  return {
    reply: `${t(locale, "rescheduleChoose")}\n\n${optionLabel(state.options)}`,
    suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
    intent: "reschedule",
  };
}

async function beginCancel({ conversation, user, locale }) {
  if (!user || user.role !== "patient") {
    return {
      reply: t(locale, "authRequiredShort"),
      suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
      intent: "cancel",
    };
  }

  const appointments = await tools.getUpcomingAppointments(user.id);
  if (!appointments.length) {
    clearFlow(conversation);
    return {
      reply: t(locale, "rescheduleNoAppointments"),
      suggestions: localizedSuggestions(locale, ["sugBook", "sugHandoff"]),
      intent: "cancel",
    };
  }

  const state = ensureState(conversation);
  state.flow = "cancel";
  state.step = "cancel-select";
  state.options = appointments.map((appointment) => ({
    id: String(appointment._id),
    doctorName: appointment.doctor?.name || "Doctor",
    date: appointment.date,
    startTime: appointment.startTime,
    label: `${appointment.doctor?.name || "Doctor"} — ${tools.formatDateLabel(
      appointment.date
    )} at ${formatTimeLabel(appointment.startTime)}`,
  }));

  return {
    reply: `${t(locale, "cancelChoose")}\n\n${optionLabel(state.options)}`,
    suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
    intent: "cancel",
  };
}

async function beginWalkIn({ conversation, user, locale }) {
  if (!user || user.role !== "patient") {
    return {
      reply: t(locale, "authRequiredShort"),
      suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
      intent: "walkin",
    };
  }

  const departments = await tools.getDepartments();
  const state = ensureState(conversation);
  state.flow = "walkin";
  state.step = "walkin-department";
  state.options = departments.map((department) => ({
    id: String(department._id),
    name: department.name,
    label: `${department.name}${department.location ? ` — ${department.location}` : ""}`,
  }));

  return {
    reply: `${t(locale, "walkinAskDepartment")}\n\n${optionLabel(state.options)}`,
    suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
    intent: "walkin",
  };
}

async function beginWalkInDoctor({ conversation, locale, departmentId }) {
  const state = ensureState(conversation);
  const department = await tools.findDepartment(departmentId);
  const doctors = await tools.getDoctorsByDepartment(departmentId);

  if (!department || !doctors.length) {
    return {
      reply: t(locale, "bookNoDoctors"),
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "walkin",
    };
  }

  state.flow = "walkin";
  state.step = "walkin-doctor";
  state.draft = {
    ...state.draft,
    departmentId: String(department._id),
    departmentName: department.name,
  };
  state.options = doctors.map((doctor) => ({
    id: String(doctor._id),
    name: doctor.name,
    specialty: doctor.specialty,
    label: `${doctor.name} — ${doctor.specialty} · ₹${doctor.consultationFee}`,
  }));

  return {
    reply: `${t(locale, "walkinAskDoctor")}\n\n${optionLabel(state.options)}`,
    suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
    intent: "walkin",
  };
}

async function beginTriage({ conversation, locale, initialText = "" }) {
  const state = ensureState(conversation);
  state.flow = "triage";
  state.pendingFlow = null;

  // If the patient already described their symptom in the message that started
  // triage, keep it instead of asking them to repeat themselves.
  const firstSymptom = String(initialText || "").trim();
  if (firstSymptom) {
    const secure = getSecure(conversation);
    secure.triage = { ...(secure.triage || {}), symptomText: firstSymptom };
    setSecure(conversation, secure);
    state.step = "triage-duration";
    return {
      reply: t(locale, "triageAskDuration"),
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "triage",
    };
  }

  state.step = "triage-symptom";
  return {
    reply: `${t(locale, "triageAskSymptom")}\n\n${t(locale, "disclaimer")}`,
    suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
    intent: "triage",
  };
}

async function beginIntake({ conversation, locale }) {
  const state = ensureState(conversation);
  state.flow = "intake";
  state.step = "intake-reason";
  state.pendingFlow = null;
  return {
    reply: `${t(locale, "intakeAskReason")}\n\n${t(locale, "intakeSafety")}`,
    suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
    intent: "intake",
  };
}

async function askConsent({ conversation, locale, pendingFlow }) {
  const state = ensureState(conversation);
  state.flow = "consent";
  state.step = "consent";
  state.pendingFlow = pendingFlow;
  return {
    reply: t(locale, "consentAsk"),
    suggestions: localizedSuggestions(locale, ["sugYes", "sugNo"]),
    intent: "consent",
  };
}

async function handleConsent({ conversation, user, locale, text }) {
  if (isYes(text)) {
    conversation.consent = {
      given: true,
      givenAt: new Date(),
      version: "2026-01",
    };
    const pendingFlow = conversation.state?.pendingFlow;
    clearFlow(conversation);
    if (pendingFlow === "intake") {
      return beginIntake({ conversation, locale });
    }
    return beginTriage({ conversation, locale });
  }

  if (isNo(text)) {
    clearFlow(conversation);
    return {
      reply: t(locale, "consentDeclined"),
      suggestions: baseSuggestions(locale),
      intent: "consent-declined",
    };
  }

  return {
    reply: t(locale, "consentAsk"),
    suggestions: localizedSuggestions(locale, ["sugYes", "sugNo"]),
    intent: "consent",
  };
}

async function executePending({ conversation, user, locale, app, secure }) {
  const state = ensureState(conversation);
  const pending = state.pending;
  if (!pending) return null;

  const draft = state.draft || {};

  try {
    if (pending.type === "book") {
      const appointment = await tools.bookAppointmentForPatient({
        patientId: user.id,
        doctorId: draft.doctorId,
        departmentId: draft.departmentId,
        date: draft.date,
        startTime: draft.startTime,
        reason: secure.bookingReason || "",
        priority: draft.priority || "normal",
        createdBy: user.id,
      });

      const triage = secure.triage || null;
      try {
        await tools.saveIntakeSummary({
          conversationId: conversation._id,
          patientId: user.id,
          appointmentId: appointment._id,
          doctorId: draft.doctorId,
          departmentId: draft.departmentId,
          reason: secure.bookingReason || "",
          symptoms: triage?.symptomText || "",
          duration: triage?.duration || "",
          severity: triage?.severity ?? null,
          medications: secure.intakeMeds || "",
          allergies: secure.intakeAllergies || "",
          redFlags: triage?.redFlags || [],
          suggestedDepartment: draft.departmentId,
          suggestedPriority: triage?.suggestedPriority || draft.priority || "normal",
        });
      } catch (error) {
        console.error("Intake save after booking failed:", error.message);
      }

      clearFlow(conversation);
      delete secure.triage;
      delete secure.bookingReason;
      setSecure(conversation, secure);

      return {
        reply: t(locale, "bookConfirmed", {
          doctor: appointment.doctor?.name || draft.doctorName,
          department: appointment.department?.name || draft.departmentName,
          date: tools.formatDateLabel(appointment.date),
          time: formatTimeLabel(appointment.startTime),
          id: String(appointment._id).slice(-6).toUpperCase(),
        }),
        suggestions: localizedSuggestions(locale, [
          "sugMyAppointments",
          "sugQueue",
          "sugIntake",
          "sugFaq",
        ]),
        intent: "book-confirmed",
      };
    }

    if (pending.type === "reschedule") {
      const appointment = await tools.rescheduleAppointmentForPatient({
        patientId: user.id,
        appointmentId: draft.appointmentId,
        date: draft.date,
        startTime: draft.startTime,
      });

      clearFlow(conversation);
      return {
        reply: t(locale, "rescheduled", {
          doctor: appointment.doctor?.name || draft.doctorName,
          date: tools.formatDateLabel(appointment.date),
          time: formatTimeLabel(appointment.startTime),
        }),
        suggestions: localizedSuggestions(locale, [
          "sugMyAppointments",
          "sugQueue",
          "sugFaq",
        ]),
        intent: "rescheduled",
      };
    }

    if (pending.type === "cancel") {
      await tools.cancelAppointmentForPatient({
        patientId: user.id,
        appointmentId: draft.appointmentId,
        reason: "Cancelled from chat",
      });

      clearFlow(conversation);
      return {
        reply: t(locale, "cancelled", {
          doctor: draft.doctorName,
          date: tools.formatDateLabel(draft.date),
          time: formatTimeLabel(draft.startTime),
        }),
        suggestions: localizedSuggestions(locale, [
          "sugBook",
          "sugMyAppointments",
          "sugFaq",
        ]),
        intent: "cancelled",
      };
    }

    if (pending.type === "walkin") {
      const result = await tools.joinWalkInQueue({
        app,
        patientId: user.id,
        doctorId: draft.doctorId,
        suggestedPriority: draft.priority || "normal",
        notes: "Remote walk-in via chat",
      });

      const status = result.status || {};
      clearFlow(conversation);

      if (result.already) {
        return {
          reply: t(locale, "walkinExisting", {
            doctor: draft.doctorName,
            token: result.entry.tokenNumber,
            position: status.position ?? "-",
            wait: status.estimatedWaitMinutes ?? 0,
          }),
          suggestions: localizedSuggestions(locale, ["sugQueue", "sugMyAppointments", "sugFaq"]),
          intent: "walkin-existing",
        };
      }

      return {
        reply: t(locale, "walkinJoined", {
          token: result.entry.tokenNumber,
          position: status.position ?? "-",
          wait: status.estimatedWaitMinutes ?? 0,
        }),
        suggestions: localizedSuggestions(locale, ["sugQueue", "sugMyAppointments", "sugFaq"]),
        intent: "walkin-joined",
      };
    }

    if (pending.type === "checkin") {
      const result = await tools.checkInOwnAppointment({
        patientId: user.id,
        appointmentId: draft.appointmentId,
      });
      const statuses = await tools.getQueueStatus(user.id);
      const match = statuses.find(
        (item) => String(item.entry._id) === String(result.entry._id)
      );
      clearFlow(conversation);
      return {
        reply: t(locale, "queueCheckedIn", {
          token: result.entry.tokenNumber,
          ahead: match?.position ? Math.max(0, match.position - 1) : 0,
          wait: match?.estimatedWaitMinutes ?? 0,
        }),
        suggestions: localizedSuggestions(locale, ["sugQueue", "sugMyAppointments", "sugFaq"]),
        intent: "queue-checked-in",
      };
    }
  } catch (error) {
    console.error("Chat action failed:", error);
    clearFlow(conversation);
    const key =
      pending.type === "reschedule"
        ? "rescheduleFailed"
        : pending.type === "cancel"
          ? "cancelFailed"
          : pending.type === "walkin"
            ? "walkinFailed"
            : "bookFailed";
    return {
      reply: t(locale, key, { error: error.message || "unknown error" }),
      suggestions: localizedSuggestions(locale, ["sugBook", "sugHandoff", "sugRestart"]),
      intent: `${pending.type}-failed`,
    };
  }

  return null;
}

async function handlePendingInput({ conversation, user, locale, text, app, secure }) {
  const state = ensureState(conversation);
  const pending = state.pending;
  const draft = state.draft || {};

  if (isNo(text)) {
    clearFlow(conversation);
    return {
      reply: t(locale, "bookCancelled"),
      suggestions: baseSuggestions(locale),
      intent: `${pending.type}-cancelled`,
    };
  }

  if (isYes(text)) {
    return executePending({ conversation, user, locale, app, secure });
  }

  if (/changes?|edit|modify|बदल|cambiar|modifier|تغيير/i.test(text)) {
    if (pending.type === "book") {
      const value = norm(text);
      if (/doctor|डॉक्टर|médico|médecin|طبيب/.test(value)) {
        state.pending = null;
        return beginDoctorSelection({
          conversation,
          locale,
          departmentId: draft.departmentId,
        });
      }
      if (/date|day|तारीख|fecha|date|تاريخ/.test(value)) {
        state.pending = null;
        state.step = "book-date";
        return {
          reply: t(locale, "bookAskDate"),
          suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
          intent: "book",
        };
      }
      if (/time|slot|समय|hora|heure|وقت/.test(value)) {
        state.pending = null;
        state.step = "book-slot";
        return {
          reply: `${t(locale, "bookAskSlot", {
            date: tools.formatDateLabel(draft.date),
            doctor: draft.doctorName,
          })}\n\n${optionLabel(state.options)}`,
          suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
          intent: "book",
        };
      }
      if (/reason|कारण|motivo|raison|سبب/.test(value)) {
        state.pending = null;
        state.step = "book-reason";
        return {
          reply: t(locale, "bookAskReason"),
          suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
          intent: "book",
        };
      }
      return {
        reply: t(locale, "bookChange"),
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: "book",
      };
    }

    return {
      reply: t(locale, "bookCancelled"),
      suggestions: baseSuggestions(locale),
      intent: `${pending.type}-cancelled`,
    };
  }

  const summary =
    pending.type === "book"
      ? buildBookingSummary(locale, draft, secure)
      : pending.type === "reschedule"
        ? buildRescheduleSummary(locale, draft)
        : pending.type === "cancel"
          ? buildCancelSummary(locale, draft)
          : pending.type === "walkin"
            ? buildWalkInSummary(locale, draft)
            : t(locale, "queueCheckInAsk", { doctor: draft.doctorName });

  const confirmKey =
    pending.type === "book"
      ? "bookConfirm"
      : pending.type === "reschedule"
        ? "rescheduleConfirm"
        : pending.type === "cancel"
          ? "cancelConfirm"
          : "bookConfirm";

  return {
    reply: `${summary}\n\n${t(locale, confirmKey)}`,
    suggestions: localizedSuggestions(locale, ["sugYes", "sugNo", "sugChange"]),
    intent: `${pending.type}-confirm`,
  };
}

async function handleFlow({ conversation, user, locale, text, app, secure }) {
  const state = ensureState(conversation);
  const step = state.step;
  const draft = state.draft;

  // The reminder flow captures free text, so let an obvious question or command
  // escape instead of being stored as a reminder message.
  if (state.flow === "reminder") {
    const value = norm(text);
    if (
      /^(restart|start over|cancel|stop)\b/.test(value) ||
      /my appointments?|upcoming appointments?|book (an )?appointment|queue|opening hours?|clinic hours?|talk to a (person|human)|human|agent/.test(
        value
      )
    ) {
      clearFlow(conversation);
      return null;
    }
  }

  if (step === "consent") {
    return handleConsent({ conversation, user, locale, text });
  }

  if (step === "triage-symptom") {
    state.step = "triage-duration";
    secure.triage = { ...(secure.triage || {}), symptomText: text };
    setSecure(conversation, secure);
    return {
      reply: t(locale, "triageAskDuration"),
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "triage",
    };
  }

  if (step === "triage-duration") {
    state.step = "triage-severity";
    secure.triage = { ...(secure.triage || {}), duration: text };
    setSecure(conversation, secure);
    return {
      reply: t(locale, "triageAskSeverity"),
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "triage",
    };
  }

  if (step === "triage-severity") {
    const severity = parseSeverity(text);
    const triage = secure.triage || {};
    const symptomText = `${triage.symptomText || ""} ${text}`;
    const departmentName = recommendSpecialty(symptomText);
    const priority = suggestPriority(symptomText, user?.patientProfile);
    const department = await tools.findDepartment(departmentName);

    secure.triage = {
      ...triage,
      severity: severity ?? 5,
      suggestedDepartment: departmentName,
      suggestedDepartmentId: department ? String(department._id) : null,
      suggestedPriority: priority,
      redFlags: triage.redFlags || [],
    };
    setSecure(conversation, secure);

    try {
      await tools.saveIntakeSummary({
        conversationId: conversation._id,
        patientId: user.id,
        reason: "",
        symptoms: triage.symptomText || "",
        duration: triage.duration || "",
        severity: severity ?? 5,
        redFlags: triage.redFlags || [],
        suggestedDepartment: department?._id,
        suggestedPriority: priority,
      });
    } catch (error) {
      console.error("Triage intake save failed:", error.message);
    }

    state.flow = "triage";
    state.step = "triage-offer";
    state.triageActive = true;

    return {
      reply: t(locale, "triageResult", {
        department: departmentName,
        priority: priorityLabel(locale, priority),
        disclaimer: t(locale, "disclaimer"),
      }),
      suggestions: [
        t(locale, "sugYes"),
        t(locale, "sugNo"),
        t(locale, "sugHandoff"),
      ],
      intent: "triage-result",
    };
  }

  if (step === "triage-offer") {
    if (isYes(text)) {
      const department = await tools.findDepartment(secure.triage?.suggestedDepartment);
      if (!department) {
        clearFlow(conversation);
        return {
          reply: t(locale, "notAvailable"),
          suggestions: baseSuggestions(locale),
          intent: "triage",
        };
      }
      return startBooking({
        conversation,
        locale,
        departmentId: String(department._id),
        triage: secure.triage,
      });
    }

    clearFlow(conversation);
    return {
      reply: t(locale, "bye"),
      suggestions: baseSuggestions(locale),
      intent: "triage-declined",
    };
  }

  if (step === "book-department") {
    const choice =
      chooseOption(text, state.options) ||
      (await tools.getDepartments()).find((department) =>
        norm(department.name).includes(norm(text))
      );
    const departmentId = choice?.id || choice?._id;

    if (!departmentId) {
      return {
        reply: `${t(locale, "bookInvalidChoice")}\n\n${optionLabel(state.options)}`,
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: "book",
      };
    }

    return beginDoctorSelection({ conversation, locale, departmentId });
  }

  if (step === "book-doctor") {
    const choice = chooseOption(text, state.options);
    if (!choice) {
      return {
        reply: `${t(locale, "bookInvalidChoice")}\n\n${optionLabel(state.options)}`,
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: "book",
      };
    }

    draft.doctorId = choice.id;
    draft.doctorName = choice.name;
    state.step = "book-date";

    return {
      reply: t(locale, "bookAskDate"),
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "book",
    };
  }

  if (step === "book-date" || step === "reschedule-date") {
    const date = parseDateText(text);
    if (!date || date < formatDate()) {
      return {
        reply: t(locale, "bookInvalidDate"),
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: state.flow,
      };
    }

    const slots = await tools.getSlots(draft.doctorId, date);
    if (!slots.length) {
      return {
        reply: t(locale, "bookNoSlots"),
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: state.flow,
      };
    }

    draft.date = date;
    state.options = slots.slice(0, MAX_OPTIONS).map((slot) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: formatTimeLabel(slot.startTime),
    }));
    state.step = state.flow === "reschedule" ? "reschedule-slot" : "book-slot";

    return {
      reply: `${t(locale, "bookAskSlot", {
        date: tools.formatDateLabel(date),
        doctor: draft.doctorName,
      })}\n\n${optionLabel(state.options)}`,
      suggestions: localizedSuggestions(locale, ["sugRestart"]),
      intent: state.flow,
    };
  }

  if (step === "book-slot" || step === "reschedule-slot") {
    const time = parseTimeText(text);
    const byTime = time
      ? state.options.find((option) => option.startTime === time)
      : null;
    const choice = byTime || chooseOption(text, state.options);

    if (!choice) {
      return {
        reply: `${t(locale, "bookInvalidSlot")}\n\n${optionLabel(state.options)}`,
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: state.flow,
      };
    }

    draft.startTime = choice.startTime;

    if (state.flow === "reschedule") {
      state.pending = { type: "reschedule" };
      state.step = "reschedule-confirm";
      return {
        reply: `${buildRescheduleSummary(locale, draft)}\n\n${t(
          locale,
          "rescheduleConfirm"
        )}`,
        suggestions: localizedSuggestions(locale, ["sugYes", "sugNo", "sugChange"]),
        intent: "reschedule-confirm",
      };
    }

    state.step = "book-priority";
    return {
      reply: t(locale, "bookAskPriority"),
      suggestions: [
        t(locale, "priorityNormal"),
        t(locale, "prioritySenior"),
        t(locale, "priorityPregnant"),
      ],
      intent: "book",
    };
  }

  if (step === "book-priority") {
    draft.priority = parsePriority(text, locale) || "normal";
    state.step = "book-reason";
    return {
      reply: t(locale, "bookAskReason"),
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "book",
    };
  }

  if (step === "book-reason") {
    secure.bookingReason = text;
    setSecure(conversation, secure);
    state.pending = { type: "book" };
    state.step = "book-confirm";
    return {
      reply: `${buildBookingSummary(locale, draft, secure)}\n\n${t(locale, "bookConfirm")}`,
      suggestions: localizedSuggestions(locale, ["sugYes", "sugNo", "sugChange"]),
      intent: "book-confirm",
    };
  }

  if (step === "reschedule-select") {
    const choice = chooseOption(text, state.options);
    if (!choice) {
      return {
        reply: `${t(locale, "bookInvalidChoice")}\n\n${optionLabel(state.options)}`,
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: "reschedule",
      };
    }
    draft.appointmentId = choice.id;
    draft.doctorId = choice.doctorId;
    draft.doctorName = choice.doctorName;
    draft.departmentId = choice.departmentId;
    draft.departmentName = choice.departmentName;
    draft.oldDate = choice.date;
    draft.oldTime = choice.startTime;
    state.step = "reschedule-date";
    return {
      reply: t(locale, "rescheduleAskDate", { doctor: draft.doctorName }),
      suggestions: localizedSuggestions(locale, ["sugRestart", "sugHandoff"]),
      intent: "reschedule",
    };
  }

  if (step === "cancel-select") {
    const choice = chooseOption(text, state.options);
    if (!choice) {
      return {
        reply: `${t(locale, "bookInvalidChoice")}\n\n${optionLabel(state.options)}`,
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: "cancel",
      };
    }
    draft.appointmentId = choice.id;
    draft.doctorName = choice.doctorName;
    draft.date = choice.date;
    draft.startTime = choice.startTime;
    state.pending = { type: "cancel" };
    state.step = "cancel-confirm";
    return {
      reply: `${buildCancelSummary(locale, draft)}\n\n${t(locale, "cancelConfirm")}`,
      suggestions: localizedSuggestions(locale, ["sugYes", "sugNo"]),
      intent: "cancel-confirm",
    };
  }

  if (step === "walkin-department") {
    const choice = chooseOption(text, state.options);
    if (!choice) {
      return {
        reply: `${t(locale, "bookInvalidChoice")}\n\n${optionLabel(state.options)}`,
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: "walkin",
      };
    }
    return beginWalkInDoctor({ conversation, locale, departmentId: choice.id });
  }

  if (step === "walkin-doctor") {
    const choice = chooseOption(text, state.options);
    if (!choice) {
      return {
        reply: `${t(locale, "bookInvalidChoice")}\n\n${optionLabel(state.options)}`,
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: "walkin",
      };
    }
    draft.doctorId = choice.id;
    draft.doctorName = choice.name;
    const triage = secure.triage || {};
    draft.priority =
      triage.suggestedPriority || suggestPriority("", user?.patientProfile) || "normal";
    state.pending = { type: "walkin" };
    state.step = "walkin-confirm";
    return {
      reply: `${buildWalkInSummary(locale, draft)}\n\n${t(locale, "bookConfirm")}`,
      suggestions: localizedSuggestions(locale, ["sugYes", "sugNo", "sugChange"]),
      intent: "walkin-confirm",
    };
  }

  if (step === "intake-reason") {
    secure.intakeReason = text;
    setSecure(conversation, secure);
    state.step = "intake-symptoms";
    return {
      reply: t(locale, "intakeAskSymptoms"),
      suggestions: localizedSuggestions(locale, ["sugHandoff"]),
      intent: "intake",
    };
  }

  if (step === "intake-symptoms") {
    secure.intakeSymptoms = text;
    setSecure(conversation, secure);
    state.step = "intake-duration";
    return {
      reply: t(locale, "intakeAskDuration"),
      suggestions: localizedSuggestions(locale, ["sugHandoff"]),
      intent: "intake",
    };
  }

  if (step === "intake-duration") {
    secure.intakeDuration = text;
    setSecure(conversation, secure);
    state.step = "intake-meds";
    return {
      reply: t(locale, "intakeAskMeds"),
      suggestions: ["None", t(locale, "sugHandoff")],
      intent: "intake",
    };
  }

  if (step === "intake-meds") {
    secure.intakeMeds = /^(none|no|नहीं|ninguno|aucun|لا شيء)$/i.test(text.trim())
      ? ""
      : text;
    setSecure(conversation, secure);
    state.step = "intake-allergies";
    return {
      reply: t(locale, "intakeAskAllergies"),
      suggestions: ["None", t(locale, "sugHandoff")],
      intent: "intake",
    };
  }

  if (step === "intake-allergies") {
    secure.intakeAllergies = /^(none|no|नहीं|ninguna|aucune|لا)$/i.test(text.trim())
      ? ""
      : text;
    setSecure(conversation, secure);

    const upcoming = await tools.getUpcomingAppointments(user.id);
    const next = upcoming[0];
    await tools.saveIntakeSummary({
      conversationId: conversation._id,
      patientId: user.id,
      appointmentId: next?._id,
      doctorId: next?.doctor?._id,
      departmentId: next?.department?._id,
      reason: secure.intakeReason || "",
      symptoms: secure.intakeSymptoms || "",
      duration: secure.intakeDuration || "",
      medications: secure.intakeMeds || "",
      allergies: secure.intakeAllergies || "",
      suggestedPriority: suggestPriority(
        `${secure.intakeReason || ""} ${secure.intakeSymptoms || ""}`,
        user?.patientProfile
      ),
    });

    clearFlow(conversation);
    return {
      reply: t(locale, "intakeSaved"),
      suggestions: localizedSuggestions(locale, ["sugMyAppointments", "sugBook", "sugHandoff"]),
      intent: "intake-saved",
    };
  }

  if (step === "reminder-type") {
    secure.reminderType = /follow|फॉलो|seguimiento|suivi|متابعة/i.test(text)
      ? "follow-up"
      : "medication";
    setSecure(conversation, secure);
    state.step = "reminder-what";
    return {
      reply: t(locale, "remindAskWhat"),
      suggestions: localizedSuggestions(locale, ["sugRestart"]),
      intent: "reminder",
    };
  }

  if (step === "reminder-what") {
    secure.reminderMessage = text;
    secure.reminderTitle =
      secure.reminderType === "follow-up" ? "Follow-up reminder" : "Medication reminder";
    setSecure(conversation, secure);
    state.step = "reminder-when";
    return {
      reply: t(locale, "remindAskWhen"),
      suggestions: localizedSuggestions(locale, ["sugRestart"]),
      intent: "reminder",
    };
  }

  if (step === "reminder-when") {
    const when = parseDateTimeText(text);
    if (!when) {
      return {
        reply: t(locale, "remindAskWhen"),
        suggestions: localizedSuggestions(locale, ["sugRestart"]),
        intent: "reminder",
      };
    }

    await tools.createReminder({
      userId: user.id,
      type: secure.reminderType || "medication",
      title: secure.reminderTitle || "Reminder",
      message: secure.reminderMessage || "",
      scheduledFor: when,
      channel: user.chatPreferences?.contactMethod || "in-app",
    });

    const whenLabel = when.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    clearFlow(conversation);
    return {
      reply: t(locale, "reminderCreated", {
        when: whenLabel,
        channel: user.chatPreferences?.contactMethod || "in-app",
      }),
      suggestions: localizedSuggestions(locale, ["sugMyAppointments", "sugFaq"]),
      intent: "reminder-created",
    };
  }

  return null;
}

async function handleQueue({ conversation, user, locale }) {
  if (!user || user.role !== "patient") {
    return {
      reply: t(locale, "authRequiredShort"),
      suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
      intent: "queue",
    };
  }

  const statuses = await tools.getQueueStatus(user.id);
  if (!statuses.length) {
    const upcoming = await tools.getUpcomingAppointments(user.id);
    const today = formatDate();
    const todayAppointment = upcoming.find((appointment) => appointment.date === today);

    if (todayAppointment) {
      const state = ensureState(conversation);
      state.flow = "queue-checkin";
      state.step = "queue-checkin-confirm";
      state.pending = { type: "checkin" };
      state.draft = {
        appointmentId: String(todayAppointment._id),
        doctorName: todayAppointment.doctor?.name || "your doctor",
      };
      return {
        reply: `${t(locale, "queueCheckInAsk", {
          doctor: todayAppointment.doctor?.name || "your doctor",
        })}\n\n${t(locale, "bookConfirm")}`,
        suggestions: localizedSuggestions(locale, ["sugYes", "sugNo"]),
        intent: "queue-checkin",
      };
    }

    return {
      reply: t(locale, "queueNone"),
      suggestions: baseSuggestions(locale),
      intent: "queue",
    };
  }

  const lines = statuses.map((status) => {
    if (status.nowServing) {
      return t(locale, "queueTurn", {
        token: status.entry.tokenNumber,
        doctor: status.doctor?.name || "your doctor",
      });
    }
    return t(locale, "queueStatus", {
      doctor: status.doctor?.name || "your doctor",
      token: status.entry.tokenNumber,
      current: status.currentToken ? `#${status.currentToken}` : "-",
      position: status.position ?? "-",
      wait: status.estimatedWaitMinutes ?? 0,
      status: status.entry.status,
    });
  });

  return {
    reply: lines.join("\n\n"),
    suggestions: localizedSuggestions(locale, [
      "sugMyAppointments",
      "sugFaq",
      "sugHandoff",
    ]),
    intent: "queue",
  };
}

async function handleAppointments({ user, locale }) {
  if (!user || user.role !== "patient") {
    return {
      reply: t(locale, "authRequiredShort"),
      suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
      intent: "appointments",
    };
  }

  const appointments = await tools.getUpcomingAppointments(user.id);
  if (!appointments.length) {
    return {
      reply: t(locale, "appointmentsNone"),
      suggestions: localizedSuggestions(locale, ["sugBook", "sugTriage"]),
      intent: "appointments",
    };
  }

  const lines = appointments.map((appointment, index) =>
    t(locale, "appointmentLine", {
      number: index + 1,
      doctor: appointment.doctor?.name || "Doctor",
      date: tools.formatDateLabel(appointment.date),
      time: formatTimeLabel(appointment.startTime),
      status: appointment.status,
    })
  );

  return {
    reply: `${t(locale, "appointmentsHeader")}\n\n${lines.join("\n")}`,
    suggestions: localizedSuggestions(locale, [
      "sugQueue",
      "sugFaq",
      "sugHandoff",
    ]).concat([t(locale, "sugRestart")]).slice(0, 6),
    intent: "appointments",
  };
}

async function handleHistory({ user, locale }) {
  if (!user || user.role !== "patient") {
    return {
      reply: t(locale, "authRequiredShort"),
      suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
      intent: "history",
    };
  }

  const records = await tools.getVisitHistory(user.id, 5);
  if (!records.length) {
    return {
      reply: t(locale, "historyNone"),
      suggestions: baseSuggestions(locale),
      intent: "history",
    };
  }

  const lines = records.map((record, index) =>
    t(locale, "historyLine", {
      number: index + 1,
      date: new Date(record.visitDate).toLocaleDateString(),
      doctor: record.doctor?.name || "Doctor",
      diagnosis: record.diagnosis || "No diagnosis recorded",
    })
  );

  return {
    reply: `${t(locale, "historyHeader")}\n\n${lines.join("\n")}`,
    suggestions: baseSuggestions(locale),
    intent: "history",
  };
}

async function handleDoctorAvailability({ locale, text }) {
  const departments = await tools.getDepartments();
  const mentioned = departments.find(
    (department) =>
      norm(text).includes(norm(department.name)) ||
      (norm(department.name) === "cardiology" && /cardio|heart/.test(norm(text))) ||
      (norm(department.name) === "dermatology" && /skin|derma/.test(norm(text))) ||
      (norm(department.name) === "pediatrics" && /child|pediatric|baby/.test(norm(text))) ||
      (norm(department.name) === "orthopedics" && /ortho|bone|joint/.test(norm(text))) ||
      (norm(department.name) === "gynecology" && /gyne|women|pregnan/.test(norm(text)))
  );

  const doctors = await tools.getDoctorsByDepartment(mentioned?._id);
  if (!doctors.length) {
    return {
      reply: t(locale, "bookNoDoctors"),
      suggestions: localizedSuggestions(locale, ["sugBook", "sugFaq"]),
      intent: "doctors",
    };
  }

  const list = doctors
    .slice(0, MAX_OPTIONS)
    .map(
      (doctor, index) =>
        `${index + 1}. ${doctor.name} — ${doctor.specialty} · ₹${doctor.consultationFee}`
    )
    .join("\n");

  return {
    reply: t(locale, "doctorAvailability", {
      department: mentioned ? ` in ${mentioned.name}` : "",
      list,
    }),
    suggestions: localizedSuggestions(locale, ["sugBook", "sugFaq", "sugHandoff"]),
    intent: "doctors",
  };
}

async function handleClinicOverview({ locale }) {
  const info = await listClinicInfo(locale);
  const titles = info.map((item) => item.title).slice(0, 12);
  return {
    reply: `${t(locale, "sugFaq")}:\n\n${titles.map((title) => `• ${title}`).join(
      "\n"
    )}\n\n${t(locale, "outpatientFallback")}`,
    suggestions: [
      t(locale, "sugHours"),
      t(locale, "sugDoctors"),
      t(locale, "sugHandoff"),
      t(locale, "sugBook"),
    ],
    intent: "faq-overview",
  };
}

async function handleFaq({ locale, key }) {
  const info = await getClinicInfo(key, locale);
  if (!info) {
    return {
      reply: t(locale, "notAvailable"),
      suggestions: baseSuggestions(locale),
      intent: `faq:${key}`,
    };
  }

  return {
    reply: clinicAnswer(locale, info),
    suggestions: localizedSuggestions(locale, [
      "sugBook",
      "sugDoctors",
      "sugHandoff",
      "sugFaq",
    ]),
    intent: `faq:${key}`,
    faqKey: key,
  };
}

async function handleReminders({ conversation, user, locale, text }) {
  if (!REMINDERS_ENABLED) {
    return {
      reply: t(locale, "notAvailable"),
      suggestions: baseSuggestions(locale),
      intent: "reminders",
    };
  }
  if (!user || user.role !== "patient") {
    return {
      reply: t(locale, "authRequiredShort"),
      suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
      intent: "reminders",
    };
  }

  if (/\b(list|my|show|view)\b|सूची|mis recordatorios|mes rappels|تذكيراتي/i.test(text)) {
    const reminders = await tools.listReminders(user.id);
    if (!reminders.length) {
      return {
        reply: t(locale, "reminderNone"),
        suggestions: localizedSuggestions(locale, ["sugFaq", "sugAppointments"]),
        intent: "reminders",
      };
    }
    const lines = reminders.map((reminder, index) =>
      t(locale, "reminderLine", {
        number: index + 1,
        title: reminder.title,
        when: new Date(reminder.scheduledFor).toLocaleString(),
        status: reminder.status,
      })
    );
    return {
      reply: `${t(locale, "reminderHeader")}\n\n${lines.join("\n")}`,
      suggestions: baseSuggestions(locale),
      intent: "reminders",
    };
  }

  const state = ensureState(conversation);
  state.flow = "reminder";
  state.step = "reminder-type";
  return {
    reply: `${t(locale, "remindAskType")}\n\n${t(locale, "reminderSafety")}`,
    suggestions: [
      t(locale, "priorityNormal") === "Standard visit" ? "Medication" : "Medication",
      "Follow-up",
      t(locale, "sugRestart"),
    ],
    intent: "reminder",
  };
}

async function handleLanguage({ conversation, user, locale, text }) {
  const value = norm(text);
  let selected = null;

  for (const [name, code] of Object.entries(LANGUAGE_LOOKUP)) {
    const needle = norm(name);
    // Latin language names must match as whole words, otherwise short strings
    // like "en" match inside words such as "opening" or "appointment".
    const isLatin = /^[a-z]+$/.test(needle);
    const matched = isLatin
      ? new RegExp(`(^|[^a-z])${needle}([^a-z]|$)`).test(value)
      : value.includes(needle);
    if (matched) {
      selected = code;
      break;
    }
  }

  if (!selected && /language|भाषा|idioma|langue|لغة/.test(value)) {
    return {
      reply: t(locale, "languagePrompt"),
      suggestions: ["English", "हिन्दी", "Español", "Français", "العربية"],
      intent: "language",
    };
  }

  if (!selected) return null;

  conversation.locale = selected;
  if (user?.role === "patient") {
    await tools.updatePreferences(user.id, { language: selected }).catch(() => {});
  }
  return {
    reply: t(selected, "languageChanged", { language: languageName(selected) }),
    suggestions: baseSuggestions(selected),
    intent: "language",
  };
}

async function handleHandoff({ conversation, user, locale }) {
  if (["handoff-requested", "handoff-active"].includes(conversation.status)) {
    return {
      reply: t(locale, "handoffAlready"),
      suggestions: baseSuggestions(locale),
      intent: "handoff",
    };
  }

  conversation.status = "handoff-requested";
  conversation.resolution = "escalated";
  conversation.handoff = {
    ...(conversation.handoff || {}),
    requestedAt: new Date(),
    reason: "Patient requested a human team member",
    summary: `Last intent: ${conversation.lastIntent || "unknown"}`,
  };
  conversation.tags = Array.from(
    new Set([...(conversation.tags || []), "handoff"])
  );

  try {
    await tools.notifyStaff({
      title: "Chat handoff requested",
      message:
        "A patient asked to speak with a human. Open the chat handoffs panel to see the conversation context and reply.",
      type: "chat-handoff",
      meta: {
        conversationId: String(conversation._id),
        channel: conversation.channel,
        userId: user?.id ? String(user.id) : undefined,
      },
    });
  } catch (error) {
    console.error("Handoff notification failed:", error.message);
  }

  return {
    reply: t(locale, "handoffRequested"),
    suggestions: baseSuggestions(locale),
    intent: "handoff",
  };
}

async function llmFallback({ conversation, user, locale, text, history }) {
  if (!llm.isConfigured()) return null;
  try {
    const reply = await llm.answer({
      text,
      locale,
      history,
      user,
      tools,
      conversation,
    });
    if (!reply) return null;
    return {
      reply,
      suggestions: baseSuggestions(locale),
      intent: "llm",
    };
  } catch (error) {
    console.error("LLM fallback failed:", error.message);
    return null;
  }
}

/**
 * Main deterministic conversation engine.
 *
 * Every state-changing action (book / reschedule / cancel / walk-in / check-in)
 * passes through an explicit summary + confirmation step. The optional LLM is
 * only used for unanswered natural-language questions and gets read-only tools.
 */
async function respond({
  app,
  conversation,
  user,
  text,
  channel = "web",
  history = [],
}) {
  const state = ensureState(conversation);
  const secure = getSecure(conversation);
  let locale = normalizeLocale(conversation.locale || user?.chatPreferences?.language);

  if (!conversation.locale || conversation.locale === "en") {
    const detected = detectLocale(text);
    if (detected !== "en") locale = detected;
  }
  conversation.locale = locale;

  const value = norm(text);
  if (!value) {
    return {
      reply: t(locale, "noInput"),
      suggestions: baseSuggestions(locale),
      intent: "empty",
    };
  }

  if (text.length > 1500) {
    return {
      reply: t(locale, "tooLong"),
      suggestions: baseSuggestions(locale),
      intent: "too-long",
    };
  }

  // 1. Red flags always take priority and short-circuit normal booking.
  const redFlags = detectRedFlags(text);
  if (redFlags.length) {
    return handleEmergency({ conversation, user, text, locale, app });
  }

  // 2. Global escape hatches work in every flow.
  if (/^(restart|start over|menu|main menu|cancel this|stop|फिर से|reiniciar|recommencer|إعادة)/i.test(value)) {
    clearFlow(conversation);
    return {
      reply: t(locale, "restart"),
      suggestions: baseSuggestions(locale),
      intent: "restart",
    };
  }

  if (matchesAny(value, HANDOFF_PATTERNS)) {
    return handleHandoff({ conversation, user, locale });
  }

  const languageResponse = await handleLanguage({
    conversation,
    user,
    locale,
    text,
  });
  if (languageResponse) {
    conversation.lastIntent = languageResponse.intent;
    return languageResponse;
  }

  // 3. An action awaiting confirmation.
  if (state.pending) {
    const pendingResponse = await handlePendingInput({
      conversation,
      user,
      locale,
      text,
      app,
      secure,
    });
    if (pendingResponse) {
      conversation.lastIntent = pendingResponse.intent;
      return pendingResponse;
    }
  }

  // 4. Continue an active multi-turn flow.
  if (state.flow && state.step) {
    const flowResponse = await handleFlow({
      conversation,
      user,
      locale,
      text,
      app,
      secure,
    });
    if (flowResponse) {
      conversation.lastIntent = flowResponse.intent;
      return flowResponse;
    }
  }

  // 5. Explicit intents, ordered from most specific to most general.
  if (matchesAny(value, GREETING_PATTERNS) || /^(help|menu)\b/i.test(value)) {
    if (/^(help|menu)\b/i.test(value)) {
      return {
        reply: t(locale, "help"),
        suggestions: baseSuggestions(locale),
        intent: "help",
      };
    }
    return {
      reply: t(locale, "greeting", {
        name: user?.name ? ` ${String(user.name).split(" ")[0]}` : "",
      }),
      suggestions: baseSuggestions(locale),
      intent: "greeting",
    };
  }

  if (/thank|धन्यवाद|gracias|merci|شكرا/i.test(value)) {
    return {
      reply: t(locale, "thanks"),
      suggestions: baseSuggestions(locale),
      intent: "thanks",
    };
  }

  if (/^(bye|goodbye|see you|अलविदा|adiós|au revoir|مع السلامة)\b/i.test(value)) {
    return {
      reply: t(locale, "bye"),
      suggestions: baseSuggestions(locale),
      intent: "bye",
    };
  }

  if (/reschedul|move my appointment|change my appointment|appointment.*(change|move)|बदल.*अपॉइंटमेंट|reprogramar|cambiar cita|reprogrammer|تعديل الموعد/i.test(value)) {
    return beginReschedule({ conversation, user, locale });
  }

  if (/cancel|रद्द|cancelar|annuler|إلغاء/i.test(value) && /appointment|booking|अपॉइंटमेंट|cita|rendez|موعد/i.test(value)) {
    return beginCancel({ conversation, user, locale });
  }

  if (/walk[- ]?in|without (an )?appointment|बिना अपॉइंटमेंट|sin cita|sans rendez|بدون موعد/i.test(value)) {
    return beginWalkIn({ conversation, user, locale });
  }

  if (/pre[- ]?visit|intake|form before|before my visit|प्री-विज़िट|formulario previo|formulaire préalable|نموذج مسبق/i.test(value)) {
    if (!user || user.role !== "patient") {
      return {
        reply: t(locale, "authRequiredShort"),
        suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
        intent: "intake",
      };
    }
    if (!conversation.consent?.given) {
      return askConsent({ conversation, locale, pendingFlow: "intake" });
    }
    return beginIntake({ conversation, locale });
  }

  if (/remind|reminder|medication reminder|follow[- ]?up|रिमाइंडर|recordatorio|rappel|تذكير/i.test(value)) {
    return handleReminders({ conversation, user, locale, text });
  }

  if (
    /my appointments?|upcoming appointments?|next appointment|appointment status|booking status|what appointments?|any appointments?|do i have .*appointment|list .*appointment|show .*appointment|मेरे अपॉइंटमेंट|mis citas|mes rendez|مواعيدي/i.test(
      value
    )
  ) {
    return handleAppointments({ user, locale });
  }

  if (/visit history|medical record|past visit|previous visit|इतिहास|historial|antécédent|سجل الزيارات/i.test(value)) {
    return handleHistory({ user, locale });
  }

  if (/queue|token|waiting|now serving|my turn|position|क्यू|टोकन|cola|turno|file d'attente|طابور|دور/i.test(value)) {
    return handleQueue({ conversation, user, locale });
  }

  if (/which doctor|available doctor|doctor availability|find a doctor|see a doctor|cardio|derma|pediatric|ortho|gyne|डॉक्टर|médico|medico|médecin|طبيب/i.test(value)) {
    return handleDoctorAvailability({ locale, text });
  }

  // Department locations, grounded in the Department collection.
  if (/where is|location of|department|विभाग|departamento|service|قسم/i.test(value)) {
    const departments = await tools.getDepartments();
    const mentioned = departments.find((department) =>
      norm(value).includes(norm(department.name))
    );
    if (mentioned) {
      return {
        reply: `${mentioned.name}\n\n${mentioned.location || t(locale, "notAvailable")}`,
        suggestions: baseSuggestions(locale),
        intent: "department-location",
      };
    }
    if (/department|विभाग|departamento|service|قسم/i.test(value)) {
      return {
        reply: t(locale, "departmentList", {
          list: departments
            .map(
              (department) =>
                `• ${department.name}${department.location ? ` — ${department.location}` : ""}`
            )
            .join("\n"),
        }),
        suggestions: localizedSuggestions(locale, ["sugBook", "sugDoctors", "sugHandoff"]),
        intent: "departments",
      };
    }
  }

  const faqRule = FAQ_RULES.find((rule) => matchesAny(value, rule.patterns));
  if (faqRule) {
    return handleFaq({ locale, key: faqRule.key });
  }

  if (/clinic info|clinic information|what can you answer|faq|जानकारी|información|informations|معلومات/i.test(value)) {
    return handleClinicOverview({ locale });
  }

  if (/book|appointment|schedule|slot|reserve|अपॉइंटमेंट|reservar|cita|rendez|حجز|موعد/i.test(value)) {
    if (!user || user.role !== "patient") {
      return {
        reply: t(locale, "authRequired"),
        suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq", "sugHours"]),
        intent: "book",
      };
    }
    if (/help me choose|not sure which|don'?t know|which department|मदद|ayuda|aidez|ساعدني/i.test(value)) {
      if (!conversation.consent?.given) {
        return askConsent({ conversation, locale, pendingFlow: "triage" });
      }
      return beginTriage({ conversation, locale });
    }
    return startBooking({ conversation, locale });
  }

  if (matchesAny(value, SYMPTOM_PATTERNS)) {
    if (!user || user.role !== "patient") {
      return {
        reply: t(locale, "authRequiredShort"),
        suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
        intent: "triage",
      };
    }
    if (!conversation.consent?.given) {
      return askConsent({ conversation, locale, pendingFlow: "triage" });
    }
    return beginTriage({ conversation, locale, initialText: text });
  }

  if (/help me choose|not sure|triage|symptom check|which department|मदद करें|ayuda|aidez-moi|ساعدني/i.test(value)) {
    if (!user || user.role !== "patient") {
      return {
        reply: t(locale, "authRequiredShort"),
        suggestions: localizedSuggestions(locale, ["sugSignIn", "sugFaq"]),
        intent: "triage",
      };
    }
    if (!conversation.consent?.given) {
      return askConsent({ conversation, locale, pendingFlow: "triage" });
    }
    return beginTriage({ conversation, locale });
  }

  // 6. Optional LLM fallback for natural-language questions. It receives only
  // read-only tools and its output is advisory, never action-executing.
  const llmResponse = await llmFallback({
    conversation,
    user,
    locale,
    text,
    history,
  });
  if (llmResponse) {
    conversation.lastIntent = llmResponse.intent;
    return llmResponse;
  }

  return {
    reply: `${t(locale, "fallback")}\n\n${t(locale, "disclaimer")}`,
    suggestions: baseSuggestions(locale),
    intent: "fallback",
  };
}

module.exports = { respond, getSecure, setSecure };
