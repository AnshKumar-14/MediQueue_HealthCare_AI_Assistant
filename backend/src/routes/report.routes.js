const express = require("express");
const router = express.Router();

const { summary } = require("../controllers/report.controller");
const {
  restrictToLogin,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

router.get(
  "/summary",
  restrictToLogin,
  authorizeUserRole("doctor", "admin"),
  summary
);

module.exports = router;
