const bcrypt = require("bcryptjs");
const User = require("../models/User");
const DoctorProfile = require("../models/DoctorProfile");
const AuditLog = require("../models/AuditLog");
const { notifyUser } = require("../services/notification.service");

async function listUsers(req, res) {
  try {
    const { role, status, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("-password -medicalInfo")
      .populate("department", "name")
      .sort({ createdAt: -1 })
      .lean();

    const doctorIds = users
      .filter((user) => user.role === "doctor")
      .map((user) => user._id);

    const profiles = doctorIds.length
      ? await DoctorProfile.find({ userId: { $in: doctorIds } })
          .populate("department", "name")
          .lean()
      : [];

    const profileMap = new Map(
      profiles.map((profile) => [String(profile.userId), profile])
    );

    return res.json({
      success: true,
      users: users.map((user) => ({
        ...user,
        doctorProfile: profileMap.get(String(user._id)) || null,
      })),
    });
  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).json({ success: false, message: "Failed to load users" });
  }
}

async function approveUser(req, res) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "doctor") {
      await DoctorProfile.findOneAndUpdate(
        { userId: user._id },
        { verificationStatus: "approved", profileCompleted: true }
      );
    }

    await notifyUser(user._id, {
      type: "account",
      title: "Account approved",
      message: "Your account has been approved by the admin. You can now log in.",
    });

    return res.json({ success: true, message: "User approved", user });
  } catch (error) {
    console.error("Approve user error:", error);
    return res.status(500).json({ success: false, message: "Failed to approve user" });
  }
}

async function rejectUser(req, res) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "doctor") {
      await DoctorProfile.findOneAndUpdate(
        { userId: user._id },
        { verificationStatus: "rejected" }
      );
    }

    return res.json({ success: true, message: "User rejected", user });
  } catch (error) {
    console.error("Reject user error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject user" });
  }
}

async function createStaff(req, res) {
  try {
    const { name, email, phone, password, role = "receptionist", staffType } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required",
      });
    }

    if (!["receptionist", "admin", "staff"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be receptionist, staff or admin",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const user = await User.create({
      role,
      name,
      email,
      phone,
      password: await bcrypt.hash(password, 10),
      status: "approved",
      ...(role === "staff" && { staffType: staffType || "receptionist" }),
    });

    return res.status(201).json({
      success: true,
      message: "Staff account created",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Create staff error:", error);
    return res.status(500).json({ success: false, message: "Failed to create staff" });
  }
}

async function updateUser(req, res) {
  try {
    const { name, phone, status, specialty, licenseNumber, department, staffType } =
      req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(status !== undefined && { status }),
        ...(specialty !== undefined && { specialty }),
        ...(licenseNumber !== undefined && { licenseNumber }),
        ...(department !== undefined && { department }),
        ...(staffType !== undefined && { staffType }),
      },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, message: "User updated", user });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({ success: false, message: "Failed to update user" });
  }
}

async function updateDoctorSchedule(req, res) {
  try {
    const {
      department,
      availability,
      avgConsultationMinutes,
      consultationFee,
      dailyPatientCapacity,
      isAvailable,
      verificationStatus,
    } = req.body;

    const user = await User.findOne({ _id: req.params.id, role: "doctor" });
    if (!user) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const profile = await DoctorProfile.findOneAndUpdate(
      { userId: user._id },
      {
        ...(department !== undefined && { department }),
        ...(availability !== undefined && { availability }),
        ...(avgConsultationMinutes !== undefined && {
          avgConsultationMinutes: Number(avgConsultationMinutes),
        }),
        ...(consultationFee !== undefined && { consultationFee: Number(consultationFee) }),
        ...(dailyPatientCapacity !== undefined && {
          dailyPatientCapacity: Number(dailyPatientCapacity),
        }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(verificationStatus !== undefined && { verificationStatus }),
        profileCompleted: true,
      },
      { new: true, upsert: true, runValidators: true }
    ).populate("department", "name");

    if (department !== undefined) {
      user.department = department;
      await user.save();
    }

    return res.json({ success: true, message: "Doctor schedule updated", profile });
  } catch (error) {
    console.error("Update doctor schedule error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update doctor schedule",
    });
  }
}

async function listAuditLogs(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await AuditLog.find()
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, logs });
  } catch (error) {
    console.error("List audit logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load audit logs",
    });
  }
}

async function listPatients(req, res) {
  try {
    const users = await User.find({ role: "patient" })
      .select("-password -medicalInfo")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, patients: users });
  } catch (error) {
    console.error("List patients error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load patients",
    });
  }
}

module.exports = {
  listUsers,
  approveUser,
  rejectUser,
  createStaff,
  updateUser,
  updateDoctorSchedule,
  listAuditLogs,
  listPatients,
};
