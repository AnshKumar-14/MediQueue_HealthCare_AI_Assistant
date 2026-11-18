const AuditLog = require("../models/AuditLog");

const SENSITIVE_FIELDS = [
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "loginSessionId",
  "authorization",
  "cookie",
  "secret",
  "apiKey",
];

// Chat and medical free text must never land in the audit trail. We keep the
// key (so the audit still shows that a field was submitted) but redact values.
const SENSITIVE_PATTERNS = [
  /^text$/i,
  /^message$/i,
  /^messages$/i,
  /^content$/i,
  /^comment$/i,
  /^feedbackComment$/i,
  /^reason$/i,
  /^symptoms?$/i,
  /^diagnosis$/i,
  /^notes?$/i,
  /^prescription$/i,
  /^medications?$/i,
  /^allergies$/i,
  /^duration$/i,
  /^staffNotes$/i,
  /^medicalInfo$/i,
  /^reply$/i,
  /^summary$/i,
  /^externalId$/i,
  /^from$/i,
];

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;

function isSensitiveKey(key) {
  if (SENSITIVE_FIELDS.includes(key)) return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitize(value, depth = 0) {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  }
  if (typeof value !== "object") return value;

  const clean = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      clean[key] = REDACTED;
      continue;
    }
    clean[key] = sanitize(entry, depth + 1);
  }
  return clean;
}

function auditMiddleware(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  res.on("finish", () => {
    const path = req.originalUrl.split("?")[0];
    const segments = path.split("/").filter(Boolean);
    const entity = segments[1] || "unknown";
    const entityId = req.params?.id || req.params?.appointmentId || null;

    AuditLog.create({
      actor: req.user?.id,
      actorRole: req.user?.role,
      // Never store webhook or session secrets in the action string.
      action: `${req.method} ${path}`.slice(0, 300),
      entity,
      entityId: entityId ? String(entityId) : null,
      changes: {
        body: sanitize(req.body || {}),
        params: sanitize(req.params || {}),
      },
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch((error) => console.error("Audit log error:", error.message));
  });

  return next();
}

module.exports = auditMiddleware;
module.exports.sanitize = sanitize;
