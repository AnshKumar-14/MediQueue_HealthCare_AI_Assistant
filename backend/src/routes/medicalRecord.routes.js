const express = require("express");
const router = express.Router();

const {
  createRecord,
  listRecordsForPatient,
  getRecord,
} = require("../controllers/medicalRecord.controller");
const {
  restrictToLogin,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

router.post(
  "/",
  restrictToLogin,
  authorizeUserRole("doctor", "admin"),
  createRecord
);

router.get(
  "/patient/:patientId",
  restrictToLogin,
  authorizeUserRole("patient", "doctor", "receptionist", "staff", "admin"),
  listRecordsForPatient
);

router.get(
  "/:id",
  restrictToLogin,
  authorizeUserRole("patient", "doctor", "receptionist", "staff", "admin"),
  getRecord
);

module.exports = router;
