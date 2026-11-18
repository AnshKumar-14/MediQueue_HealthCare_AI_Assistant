# MediQueue API Reference

Base URL: `http://localhost:5000`

All responses are JSON and include `success: true|false`. Errors include a
`message`. Authentication uses an HTTP-only cookie set by `POST /api/auth/login`;
browser clients must send credentials (`credentials: "include"`).

## Authentication

| Method | Path | Access | Body / query |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | `role`, `name`, `email`, `phone`, `password`; doctor: `specialty`, `licenseNumber`, optional `department`; staff: `staffType`; patient: `consentAccepted`, `patientProfile`, `medicalInfo` |
| POST | `/api/auth/login` | Public | `email`, `password` |
| POST | `/api/auth/logout` | Public | — |
| GET | `/api/auth/me` | Logged in | — |

Registration notes:

- `role` must be `patient`, `doctor` or `staff`.
- Patients must send `consentAccepted: true`.
- `patientProfile`: `{ dateOfBirth, gender, address, bloodGroup, emergencyContact }`.
- `medicalInfo`: `{ bloodGroup, allergies, conditions, medications, notes }` — encrypted at rest.
- Doctors and non-patient staff start in `pending` status and need admin approval.
- Login/register are rate-limited: 20 failed logins per 15 minutes per IP and 20
  registrations per hour per IP.
- An unknown email and a wrong password both return `401` with
  `Invalid email or password`.

Example:

```bash
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@mediqueue.com","password":"Patient@123"}'
```

## Doctors (public directory)

| Method | Path | Access | Body / query |
| --- | --- | --- | --- |
| GET | `/api/doctors` | Public | `department`, `search` |
| GET | `/api/doctors/:id` | Public | — |
| GET | `/api/doctors/:id/slots` | Public | `date=YYYY-MM-DD` (required) |
| GET | `/api/doctor/profile` | Doctor | — |
| POST | `/api/doctor/profile` | Doctor | `qualification`, `experience`, `hospitalName`, `clinicAddress`, `consultationFee`, `availability[]`, `bio`, `dailyPatientCapacity`, optional `department`, `avgConsultationMinutes`, `profileImage` |

`availability` items: `{ day: "Monday", startTime: "09:00", endTime: "13:00" }`.

Slots are generated in 30-minute steps inside each availability window and
exclude times that already have an active appointment. Response includes
`slots: [{ startTime, endTime, available }]` and `firstAvailable`.

`/api/doctor/*` is an alias of `/api/doctors/*` for the profile routes.

## Departments

| Method | Path | Access | Body |
| --- | --- | --- | --- |
| GET | `/api/departments` | Public | — |
| POST | `/api/departments` | Admin | `name`, `description`, `location` |
| PATCH | `/api/departments/:id` | Admin | Any of the above, `isActive` |
| DELETE | `/api/departments/:id` | Admin | — |

## Appointments

| Method | Path | Access | Body / query |
| --- | --- | --- | --- |
| POST | `/api/appointments` | Patient, staff, admin | `doctorId`, `date`, `startTime`, optional `departmentId`, `reason`, `priority`, staff only: `patientId` |
| GET | `/api/appointments/me` | Patient | — |
| GET | `/api/appointments/doctor` | Doctor, staff, admin | `date`, staff/admin: `doctorId` |
| GET | `/api/appointments/:id` | Owner, doctor, staff, admin | — |
| PATCH | `/api/appointments/:id/cancel` | Owner, doctor, staff, admin | optional `reason` |
| PATCH | `/api/appointments/:id/reschedule` | Owner, staff, admin | `date`, `startTime` |

Booking rules:

- `date` must be `YYYY-MM-DD` and today or later.
- `priority` is `normal`, `senior`, `pregnant` or `emergency`; `emergency` is
  only accepted from staff/admin.
- The slot must still be free. A unique partial index on
  `(doctor, date, startTime)` prevents double booking.
- Booking sends `booking-confirmation` (in-app/email/sms) and `reminder`
  notifications.
- Cancelling releases the slot, cancels an active queue entry and broadcasts a
  queue update.
- Rescheduling validates the new slot against the doctor's availability.

## Live queue

| Method | Path | Access | Body / query |
| --- | --- | --- | --- |
| GET | `/api/queue/display` | Public | optional `date=YYYY-MM-DD` |
| GET | `/api/queue/my-status` | Patient | — |
| POST | `/api/queue/check-in` | Logged in (owner/doctor/staff) | `appointmentId`, optional `priority` |
| POST | `/api/queue/walk-in` | Receptionist, staff, admin | `doctorId`, optional `patientId`; otherwise `name`, `phone`, optional `email`, `priority`, `notes` |
| GET | `/api/queue` | Doctor, staff, admin | `doctorId` (staff/admin), `date` |
| POST | `/api/queue/call-next` | Doctor, staff, admin | `doctorId` (staff/admin), `date` |
| POST | `/api/queue/:id/start` | Doctor, staff, admin | — |
| POST | `/api/queue/:id/complete` | Doctor, staff, admin | — |
| POST | `/api/queue/:id/skip` | Doctor, staff, admin | — |
| POST | `/api/queue/:id/no-show` | Doctor, staff, admin | — |

Check-in rules:

- Allowed only on the appointment date for statuses that are not
  `cancelled`, `completed` or `no-show`.
- Re-checking in returns the existing active entry (`200`).
- A new entry returns `201`, the queue entry and the refreshed queue.
- Walk-ins create a lightweight patient account when no existing patient
  matches the email or phone.

Queue response shape (`GET /api/queue`):

```json
{
  "success": true,
  "queue": {
    "date": "2026-10-30",
    "doctorId": "...",
    "current": { "tokenNumber": 3, "status": "in-progress", "patient": { "name": "..." } },
    "waiting": [
      { "tokenNumber": 4, "position": 1, "estimatedWaitMinutes": 10, "priority": "senior" }
    ],
    "completed": [],
    "skipped": [],
    "stats": {
      "total": 5,
      "waiting": 1,
      "completed": 1,
      "skipped": 0,
      "noShow": 0,
      "avgWaitMinutes": 7.5,
      "avgConsultationMinutes": 10
    }
  }
}
```

Ordering weights: `emergency` 0, `pregnant`/`senior` 1, `normal` 2; ties break
on check-in time, then token number.

`GET /api/queue/my-status` returns `{ success, today, active[] }`. Each active
item contains `{ entry, doctor, department, position, estimatedWaitMinutes,
currentToken, nowServing, totalWaiting, queue }`.

`GET /api/queue/display` groups active entries by doctor for the public screen:

```json
{
  "success": true,
  "display": {
    "date": "2026-10-30",
    "updatedAt": "...",
    "doctors": [
      {
        "doctor": { "name": "Dr. Ananya Sharma" },
        "department": { "name": "Cardiology" },
        "current": { "tokenNumber": 1, "status": "in-progress", "patientName": "..." },
        "waiting": [{ "tokenNumber": 2, "patientName": "...", "priority": "normal", "position": 1 }],
        "remaining": 1
      }
    ]
  }
}
```

## Patients

| Method | Path | Access | Body |
| --- | --- | --- | --- |
| GET | `/api/patients/me` | Patient | — |
| PUT | `/api/patients/me` | Patient | `name`, `phone`, `patientProfile`, `medicalInfo`, `consentAccepted` |
| GET | `/api/patients/me/history` | Patient | — |
| GET | `/api/patients/me/export` | Patient | — |

`GET /me` and `PUT /me` decrypt and return `medicalInfo`. Export returns the
profile, decrypted medical info, appointments, medical records and queue
entries as a downloadable JSON payload.

## Medical records

| Method | Path | Access | Body / query |
| --- | --- | --- | --- |
| POST | `/api/records` | Doctor, admin | `patientId`, optional `appointmentId`, `queueEntryId`, `diagnosis`, `notes`, `prescription`, `followUpDate` |
| GET | `/api/records/patient/:patientId` | Patient (self), doctor, staff, admin | — |
| GET | `/api/records/:id` | Patient (self), doctor, staff, admin | — |

`diagnosis`, `notes` and `prescription` are encrypted with AES-256-GCM before
storage and decrypted on read. A doctor only lists their own records for a
patient. Creating a record with `queueEntryId` marks that queue entry
`completed`; with `appointmentId` it marks the appointment `completed`.

## Reports

| Method | Path | Access | Query |
| --- | --- | --- | --- |
| GET | `/api/reports/summary` | Doctor, admin | `from`, `to` (YYYY-MM-DD), admin only: `doctorId` |

Response includes:

- `range` and `totals` (`appointments`, `completed`, `cancelled`, `noShow`,
  `noShowRate`, `queueEntries`, `patientsWaiting`).
- `averages` (`waitMinutes`, `consultationMinutes`).
- `peakHours`: appointment count per hour of day.
- `doctorLoad`: total and completed appointments per doctor.
- `dailyTrend`: appointment volume per date.
- `doctors`: approved doctors (for admin filtering).

Doctors are automatically scoped to their own data.

## Notifications

| Method | Path | Access | Query |
| --- | --- | --- | --- |
| GET | `/api/notifications` | Logged in | `limit` (default 50, max 100) |
| PATCH | `/api/notifications/read-all` | Logged in | — |
| PATCH | `/api/notifications/:id/read` | Logged in | — |

`GET` returns `notifications` and an `unread` count. Channels are recorded as
`in-app`, `email`, `sms` or `push`; email/SMS are mock delivery logs in this
demo.

Chat-related notification types: `chat-handoff`, `chat-reply`,
`medication-reminder`, `follow-up`.

## Admin

All `/api/admin/*` routes require the `admin` role.

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/api/admin/users` | `role`, `status`, `search` |
| PATCH | `/api/admin/users/:id/approve` | — |
| PATCH | `/api/admin/users/:id/reject` | — |
| PATCH | `/api/admin/users/:id` | `name`, `phone`, `status`, `specialty`, `licenseNumber`, `department`, `staffType` |
| POST | `/api/admin/staff` | `name`, `email`, `phone`, `password`, `role` (`receptionist`/`staff`/`admin`), optional `staffType` |
| PATCH | `/api/admin/doctors/:id/schedule` | `department`, `availability[]`, `avgConsultationMinutes`, `consultationFee`, `dailyPatientCapacity`, `isAvailable`, `verificationStatus` |
| GET | `/api/admin/patients` | — |
| GET | `/api/admin/audit-logs` | `limit` (default 100, max 500) |

Approving a doctor sets the user to `approved` and the profile to
`profileCompleted: true` / `verificationStatus: "approved"`.

## AI chat assistant

Base path: `/api/chat`. Browser clients send the `loginSessionId` cookie
(`credentials: "include"`); guests are tracked with a signed visitor cookie so
their conversation can be resumed and later claimed after sign-in.

Rate limits: 40 requests/minute per IP for chat routes and 60 user messages/hour
per conversation.

| Method | Path | Access | Body / query |
| --- | --- | --- | --- |
| POST | `/api/chat/session` | Public | `{ conversationId? }` — resume or start a conversation |
| GET | `/api/chat/:id` | Owner / staff | — |
| POST | `/api/chat/:id/consent` | Owner | `{ version }` |
| POST | `/api/chat/:id/language` | Owner | `{ locale }` (`en`, `hi`, `es`, `fr`, `ar`) |
| POST | `/api/chat/:id/messages` | Owner | `{ text }` — JSON reply |
| POST | `/api/chat/:id/stream` | Owner | `{ text }` — Server-Sent Events |
| POST | `/api/chat/:id/feedback` | Owner | `{ messageId, rating: "up" \| "down" }` |
| POST | `/api/chat/:id/handoff` | Owner | `{ reason? }` |
| POST | `/api/chat/:id/close` | Owner | — |
| DELETE | `/api/chat/:id` | Owner | — |
| GET / PUT / PATCH | `/api/chat/preferences` | Logged in | `language`, `contactMethod`, `preferredDoctor`, `medicationReminders`, `followUpReminders`, `voiceReplies` |
| GET | `/api/chat/reminders` | Logged in | — |
| POST | `/api/chat/reminders` | Logged in | `{ type: "medication" \| "follow-up" \| "appointment", title, message, scheduledFor, channel? }` |
| DELETE | `/api/chat/reminders/:id` | Logged in | — |
| POST | `/api/chat/reminders/:id/ack` | Logged in | — |
| GET | `/api/chat/intakes` | Doctor / staff / admin | `status`, `doctor` |
| PATCH | `/api/chat/intakes/:id` | Doctor / staff / admin | `status`, `staffNotes`, `suggestedPriority` |
| GET | `/api/chat/handoffs` | Staff / admin | `status` (`waiting` default, `handoff-active`, `closed`) |
| GET | `/api/chat/handoffs/:id` | Staff / admin | — |
| POST | `/api/chat/handoffs/:id/reply` | Staff / admin | `{ text }` |
| POST | `/api/chat/handoffs/:id/resolve` | Staff / admin | — |
| GET | `/api/chat/analytics` | Admin | `days` (7, 30, 90) |
| POST | `/api/chat/webhook/:channel` | Shared secret | `{ from, text, name? }` for `whatsapp` / `sms` |

Inbound WhatsApp/SMS messages are answered in the webhook response. Reminders
created with `channel: "sms"`, `"whatsapp"` or `"email"` are also delivered
outbound when `CHANNEL_OUTBOUND_URL` or Twilio credentials are configured; the
in-app notification is always created.

### Session payload

```json
{
  "success": true,
  "conversation": {
    "id": "…",
    "channel": "web",
    "locale": "en",
    "language": "English",
    "status": "active",
    "consent": { "given": false },
    "signedIn": false,
    "disclaimer": "…"
  },
  "messages": [],
  "suggestions": ["Book an appointment", "Check queue"],
  "locales": [{ "code": "en", "label": "English" }]
}
```

### Message payload

```json
{
  "success": true,
  "reply": "…",
  "assistantMessage": { "_id": "…", "role": "assistant", "content": "…" },
  "suggestions": ["…"],
  "conversation": { "id": "…", "status": "active" }
}
```

`POST /:id/stream` emits SSE frames:

```
data: {"type":"user","message":{…}}
data: {"type":"chunk","delta":"Clinic "}
data: {"type":"done","reply":"…","assistantMessage":{…},"conversation":{…}}
data: {"type":"error","message":"…"}
```

### Safety and retention

- Personal and medical data requires an authenticated owner (or staff with the
  appropriate role). Guests can book only after signing in.
- Every state-changing action (booking, reschedule, cancel, walk-in, handoff,
  reminder) passes through an explicit confirmation step.
- Chat content is encrypted at rest, excluded from audit bodies, and removed by a
  TTL index after `CHAT_RETENTION_DAYS` (default 30). Audit logs are retained for
  180 days.
- Triage never diagnoses, prescribes or recommends medication; red flags stop the
  flow with emergency advice.
- The optional LLM layer only receives read-only tools and grounded clinic data.

## Health

| Method | Path | Access |
| --- | --- | --- |
| GET | `/` | Public — plain text status |
| GET | `/api/health` | Public — uptime and server time |

## Socket.IO

Connect to the same origin as the API (`http://localhost:5000`) with
`withCredentials: true`.

Client → server:

```js
socket.emit("join", { doctorId: "<doctor user id>" });
```

Server → client:

```js
socket.on("queue:update", ({ doctorId, date, at }) => {
  // Refetch the queue / appointments.
});
```

Namespaces/rooms:

- `queue:doctor:<doctorId>` — sockets interested in one doctor.
- `queue:all` — all connected sockets (used by the public display).

## Audit logging

Every non-GET request is recorded after the response finishes:

- `actor` and `actorRole`
- `action` (`"METHOD /path"`)
- `entity` (first path segment after `/api`) and `entityId`
- sanitized request body and params (`password`, `token`, etc. redacted)

Chat message content, intake free text and reminder message bodies are always
redacted before an audit entry is written. Conversation ids may still appear as
entity ids so staff actions remain traceable.
- IP and user agent

Audit logs are retained for 180 days via a TTL index.
