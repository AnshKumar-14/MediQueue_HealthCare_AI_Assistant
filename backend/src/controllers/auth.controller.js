const bcrypt = require("bcryptjs");
const User = require("../models/User");
const DoctorProfile = require("../models/DoctorProfile");
const { setUser } = require("../services/auth.service");
const { notifyUser } = require("../services/notification.service");
const { encrypt } = require("../utils/crypto");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

// Compared against when an email is unknown so that the response time does not
// reveal whether an account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "mediqueue-invalid-password",
  10
);

const registerUser = async (req, res) => {
  try {
    const {
      role,
      name,
      email,
      phone,
      password,
      specialty,
      licenseNumber,
      staffType,
      department,
      patientProfile,
      medicalInfo,
      consentAccepted,
    } = req.body;

    const normalizedEmail = normalizeEmail(email);

    if (!role || !name || !normalizedEmail || !phone || !password) {
      return res.status(400).json({
        message: "Please provide all required fields",
      });
    }

    if (!["patient", "doctor", "staff"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    if (role === "doctor") {
      if (!specialty || !licenseNumber) {
        return res.status(400).json({
          message: "Specialty and license number are required",
        });
      }
    }

    if (role === "staff" && !staffType) {
      return res.status(400).json({
        message: "Staff type is required",
      });
    }

    if (role === "patient" && !consentAccepted) {
      return res.status(400).json({
        message:
          "Please accept the privacy consent so we can store your medical information.",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    if (role === "doctor") {
      const existingLicense = await User.findOne({ licenseNumber });

      if (existingLicense) {
        return res.status(409).json({
          message: "License number is already registered",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      role,
      name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      consentAccepted: Boolean(consentAccepted),
      ...(department && { department }),
      ...(role === "patient" && patientProfile && { patientProfile }),
    };

    if (role === "patient" && medicalInfo) {
      userData.medicalInfo = encrypt(
        JSON.stringify({
          bloodGroup: medicalInfo.bloodGroup || patientProfile?.bloodGroup || "",
          allergies: medicalInfo.allergies || "",
          conditions: medicalInfo.conditions || "",
          medications: medicalInfo.medications || "",
          notes: medicalInfo.notes || "",
        })
      );
    }

    if (role === "doctor") {
      userData.specialty = specialty;
      userData.licenseNumber = licenseNumber;
    }

    if (role === "staff") {
      userData.staffType = staffType;
    }

    const user = await User.create(userData);

    await notifyUser(user._id, {
      type: "account",
      title: "Welcome to MediQueue",
      message:
        user.status === "approved"
          ? "Your account is ready. You can book appointments right away."
          : "Your account was created and is pending admin approval.",
    });

    return res.status(201).json({
      message:
        user.status === "approved"
          ? "Registration successful"
          : "Registration successful. Your account is pending admin approval.",
      user: {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { password } = req.body;
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail || typeof password !== "string" || !password) {
      return res.status(400).json({
        message: "Please provide all required fields",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (!existingUser) {
      // Keep the timing similar to a real password check and return the same
      // response as a wrong password so accounts cannot be enumerated.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      existingUser.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (existingUser.status !== "approved") {
      return res.status(403).json({
        message:
          existingUser.status === "rejected"
            ? "Your account was rejected. Please contact the admin."
            : "Your account is pending admin approval.",
      });
    }

    const token = setUser(existingUser);
    req.user = { id: existingUser._id, role: existingUser.role };

    res.cookie("loginSessionId", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: existingUser._id,
        role: existingUser.role,
        name: existingUser.name,
        email: existingUser.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("department", "name")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let profileCompleted = null;
    if (user.role === "doctor") {
      const profile = await DoctorProfile.findOne({ userId: user._id })
        .select("profileCompleted")
        .lean();
      profileCompleted = Boolean(profile?.profileCompleted);
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        department: user.department,
        patientProfile: user.patientProfile || {},
        consentAccepted: user.consentAccepted,
        profileCompleted,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user",
    });
  }
};

const logoutUser = (req, res) => {
  res.clearCookie("loginSessionId");
  return res.json({ success: true, message: "Logged out" });
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
};
