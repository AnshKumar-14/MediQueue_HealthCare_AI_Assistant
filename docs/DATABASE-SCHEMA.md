# Database Schema, Encryption & Access Control

MediQueue uses MongoDB via Mongoose. Collection names are the pluralized model
names (`users`, `doctorsprofiles`, `departments`, `appointments`,
`queueentries`, `medicalrecords`, `notifications`, `auditlogs`, `clinicinfos`,
`chatconversations`, `chatmessages`, `intakesummaries`, `reminders`).

Dates that represent a clinic day are stored as `YYYY-MM-DD` strings so they
compare lexicographically and avoid timezone drift. Timestamps use `Date`.

---

## User (`User`)

| Field | Type | Notes |
| --- | --- | --- |
| `role` | String enum | `patient`, `doctor`, `receptionist`, `staff`, `admin` |
| `name` | String | required |
| `email` | String | required, unique, lowercased |
| `phone` | String | required |
| `password` | String | bcrypt hash |
| `specialty` | String | required for doctors |
| `licenseNumber` | String | required for doctors, unique, sparse |
| `department` | ObjectId → Department | doctor/staff assignment |
| `staffType` | String enum | `receptionist`, `nurse`, `admin` (for `staff` role) |
| `patientProfile` | Object | `dateOfBirth`, `gender`, `address`, `bloodGroup`, `emergencyContact` |
| `medicalInfo` | String | **encrypted** JSON, `select: false` |
| `consentAccepted` | Boolean | patient privacy consent |
| `chatPreferences` | Object | `language`, `contactMethod`, `preferredDoctor`, `medicationReminders`, `followUpReminders` |
| `lastChatAt` | Date | last chat activity, used for analytics and re-engagement |
| `status` | String enum | `pending`, `approved`, `rejected`; patients/admins/receptionists default approved |

Indexes: `email` unique, `licenseNumber` unique sparse, `{ role, status }`.

Notes:

- `medicalInfo` is an AES-256-GCM payload. Controllers decrypt it explicitly
  for the owner's profile and export endpoints; generic user queries exclude it.
- `staffType` is only required for the legacy `staff` role. `receptionist` and
  `admin` are first-class roles.

## DoctorProfile (`DoctorProfile`)

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId → User | unique, required |
| `department` | ObjectId → Department | |
| `qualification` | String | required |
| `experience` | Number | years |
| `profileImage` | String | |
| `hospitalName` | String | required |
| `clinicAddress` | String | required |
| `consultationFee` | Number | required |
| `profileCompleted` | Boolean | gates booking |
| `dailyPatientCapacity` | Number | required |
| `avgConsultationMinutes` | Number | default 10; drives wait estimates |
| `availability` | Array | `{ day, startTime, endTime }` 24-hour strings |
| `bio` | String | |
| `isAvailable` | Boolean | default true |
| `verificationStatus` | String enum | `pending`, `approved`, `rejected` |

Index: `userId` unique.

## Department (`Department`)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | String | required, unique |
| `description` | String | |
| `location` | String | |
| `isActive` | Boolean | default true |

## Appointment (`Appointment`)

| Field | Type | Notes |
| --- | --- | --- |
| `patient` | ObjectId → User | required |
| `doctor` | ObjectId → User | required |
| `department` | ObjectId → Department | required |
| `date` | String | `YYYY-MM-DD`, indexed |
| `startTime` / `endTime` | String | `HH:mm` |
| `reason` | String | |
| `priority` | String enum | `normal`, `senior`, `pregnant`, `emergency` |
| `status` | String enum | `booked`, `checked-in`, `in-queue`, `completed`, `cancelled`, `no-show` |
| `isActive` | Boolean | false when cancelled; used by the slot uniqueness index |
| `createdBy` / `cancelledBy` | ObjectId → User | |
| `cancelReason` | String | |

Index: unique partial `{ doctor, date, startTime }` where `isActive: true`.
This is the double-booking guard.

## QueueEntry (`QueueEntry`)

| Field | Type | Notes |
| --- | --- | --- |
| `patient` | ObjectId → User | required |
| `doctor` | ObjectId → User | required |
| `department` | ObjectId → Department | required |
| `appointment` | ObjectId → Appointment | null for walk-ins |
| `date` | String | `YYYY-MM-DD`, indexed |
| `tokenNumber` | Number | sequential per doctor per day |
| `priority` | String enum | same weights as appointments |
| `status` | String enum | `waiting`, `called`, `in-progress`, `completed`, `skipped`, `cancelled`, `no-show` |
| `type` | String enum | `pre-booked`, `walk-in` |
| `notes` | String | |
| `checkedInAt` | Date | default now |
| `calledAt` / `startedAt` / `completedAt` | Date | lifecycle timestamps |
| `createdBy` | ObjectId → User | |

Indexes:

- unique `{ doctor, date, tokenNumber }`
- `{ doctor, date, status }`
- `{ patient, date }`

### Queue lifecycle

```
waiting ──call-next──▶ called ──start──▶ in-progress ──complete──▶ completed
   │                     │                   │
   ├──skip──────────────▶ skipped            │
   ├──no-show───────────▶ no-show            │
   └──cancel────────────▶ cancelled ◀────────┘ (appointment cancelled)
```

Active statuses are `waiting`, `called`, `in-progress`. Only one entry should be
`called`/`in-progress` at a time; `call-next` refuses while one is active.

Ordering (`sortQueueEntries`): priority weight (emergency 0; senior/pregnant 1;
normal 2) → earlier `checkedInAt` → lower token. Positions and estimated wait
(`(index + current ? 1 : 0) * avgConsultationMinutes`) are computed at read
time, so late arrivals and cancelled entries reorder automatically.

## MedicalRecord (`MedicalRecord`)

| Field | Type | Notes |
| --- | --- | --- |
| `patient` | ObjectId → User | required |
| `doctor` | ObjectId → User | required |
| `appointment` | ObjectId → Appointment | optional |
| `queueEntry` | ObjectId → QueueEntry | optional |
| `visitDate` | Date | default now |
| `diagnosis` | String | **encrypted** |
| `notes` | String | **encrypted** |
| `prescription` | String | **encrypted** |
| `followUpDate` | String | `YYYY-MM-DD` |

Indexes: `{ patient, visitDate: -1 }`, `{ doctor, visitDate: -1 }`.

## Notification (`Notification`)

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User | required, indexed |
| `type` | String enum | `booking-confirmation`, `reminder`, `turn-near`, `your-turn`, `cancellation`, `queue-update`, `account`, `chat-handoff`, `chat-reply`, `medication-reminder`, `follow-up` |
| `channel` | String enum | `in-app`, `email`, `sms`, `push` |
| `title` / `message` | String | required |
| `read` | Boolean | default false |
| `sentAt` | Date | |
| `meta` | Mixed | e.g. `appointmentId`, `queueEntryId`, `doctorId` |

Index: `{ user, read, createdAt: -1 }`.

Near-turn alerts are deduplicated per queue entry using
`meta.queueEntryId` + `type: "turn-near"`.

## AuditLog (`AuditLog`)

| Field | Type | Notes |
| --- | --- | --- |
| `actor` | ObjectId → User | |
| `actorRole` | String | |
| `action` | String | `"METHOD /path"` |
| `entity` | String | first path segment after `/api` |
| `entityId` | String | route `:id` if present |
| `changes` | Mixed | sanitized body/params |
| `ip` / `userAgent` | String | |

Indexes: `{ createdAt: -1 }`, `{ actor, createdAt: -1 }`, TTL on `createdAt`
(180 days).

Writes happen in a `res.on("finish")` hook, so failed requests are still
recorded. `password`, `confirmPassword`, `token` and `loginSessionId` are
redacted. Chat message bodies, intake free text and reminder messages are also
recursively redacted.

## ClinicInfo (`ClinicInfo`)

Authoritative, grounded source for clinic FAQs. Seeded with 14 localized records
(hours, location, directions, parking, fees, insurance, documents, preparation,
app help, cancellation policy, pharmacy, accessibility, Wi-Fi, emergencies).

| Field | Type | Notes |
| --- | --- | --- |
| `key` | String | unique, e.g. `hours`, `fees`, `preparation` |
| `title` | String | short label |
| `content` | String | **localized answer text** |
| `locale` | String enum | `en`, `hi`, `es`, `fr`, `ar` |
| `keywords` | [String] | matching hints for the deterministic engine |
| `category` | String | grouping for analytics |
| `active` | Boolean | default true |

Index: `{ key, locale }` unique.

## ChatConversation (`ChatConversation`)

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User | optional; guests are tracked by `externalId` |
| `externalId` | String | signed visitor id for guests, or channel sender id |
| `channel` | String enum | `web`, `mobile`, `whatsapp`, `sms` |
| `locale` | String enum | active language |
| `status` | String enum | `active`, `handoff-requested`, `handoff-active`, `closed` |
| `resolution` | String enum | `open`, `resolved`, `escalated`, `abandoned` |
| `consent` | Object | `given`, `givenAt`, `version` |
| `handoff` | Object | `requestedAt`, `reason`, `assignedTo`, `resolvedAt` |
| `context` | Mixed | flow state, collected booking/triage fields (encrypted where PII) |
| `lastIntent` | String | last recognized intent, used for drop-off analytics |
| `messageCount` | Number | denormalized counter |
| `lastMessageAt` | Date | |
| `expiresAt` | Date | TTL index (`CHAT_RETENTION_DAYS`, default 30) |
| `feedback` | Object | thumbs summary |

Indexes: `{ user, lastMessageAt: -1 }`, `{ status, lastMessageAt: -1 }`,
`{ externalId, channel }`, TTL on `expiresAt`.

## ChatMessage (`ChatMessage`)

| Field | Type | Notes |
| --- | --- | --- |
| `conversation` | ObjectId → ChatConversation | indexed |
| `role` | String enum | `user`, `assistant`, `staff`, `system` |
| `content` | String | **encrypted**, `select: false` |
| `intent` | String | recognized intent |
| `faqKey` | String | `ClinicInfo.key` when the reply was grounded in an FAQ |
| `suggestions` | [String] | quick replies attached to the message |
| `author` | ObjectId → User | staff author for human replies |
| `feedback` | String enum | `up`, `down`, or empty |
| `expiresAt` | Date | TTL index, mirrors the conversation retention |

Indexes: `{ conversation, createdAt: 1 }`, TTL on `expiresAt`.

## IntakeSummary (`IntakeSummary`)

Conversational pre-visit intake shown to doctors and staff.

| Field | Type | Notes |
| --- | --- | --- |
| `patient` | ObjectId → User | indexed |
| `doctor` | ObjectId → User | optional |
| `department` | ObjectId → Department | |
| `appointment` | ObjectId → Appointment | optional |
| `conversation` | ObjectId → ChatConversation | source chat |
| `reason` | String | **encrypted** |
| `symptoms` | String | **encrypted** |
| `duration` | String | **encrypted** |
| `severity` | Number | 1–10 |
| `medications` | String | **encrypted** |
| `allergies` | String | **encrypted** |
| `redFlags` | [String] | emergency phrases detected |
| `suggestedPriority` | String enum | `normal`, `senior`, `pregnant`, `emergency` (staff confirm) |
| `staffNotes` | String | **encrypted**, staff-only |
| `status` | String enum | `pending`, `confirmed`, `seen` |
| `expiresAt` | Date | TTL index |

Indexes: `{ patient, createdAt: -1 }`, `{ doctor, status }`, TTL on `expiresAt`.

## Reminder (`Reminder`)

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User | indexed |
| `type` | String enum | `medication`, `follow-up`, `appointment` |
| `message` | String | **encrypted** |
| `scheduledFor` | Date | indexed |
| `sentAt` | Date | |
| `acknowledgedAt` | Date | |
| `status` | String enum | `pending`, `sent`, `acknowledged`, `cancelled` |
| `meta` | Mixed | appointment/record references |
| `expiresAt` | Date | TTL index |

Indexes: `{ status, scheduledFor }`, `{ user, scheduledFor: -1 }`, TTL on
`expiresAt`.

---

## Encryption

`backend/src/utils/crypto.js` implements AES-256-GCM:

- Key = `sha256(DATA_ENCRYPTION_KEY || JWT_SECRET || "mediqueue-development-key")`.
- Each value gets a random 12-byte IV.
- Stored format: `base64(iv):base64(authTag):base64(ciphertext)`.
- Decryption failures return an empty string instead of throwing, so a key
  change degrades to blank medical fields rather than a 500.

Encrypted fields:

- `User.medicalInfo` (whole JSON document)
- `MedicalRecord.diagnosis`, `MedicalRecord.notes`,
  `MedicalRecord.prescription`
- `ChatMessage.content`
- `IntakeSummary.reason`, `.symptoms`, `.duration`, `.medications`,
  `.allergies`, `.staffNotes`
- `Reminder.message`
- Sensitive free text inside `ChatConversation.context`

`followUpDate` and `visitDate` are not encrypted.

> Set `DATA_ENCRYPTION_KEY` once in production and keep it stable. Rotating it
> requires re-encrypting existing values.

---

## Authentication

- Login signs a JWT with `{ id, email, role }`, expires in **1 day**, and sets
  it as the `loginSessionId` HTTP-only cookie.
- `restrictToLogin` verifies the cookie and populates `req.user`.
- `authorizeUserRole(...roles)` checks `req.user.role`.
- There is no refresh token; logging in again issues a new token.

---

## RBAC matrix

`✓` = allowed, `self` = own records only, `—` = denied.

| Capability | Patient | Doctor | Receptionist / Staff | Admin |
| --- | --- | --- | --- | --- |
| Register / login | ✓ | ✓ | ✓ | ✓ |
| Browse doctors, departments, slots | ✓ | ✓ | ✓ | ✓ |
| Book appointment | ✓ | — | ✓ | ✓ |
| Reschedule appointment | self | — | ✓ | ✓ |
| Cancel appointment | self | own patients | ✓ | ✓ |
| Check in | self | own patients | ✓ | ✓ |
| Add walk-in | — | — | ✓ | ✓ |
| View live queue | self status | own queue | any doctor | any doctor |
| Call next / start / complete / skip / no-show | — | own queue | ✓ | ✓ |
| Create medical record | — | ✓ | — | ✓ |
| Read medical records | self | own records | ✓ | ✓ |
| View/update patient profile | self | — | — | view list |
| Reports | — | own data | — | all data |
| Manage departments | — | — | — | ✓ |
| Manage doctors, schedules, approvals | — | — | — | ✓ |
| Create staff accounts | — | — | — | ✓ |
| Chat with the assistant | ✓ | ✓ | ✓ | ✓ |
| Pre-visit intake summaries | — | own patients | ✓ | ✓ |
| Chat handoff inbox / reply | — | — | ✓ | ✓ |
| Chatbot analytics | — | — | — | ✓ |
| Audit logs | — | — | — | ✓ |
| Public waiting-room display | ✓ | ✓ | ✓ | ✓ |

Additional server-side checks:

- Patients can only read their own appointments, queue entries, records and
  export.
- Doctors can only read/manage their own queue and appointments, and only list
  their own medical records for a patient.
- Staff can manage queues and bookings but cannot write medical records.

---

## Seed data

`backend/src/config/seed.js` runs on every backend start and from `npm run
db:setup`. Departments, `ClinicInfo` records and demo accounts are upserted
with `$setOnInsert`, so the seed is idempotent and never overwrites real users
or edits made in Compass. It creates:

- 6 departments: General Medicine, Cardiology, Pediatrics, Dermatology,
  Orthopedics, Gynecology.
- Admin, receptionist, two doctors (Cardiology and General Medicine, Mon–Sat
  09:00–13:00) and one patient, using the demo credentials in the README.
- 14 localized `ClinicInfo` records (English, Hindi, Spanish, French, Arabic)
  used to ground clinic FAQ answers.

The demo accounts are added even when the database already contains real
accounts (for example patients who registered through the app). Existing
accounts are left untouched, and `SEED_DEMO=false` disables demo seeding.

The in-memory MongoDB used when `MONGO_URI` is empty resets on every backend
restart, which re-runs the seed.

## Persistent database setup

For MongoDB Atlas or a local MongoDB server (Compass connects to the same URI):

```bash
cd backend
npm run db:setup   # creates collections, indexes and seed data
npm run db:check   # read-only verification of collections and indexes
```

`db:setup` prints the created collection names and document counts. Both scripts
use `MONGO_URI` from `backend/.env`. Set `USE_MEMORY_DB=true` only for temporary
local runs; it never writes to Atlas.
