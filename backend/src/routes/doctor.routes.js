const express = require("express");
const router = express.Router();

const {
  completeDoctorProfile,
  getDoctorProfile,
  listDoctors,
  getDoctorById,
  getDoctorSlots,
} = require("../controllers/doctor.controller");
const {
  restrictToLogin,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

// Public directory
router.get("/", listDoctors);
router.get("/:id/slots", getDoctorSlots);

// Doctor's own profile
router.get(
  "/profile",
  restrictToLogin,
  authorizeUserRole("doctor"),
  getDoctorProfile
);
router.post(
  "/profile",
  restrictToLogin,
  authorizeUserRole("doctor"),
  completeDoctorProfile
);

router.get("/:id", getDoctorById);

module.exports = router;
