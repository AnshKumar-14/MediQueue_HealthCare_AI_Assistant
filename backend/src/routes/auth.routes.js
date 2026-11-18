const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
} = require("../controllers/auth.controller");
const { restrictToLogin } = require("../middlewares/auth.middleware");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in a few minutes.",
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many accounts created from this address. Please try again later.",
  },
});

router.post("/register", registerLimiter, registerUser);
router.post("/login", loginLimiter, loginUser);
router.post("/logout", logoutUser);
router.get("/me", restrictToLogin, getMe);

module.exports = router;
