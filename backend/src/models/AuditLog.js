const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    actorRole: String,
    action: {
      type: String,
      required: true,
    },
    entity: String,
    entityId: String,
    changes: {
      type: mongoose.Schema.Types.Mixed,
    },
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

// Keep audit logs for 180 days, then expire automatically.
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
