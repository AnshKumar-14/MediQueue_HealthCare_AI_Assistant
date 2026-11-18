/**
 * Rule-based symptom triage helpers.
 *
 * Safety rules:
 *  - Red flags always short-circuit the booking flow and advise emergency care.
 *  - The assistant never diagnoses, prescribes or recommends medication.
 *  - A suggested specialty/priority is only a routing hint for staff.
 */

const RED_FLAGS = [
  {
    key: "chest-pain",
    label: "Chest pain",
    patterns: [
      /chest pain/i,
      /pain in (my |the )?chest/i,
      /crushing chest/i,
      /chest tightness/i,
      /dil mein dard/i,
      /seene mein dard/i,
      /dolor en el pecho/i,
      /douleur (dans la |à la )?poitrine/i,
      /ألم في الصدر/i,
    ],
  },
  {
    key: "breathing",
    label: "Difficulty breathing",
    patterns: [
      /can(no|')?t breathe/i,
      /cannot breathe/i,
      /difficulty breathing/i,
      /shortness of breath/i,
      /severe breathlessness/i,
      /saans nahi/i,
      /saans lene mein/i,
      /dificultad para respirar/i,
      /difficulté à respirer/i,
      /صعوبة في التنفس/i,
    ],
  },
  {
    key: "severe-bleeding",
    label: "Severe bleeding",
    patterns: [
      /severe bleeding/i,
      /heavy bleeding/i,
      /bleeding (a lot|won'?t stop|does not stop)/i,
      /blood loss/i,
      /khoon bahut/i,
      /khoon band nahi/i,
      /sangrado (intenso|abundante)/i,
      /saignement (abondant|qui ne s'arrête pas)/i,
      /نزيف شديد/i,
    ],
  },
  {
    key: "stroke",
    label: "Stroke warning signs",
    patterns: [
      /\bstroke\b/i,
      /face droop/i,
      /slurred speech/i,
      /sudden weakness/i,
      /numbness on one side/i,
      /one side (of (my )?body|weak)/i,
      /falij/i,
      /lakwa/i,
      /derrame cerebral/i,
      /accident vasculaire/i,
      /\bavc\b/i,
      /سكتة دماغية/i,
    ],
  },
  {
    key: "unconscious",
    label: "Loss of consciousness or seizure",
    patterns: [
      /unconscious/i,
      /passed out/i,
      /fainted/i,
      /not breathing/i,
      /seizure/i,
      /convulsion/i,
      /behosh/i,
      /मूर्छित/i,
      /inconsciente/i,
      /inconscient/i,
      /فقدان الوعي/i,
    ],
  },
  {
    key: "self-harm",
    label: "Self-harm risk",
    patterns: [
      /suicid/i,
      /kill myself/i,
      /end my life/i,
      /self[- ]?harm/i,
      /hurt myself/i,
      /आत्महत्या/i,
      /suicidarme/i,
      /me tuer/i,
      /إيذاء النفس/i,
    ],
  },
];

const SPECIALTY_RULES = [
  {
    department: "Cardiology",
    patterns: [
      /heart/i,
      /cardiac/i,
      /blood pressure/i,
      /hypertension/i,
      /palpitation/i,
      /cholesterol/i,
      /dil/i,
      /corazón/i,
      /coeur/i,
      /قلب/i,
    ],
  },
  {
    department: "Dermatology",
    patterns: [
      /skin/i,
      /rash/i,
      /acne/i,
      /eczema/i,
      /hair loss/i,
      /nail/i,
      /itching/i,
      /pimple/i,
      /khujli/i,
      /piel/i,
      /peau/i,
      /جلد/i,
    ],
  },
  {
    department: "Pediatrics",
    patterns: [
      /child/i,
      /baby/i,
      /infant/i,
      /toddler/i,
      /kid/i,
      /newborn/i,
      /बच्चा/i,
      /niño/i,
      /enfant/i,
      /طفل/i,
    ],
  },
  {
    department: "Orthopedics",
    patterns: [
      /bone/i,
      /joint/i,
      /knee/i,
      /back pain/i,
      /fracture/i,
      /sprain/i,
      /shoulder/i,
      /neck pain/i,
      /haddi/i,
      /ghutna/i,
      /hueso/i,
      /os\b/i,
      /عظم/i,
    ],
  },
  {
    department: "Gynecology",
    patterns: [
      /pregnan/i,
      /period/i,
      /menstrual/i,
      /gyne/i,
      /vaginal/i,
      /women'?s health/i,
      /गर्भ/i,
      /embarazo/i,
      /grossesse/i,
      /حمل/i,
    ],
  },
  {
    department: "General Medicine",
    patterns: [
      /fever/i,
      /cough/i,
      /cold/i,
      /headache/i,
      /stomach/i,
      /nausea/i,
      /vomit/i,
      /diarrhea/i,
      /fatigue/i,
      /weakness/i,
      /sore throat/i,
      /infection/i,
      /bukhar/i,
      /khansi/i,
      /sirdard/i,
      /pet dard/i,
      /fiebre/i,
      /fièvre/i,
      /حمى/i,
    ],
  },
];

function detectRedFlags(text = "") {
  const value = String(text);
  return RED_FLAGS.filter((flag) =>
    flag.patterns.some((pattern) => pattern.test(value))
  ).map((flag) => ({ key: flag.key, label: flag.label }));
}

function recommendSpecialty(text = "") {
  const value = String(text);
  for (const rule of SPECIALTY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(value))) {
      return rule.department;
    }
  }
  return "General Medicine";
}

function suggestPriority(text = "", patientProfile = {}) {
  const value = String(text).toLowerCase();

  if (detectRedFlags(value).length) return "emergency";
  if (/pregnan|गर्भ|embaraz|grossesse|حامل/.test(value)) return "pregnant";

  const dob = patientProfile?.dateOfBirth;
  if (dob) {
    const age = Math.floor(
      (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    if (age >= 65) return "senior";
  }

  if (/senior|elderly|वरिष्ठ|mayor|âgé|كبير/.test(value)) return "senior";
  return "normal";
}

function parseSeverity(text = "") {
  const match = String(text).match(/\b(10|[1-9])\b/);
  return match ? Number(match[1]) : null;
}

const DISCLAIMER_KEYS = [
  "This is not a diagnosis. A doctor will assess you in person.",
  "If your symptoms get worse, seek urgent care immediately.",
];

module.exports = {
  RED_FLAGS,
  detectRedFlags,
  recommendSpecialty,
  suggestPriority,
  parseSeverity,
  DISCLAIMER_KEYS,
};
