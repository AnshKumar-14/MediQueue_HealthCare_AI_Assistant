const express = require("express");
const rateLimit = require("express-rate-limit");

const controller = require("../controllers/chat.controller");
const {
  restrictToLogin,
  optionalAuth,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Math.max(Number(process.env.CHAT_REQUESTS_PER_MINUTE) || 40, 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many chat requests. Please wait a moment and try again.",
  },
});

const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Math.max(Number(process.env.CHAT_SESSIONS_PER_MINUTE) || 20, 5),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many chat sessions. Please wait a moment and try again.",
  },
});

/* ------------------------------------------------------------------ */
/* Session + messaging (guest friendly)                                */
/* ------------------------------------------------------------------ */

router.post("/session", sessionLimiter, optionalAuth, controller.createSession);

router.get(
  "/conversations/me",
  restrictToLogin,
  authorizeUserRole("patient"),
  controller.listMyConversations
);

/* ------------------------------------------------------------------ */
/* Personalisation: preferences + reminders                            */
/* ------------------------------------------------------------------ */

router.get(
  "/preferences",
  restrictToLogin,
  authorizeUserRole("patient"),
  controller.getPreferences
);

router.put(
  "/preferences",
  restrictToLogin,
  authorizeUserRole("patient"),
  controller.updatePreferences
);

// PATCH is an alias so clients can use partial-update semantics.
router.patch(
  "/preferences",
  restrictToLogin,
  authorizeUserRole("patient"),
  controller.updatePreferences
);

router.get(
  "/reminders",
  restrictToLogin,
  authorizeUserRole("patient"),
  controller.listReminders
);

router.post(
  "/reminders",
  restrictToLogin,
  authorizeUserRole("patient"),
  controller.createReminder
);

router.delete(
  "/reminders/:id",
  restrictToLogin,
  authorizeUserRole("patient"),
  controller.cancelReminder
);

router.post(
  "/reminders/:id/ack",
  restrictToLogin,
  authorizeUserRole("patient"),
  controller.acknowledgeReminder
);

/* ------------------------------------------------------------------ */
/* Pre-visit intake summaries                                          */
/* ------------------------------------------------------------------ */

router.get(
  "/intakes",
  restrictToLogin,
  authorizeUserRole("patient", "doctor", "receptionist", "staff", "admin"),
  controller.listIntakes
);

router.patch(
  "/intakes/:id",
  restrictToLogin,
  authorizeUserRole("doctor", "receptionist", "staff", "admin"),
  controller.updateIntake
);

/* ------------------------------------------------------------------ */
/* Human handoff (staff)                                               */
/* ------------------------------------------------------------------ */

router.get(
  "/handoffs",
  restrictToLogin,
  authorizeUserRole("receptionist", "staff", "admin"),
  controller.listHandoffs
);

router.get(
  "/handoffs/:id",
  restrictToLogin,
  authorizeUserRole("receptionist", "staff", "admin"),
  controller.getHandoff
);

router.post(
  "/handoffs/:id/reply",
  restrictToLogin,
  authorizeUserRole("receptionist", "staff", "admin"),
  controller.replyToHandoff
);

router.post(
  "/handoffs/:id/resolve",
  restrictToLogin,
  authorizeUserRole("receptionist", "staff", "admin"),
  controller.resolveHandoff
);

/* ------------------------------------------------------------------ */
/* Staff analytics                                                     */
/* ------------------------------------------------------------------ */

router.get(
  "/analytics",
  restrictToLogin,
  authorizeUserRole("admin"),
  controller.analytics
);

/* ------------------------------------------------------------------ */
/* External channels (WhatsApp / SMS webhook)                          */
/* ------------------------------------------------------------------ */

router.post("/webhook/:channel", chatLimiter, controller.channelWebhook);

/* ------------------------------------------------------------------ */
/* Single conversation routes                                          */
/* ------------------------------------------------------------------ */

router.get("/:id", optionalAuth, controller.getConversation);
router.post("/:id/messages", chatLimiter, optionalAuth, controller.sendMessage);
router.post("/:id/stream", chatLimiter, optionalAuth, controller.streamMessage);
router.post("/:id/consent", optionalAuth, controller.giveConsent);
router.post("/:id/language", optionalAuth, controller.setConversationLanguage);
router.post("/:id/feedback", optionalAuth, controller.submitFeedback);
router.post("/:id/handoff", optionalAuth, controller.requestHandoff);
router.post("/:id/close", optionalAuth, controller.closeConversation);
router.delete("/:id", optionalAuth, controller.deleteConversation);

module.exports = router;
