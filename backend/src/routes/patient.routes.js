const express = require("express");
const router = express.Router();

const {
  getMyProfile,
  updateMyProfile,
  getMyHistory,
  exportMyData,
} = require("../controllers/patient.controller");
const {
  restrictToLogin,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

router.use(restrictToLogin, authorizeUserRole("patient"));

router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);
router.get("/me/history", getMyHistory);
router.get("/me/export", exportMyData);

module.exports = router;
