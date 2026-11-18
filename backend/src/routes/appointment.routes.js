const express = require("express");
const router = express.Router();

const {
  bookAppointment,
  listMyAppointments,
  listDoctorAppointments,
  getAppointment,
  cancelAppointment,
  rescheduleAppointment,
} = require("../controllers/appointment.controller");
const {
  restrictToLogin,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

router.post(
  "/",
  restrictToLogin,
  authorizeUserRole("patient", "receptionist", "staff", "admin"),
  bookAppointment
);

router.get(
  "/me",
  restrictToLogin,
  authorizeUserRole("patient"),
  listMyAppointments
);

router.get(
  "/doctor",
  restrictToLogin,
  authorizeUserRole("doctor", "receptionist", "staff", "admin"),
  listDoctorAppointments
);

router.get("/:id", restrictToLogin, getAppointment);

router.patch("/:id/cancel", restrictToLogin, cancelAppointment);
router.patch("/:id/reschedule", restrictToLogin, rescheduleAppointment);

module.exports = router;
