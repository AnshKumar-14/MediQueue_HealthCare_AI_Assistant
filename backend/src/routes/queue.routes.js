const express = require("express");
const router = express.Router();

const {
  checkIn,
  walkIn,
  getQueue,
  getMyStatus,
  callNext,
  startConsultation,
  completeEntry,
  skipEntry,
  markNoShow,
  display,
} = require("../controllers/queue.controller");
const {
  restrictToLogin,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

// Public waiting-room display
router.get("/display", display);

router.get(
  "/my-status",
  restrictToLogin,
  authorizeUserRole("patient"),
  getMyStatus
);

router.post("/check-in", restrictToLogin, checkIn);

router.post(
  "/walk-in",
  restrictToLogin,
  authorizeUserRole("receptionist", "staff", "admin"),
  walkIn
);

router.get(
  "/",
  restrictToLogin,
  authorizeUserRole("doctor", "receptionist", "staff", "admin"),
  getQueue
);

router.post(
  "/call-next",
  restrictToLogin,
  authorizeUserRole("doctor", "receptionist", "staff", "admin"),
  callNext
);

router.post(
  "/:id/start",
  restrictToLogin,
  authorizeUserRole("doctor", "receptionist", "staff", "admin"),
  startConsultation
);

router.post(
  "/:id/complete",
  restrictToLogin,
  authorizeUserRole("doctor", "receptionist", "staff", "admin"),
  completeEntry
);

router.post(
  "/:id/skip",
  restrictToLogin,
  authorizeUserRole("doctor", "receptionist", "staff", "admin"),
  skipEntry
);

router.post(
  "/:id/no-show",
  restrictToLogin,
  authorizeUserRole("doctor", "receptionist", "staff", "admin"),
  markNoShow
);

module.exports = router;
