const express = require("express");
const router = express.Router();

const {
  listUsers,
  approveUser,
  rejectUser,
  createStaff,
  updateUser,
  updateDoctorSchedule,
  listAuditLogs,
  listPatients,
} = require("../controllers/admin.controller");
const {
  restrictToLogin,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

router.use(restrictToLogin, authorizeUserRole("admin"));

router.get("/users", listUsers);
router.patch("/users/:id/approve", approveUser);
router.patch("/users/:id/reject", rejectUser);
router.patch("/users/:id", updateUser);
router.post("/staff", createStaff);
router.patch("/doctors/:id/schedule", updateDoctorSchedule);
router.get("/patients", listPatients);
router.get("/audit-logs", listAuditLogs);

module.exports = router;
