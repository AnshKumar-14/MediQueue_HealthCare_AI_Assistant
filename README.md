<<<<<<< HEAD
# MediQueue — Doctor Appointments & Smart Queue Management

MediQueue is a full-stack clinic appointment and live-queue system. Patients book
appointments, check in on the day of their visit and receive a digital token.
Doctors, receptionists and admins work from role-specific dashboards while a
public waiting-room screen shows live token status.

The repo is an npm-workspaces monorepo:

- **Frontend** — Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend** — Express 5, Mongoose 9, Socket.IO, JWT cookie auth

---

## Features

### Patients

- Register and log in with a consent-gated medical profile.
- Store date of birth, gender, blood group, emergency contact, address,
  allergies, conditions and medications.
- Browse departments and doctors, pick a date and an available 30-minute slot.
- Book, reschedule and cancel appointments.
- Choose a priority (normal / senior citizen / pregnant) when booking.
- Check in on the appointment date and receive a digital token.
- Track live position, estimated wait, currently-serving token and patients
  ahead via Socket.IO updates.
- View visit history, prescriptions and doctor notes.
- Download a JSON export of their own data.
- Receive booking confirmations, reminders, near-turn alerts and cancellation
  notifications.

### Doctors

- Live today's queue with current patient, waiting list and completed visits.
- Call next, start consultation, complete, skip or mark no-show.
- Write encrypted consultation records (diagnosis, notes, prescription,
  follow-up date).
- See daily stats: in queue, completed, average wait, total tokens.
- View personal reports (wait times, peak hours, patient load).

### Reception / Staff

- Select any doctor and date, then manage that doctor's live queue.
- Check in pre-booked patients.
- Create walk-in patients (existing patient or new registration on the spot).
- Call next and advance the queue.
- Open the public waiting-room display.

### Admin

- Overview of appointments, completed visits, average wait and no-show rate.
- Manage doctors: approve/reject accounts and edit departments, fees, capacity,
  consultation length and weekly availability.
- Manage departments (create, edit, deactivate).
- View and search patients.
- Create staff/receptionist/admin accounts.
- Approve or reject pending doctor and staff registrations.
- Reports: average wait, patient load per doctor, peak hours, no-show rate.
- Audit log of every state-changing request (180-day retention).
- Link to the waiting-room display.

### Queue rules

- A single queue per doctor per day combines pre-booked and walk-in patients.
- Priority weights: `emergency` → 0, `pregnant`/`senior` → 1, `normal` → 2.
  Within the same weight, patients are ordered by check-in time, then token.
- Tokens are issued sequentially per doctor per day.
- Skipping or marking no-show removes a patient from the active list without
  blocking the queue; the doctor can call the next patient immediately.
- Cancelling an appointment frees the slot and broadcasts a queue refresh.
- Position and estimated wait are recalculated on every queue read, using the
  doctor's `avgConsultationMinutes`.
- Near-turn notifications are sent once to the next two waiting patients.

### Real-time updates

Socket.IO is mounted on the same HTTP server as the API.

- Client emits `join` with `{ doctorId }`.
- Server joins the socket to `queue:doctor:<doctorId>` and `queue:all`.
- Server emits `queue:update` with `{ doctorId, date, at }` after every queue
  mutation.
- Dashboards also poll as a fallback, so the UI still refreshes if the socket
  disconnects.

### Notifications

Notifications are persisted in the `Notification` collection and shown in the
in-app bell. The notification service also writes delivery logs for `email` and
`sms` channels; those are mock transports that can be replaced with a real
provider (SES, Twilio, FCM, etc.).

Types: `booking-confirmation`, `reminder`, `turn-near`, `your-turn`,
`cancellation`, `queue-update`, `account`, `chat-handoff`, `chat-reply`,
`medication-reminder`, `follow-up`.

### AI chat assistant

A warm, concise clinic assistant is available on every page through a floating
web widget (hidden on `/display`).

- **Booking and changes**: find departments, doctors and open slots; book,
  reschedule or cancel with an explicit confirmation step before anything is
  written.
- **Queue and walk-ins**: live position, current token, estimated wait, and
  joining the walk-in queue for the signed-in patient.
- **Clinic FAQs**: hours, location, directions, parking, fees, insurance,
  documents, preparation, app help, cancellation policy, pharmacy, lab,
  accessibility, Wi-Fi and emergencies. Answers are grounded in the
  `ClinicInfo` collection.
- **Symptom triage**: collects symptoms, suggests a specialty and priority, and
  stops for red flags with emergency advice. It never diagnoses, prescribes or
  recommends medication.
- **Personalisation** after sign-in: upcoming appointments, visit history,
  preferred doctor, language, contact method and optional medication /
  follow-up reminders. Patients can manage reminders and preferences directly
  from the chat widget.
- **Languages**: English, Hindi, Spanish, French and Arabic, with automatic
  detection and a language switcher.
- **Voice**: browser speech-to-text input and optional spoken replies, saved to
  the patient's preferences.
- **Human handoff**: asks staff to join, shares conversation context, and lets
  reception reply from the staff dashboard. The widget polls for staff replies.
- **Pre-visit intake**: a short conversational summary (reason, symptoms,
  duration, severity, medicines, allergies, red flags) appears in the doctor's
  and staff's "Pre-visit intake" tab.
- **Feedback**: thumbs up/down on assistant replies.
- **Streaming**: replies stream over Server-Sent Events; a normal JSON endpoint
  is used as a fallback.
- **Safety**: consent before the chat starts, auth before personal or medical
  data, encrypted message content, 30-day TTL retention, rate limiting and
  masked audit logs.
- **Optional LLM**: if `ANTHROPIC_API_KEY` or `LLM_API_KEY` is set, unmatched
  natural-language questions go to an LLM with read-only tools. Without a key
  the deterministic engine handles everything, so the chatbot works offline.
- **Staff analytics**: common questions, top intents, unresolved queries,
  drop-off points, handoff rate, satisfaction, channels, languages and recent
  conversations (metadata only; message bodies stay encrypted).

---

## Project structure

```
mediqueue/
├── backend/
│   ├── server.js                 Express + Socket.IO bootstrap
│   ├── scripts/                  setup-database.js, check-database.js
│   └── src/
│       ├── config/               DB connection + demo/ClinicInfo seed
│       ├── controllers/          Auth, doctors, appointments, queue, admin,
│       │                         patients, reports, records, notifications, chat
│       ├── middlewares/          JWT auth, optional auth, role guard, audit logging
│       ├── models/               Mongoose schemas
│       ├── routes/               /api/* route definitions
│       ├── services/             Auth, queue, notifications
│       │   └── chat/             Engine, tools, triage, i18n, clinic, LLM,
│       │                         analytics, reminders
│       └── utils/                Crypto, date/slot/queue helpers
├── frontend/
│   ├── app/
│   │   ├── (public)/login/        Login with role switcher
│   │   ├── (public)/register/     Patient/doctor/staff registration
│   │   ├── patient/dashboard/     Booking, token, history, profile
│   │   ├── doctor/dashboard/      Live queue, intake, records, reports
│   │   ├── doctor/complete-profile/
│   │   ├── staff/dashboard/       Reception check-in / walk-in / intake / handoffs
│   │   ├── admin/dashboard/       Management, reports, chatbot analytics, audit
│   │   └── display/               Public waiting-room screen
│   ├── components/                AppShell, UI primitives, ChatWidget,
│   │                              IntakePanel, HandoffPanel, ChatbotAnalyticsPanel
│   └── lib/                       API client, session + queue hooks
├── docs/
│   ├── API.md                    Endpoint reference
│   └── DATABASE-SCHEMA.md        Models, encryption and RBAC
└── package.json                  npm workspaces + combined dev script
```

---

## Prerequisites

- Node.js 22+ (the in-memory MongoDB download works best on Node 22)
- npm 10+

> On Windows PowerShell, `npm.ps1` may be blocked by execution policy. Use
> `npm.cmd` instead of `npm` if you see a `SecurityError`.

## Setup

```bash
npm install
```

Environment files:

| File | Variables |
| --- | --- |
| `backend/.env` | `PORT`, `FRONTEND_URL`, `JWT_SECRET`, `MONGO_URI`, `USE_MEMORY_DB`, `DATA_ENCRYPTION_KEY`, chat/LLM settings |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` |

Copy `backend/.env.example` to `backend/.env` and fill in the values. By default
`MONGO_URI` is empty, so the backend starts a temporary **in-memory MongoDB**
and seeds demo data. Data resets when the backend stops — useful for demos, not
for production. Set `USE_MEMORY_DB=true` to force this mode even when a
`MONGO_URI` is configured.

### Persistent MongoDB (Atlas + Compass)

1. Create a free MongoDB Atlas cluster and a database user.
2. In **Network Access**, add your current IP address (or `0.0.0.0/0` for a
   throwaway demo). A blocked IP often shows up as
   `MongoServerSelectionError` / `tlsv1 alert internal error` rather than a
   clear "not whitelisted" message, so update this whenever your IP changes.
3. Copy the connection string and URL-encode special characters in the password
   (for example `@` → `%40`). Put it in `backend/.env`:

   ```env
   MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/mediqueue
   ```

4. Create the collections, indexes and seed data:

   ```bash
   cd backend
   npm run db:setup
   npm run db:check
   ```

   `db:setup` creates every collection used by the app, adds indexes (including
   TTL retention), and seeds departments, doctors, `ClinicInfo` FAQ records and
   demo accounts. Seeding is additive and idempotent: existing users are never
   modified, so it is safe to run on a database that already has real accounts.
   `db:check` is read-only and prints collection/index counts.

5. Open **MongoDB Compass** and paste the same `MONGO_URI`. The `mediqueue`
   database appears with these collections:

   `users`, `doctorprofiles`, `departments`, `appointments`, `queueentries`,
   `medicalrecords`, `notifications`, `auditlogs`, `clinicinfos`,
   `chatconversations`, `chatmessages`, `intakesummaries`, `reminders`.

   You can browse and edit documents directly in Compass; both Compass and the
   app read/write the same Atlas cluster.

Sensitive medical and chat data is encrypted with AES-256-GCM using
`DATA_ENCRYPTION_KEY`, falling back to `JWT_SECRET`. Set a dedicated
`DATA_ENCRYPTION_KEY` in production and keep it stable. Records encrypted before
it was configured still decrypt with `JWT_SECRET`; once records are written with
the new key, changing that key makes them unreadable.

### Chatbot configuration

The chatbot works with no external AI key. Optional settings in `backend/.env`:

```env
CHAT_RETENTION_DAYS=30
CHAT_MESSAGES_PER_HOUR=60
CHAT_REQUESTS_PER_MINUTE=40
CHAT_REMINDERS_ENABLED=true
CHAT_REMINDER_INTERVAL_MS=60000
CHAT_WEBHOOK_SECRET=

# Optional outbound delivery for SMS / WhatsApp / email reminders.
# Use either Twilio or a generic JSON gateway (CHANNEL_OUTBOUND_URL).
CHANNEL_OUTBOUND_URL=
CHANNEL_OUTBOUND_SECRET=
CHANNEL_TIMEOUT_MS=10000
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_SMS_FROM=
TWILIO_WHATSAPP_FROM=

# Optional LLM fallback (read-only tools only)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=20000
```

## Run

```bash
npm run dev
```

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:5000>
- Public display: <http://localhost:3000/display>

Run separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Demo accounts

Seeded automatically when the database is empty:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@mediqueue.com` | `Admin@123` |
| Receptionist | `reception@mediqueue.com` | `Reception@123` |
| Doctor (Cardiology) | `doctor@mediqueue.com` | `Doctor@123` |
| Doctor (General Medicine) | `doctor2@mediqueue.com` | `Doctor@123` |
| Patient | `patient@mediqueue.com` | `Patient@123` |

Demo doctors are available Monday–Saturday, 09:00–13:00.

## App routes

| Route | Access |
| --- | --- |
| `/login`, `/register` | Public |
| `/display` | Public waiting-room screen |
| `/patient/dashboard` | Patient |
| `/doctor/dashboard` | Doctor |
| `/doctor/complete-profile` | Doctor without a completed profile |
| `/staff/dashboard` | Receptionist / staff / admin |
| `/admin/dashboard` | Admin |

Login redirects by role: doctor → profile check → dashboard; admin → admin
dashboard; receptionist/staff → staff dashboard; patient → patient dashboard.
The login page keeps Patient/Doctor/Staff tabs for demo quick-fill, shows the
demo credentials for the selected role (including an admin shortcut), and offers
“Continue to dashboard” or “Sign out & switch account” when a session already
exists.

## Security & privacy

- Passwords are hashed with bcrypt.
- Auth uses an HTTP-only JWT cookie; `restrictToLogin` and
  `authorizeUserRole` guard every non-public route.
- `helmet` sets security headers. Login is limited to 20 failed attempts per 15
  minutes per IP (successful logins do not count) and registration to 20 accounts
  per hour per IP.
- Login returns the same `401 Invalid email or password` for unknown emails and
  wrong passwords, so accounts cannot be enumerated.
- `medicalInfo` on `User` and the clinical fields on `MedicalRecord` are
  encrypted at rest with AES-256-GCM.
- Chat messages, pre-visit intake free text and reminder messages are encrypted
  with the same AES-256-GCM utility.
- Medical records are only readable by the patient, their doctor, staff and
  admins; writes are restricted to doctors and admins.
- Every state-changing request is written to `AuditLog` with actor, role,
  action, entity, sanitized body, IP and user agent; entries expire after 180
  days. Chat and PII fields are recursively redacted before logging.
- Patients must accept privacy consent at registration before medical data is
  stored, and can export their own data as JSON. The chat widget also requires
  consent before the first message.
- CORS is restricted to `FRONTEND_URL` and cookies are sent with credentials.
- Chat personal/medical data requires an authenticated owner; guests can browse
  FAQs but must sign in before booking or viewing appointments.
- Chat routes are rate-limited per IP and per conversation, and retention is
  enforced with TTL indexes (`CHAT_RETENTION_DAYS`, default 30 days).

> This is a demo implementation. Before production use, review consent text and
> retention policy with legal counsel, enable TLS, use a managed secrets store,
> configure MongoDB backups/encryption, and connect real notification providers.

## Known limitations

- With an empty `MONGO_URI`, data lives in memory and resets on every backend
  restart. Use a real MongoDB for persistence (`npm run db:setup`).
- Appointment and queue email/SMS/push messages are persisted `Notification`
  records plus console logs. Chat reminders can optionally be delivered through
  Twilio or `CHANNEL_OUTBOUND_URL` (see Chatbot configuration). The
  WhatsApp/SMS chat webhook is functional, but you must point your provider at
  `POST /api/chat/webhook/:channel` and set `CHAT_WEBHOOK_SECRET`.
- The optional LLM layer is only used for unmatched natural-language questions
  and has read-only tools; all bookings and changes go through the deterministic
  confirmation flow. Without an LLM key the chatbot still handles every built-in
  intent.
- Voice input and text-to-speech rely on browser Web Speech APIs and vary by
  browser/device.
- There is no refresh-token rotation; sessions last 1 day.
- `@prisma/client` and `prisma` are still listed in `backend/package.json` but
  are unused — Mongoose is the active data layer.
- The API has an automated end-to-end suite (`npm test` in `backend/`) that
  runs against a temporary in-memory MongoDB. The manual steps below are still
  useful for UI verification.

## Verification

A quick smoke test after starting both servers:

1. Log in as the patient, book a slot for today, then click **Check in**.
   The queue card should show a token, position and estimated wait.
2. Log in as the doctor; the patient appears in the live queue. Use **Call
   token #n**, then **Start**, add a record and **Complete**.
3. Log in as reception and add a walk-in; the doctor's queue updates live.
4. Log in as admin and check **Reports** and **Audit logs**.
5. Open `/display` in another tab; it shows the current token and waiting list.
6. Open the chat widget (bottom-right, not shown on `/display`), accept consent,
   ask “What are your opening hours?”, then try “I want to book an appointment”.
   Confirm the booking summary before it is written.
7. Ask “I have chest pain and shortness of breath” — the assistant should stop
   and give emergency advice instead of booking.
8. Switch language to Hindi and confirm replies change. Use the microphone
   button for voice input and the speaker button for spoken replies.
9. As the patient, open **Reminders** in the chat widget to add, complete or
   cancel a reminder, and **Preferences** to set contact method, preferred
   doctor and reminder toggles.
10. Click **Talk to a person**, then log in as reception and open
    **Chat handoffs** to read the context and reply. The patient sees the staff
    reply in the widget.
11. Log in as a doctor or reception and open **Pre-visit intake** to see the
    chat-collected summary. Log in as admin and open **Chatbot analytics**.

Useful checks:

```bash
# Health
curl http://localhost:5000/api/health

# Public display
curl http://localhost:5000/api/queue/display

# Database setup / verification (uses MONGO_URI from backend/.env)
npm run db:setup
npm run db:check

# Automated end-to-end API tests (temporary in-memory database)
npm test

# Frontend lint + production build
npm run lint
npm run build
```

## API and schema documentation

- [API reference](docs/API.md)
- [Database schema, encryption and RBAC](docs/DATABASE-SCHEMA.md)
=======
# MediQueue_HealthCare_AI_Assistant
>>>>>>> e51427d25afa654e6eac118aaf72fb4ba510ea93
