const User = require("../models/User");
const DoctorProfile = require("../models/DoctorProfile");
const Appointment = require("../models/Appointment");
const { generateSlots } = require("../utils/queue");

const completeDoctorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      qualification,
      experience,
      hospitalName,
      clinicAddress,
      consultationFee,
      availability,
      bio,
      dailyPatientCapacity,
      department,
      avgConsultationMinutes,
      profileImage,
    } = req.body;

    if (
      !qualification ||
      experience === undefined ||
      !hospitalName ||
      !clinicAddress ||
      consultationFee === undefined ||
      !availability ||
      availability.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required profile fields",
      });
    }

    const profile = await DoctorProfile.findOneAndUpdate(
      { userId: userId },
      {
        qualification,
        experience,
        hospitalName,
        clinicAddress,
        consultationFee,
        availability,
        bio,
        dailyPatientCapacity,
        ...(department && { department }),
        ...(avgConsultationMinutes && {
          avgConsultationMinutes: Number(avgConsultationMinutes),
        }),
        ...(profileImage !== undefined && { profileImage }),
        profileCompleted: true,
        verificationStatus: "pending",
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    if (department) {
      await User.findByIdAndUpdate(userId, { department });
    }

    res.status(200).json({
      success: true,
      message: "Doctor profile completed successfully",
      profile,
    });
  } catch (error) {
    console.error("Complete doctor profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete doctor profile",
    });
  }
};

const getDoctorProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await DoctorProfile.findOne({ userId })
      .populate("department", "name location")
      .lean();

    if (!profile) {
      return res.status(200).json({
        success: true,
        profileCompleted: false,
      });
    }

    res.status(200).json({
      success: true,
      profileCompleted: true,
      profile,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get doctor profile",
    });
  }
};

async function listDoctors(req, res) {
  try {
    const { department, search } = req.query;

    const userFilter = { role: "doctor", status: "approved" };
    if (search) {
      userFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { specialty: { $regex: search, $options: "i" } },
      ];
    }

    const doctors = await User.find(userFilter)
      .select("name email phone specialty department")
      .lean();

    const ids = doctors.map((doctor) => doctor._id);
    const profileFilter = { userId: { $in: ids }, profileCompleted: true };
    if (department) profileFilter.department = department;

    const profiles = await DoctorProfile.find(profileFilter)
      .populate("department", "name location")
      .lean();

    const profileMap = new Map(
      profiles.map((profile) => [String(profile.userId), profile])
    );

    const result = doctors
      .filter((doctor) => profileMap.has(String(doctor._id)))
      .map((doctor) => {
        const profile = profileMap.get(String(doctor._id));
        return {
          _id: doctor._id,
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          specialty: doctor.specialty,
          department: profile.department || doctor.department,
          qualification: profile.qualification,
          experience: profile.experience,
          consultationFee: profile.consultationFee,
          bio: profile.bio,
          availability: profile.availability,
          avgConsultationMinutes: profile.avgConsultationMinutes,
          profileImage: profile.profileImage,
        };
      });

    return res.json({ success: true, doctors: result });
  } catch (error) {
    console.error("List doctors error:", error);
    return res.status(500).json({ success: false, message: "Failed to load doctors" });
  }
}

async function getDoctorById(req, res) {
  try {
    const doctor = await User.findOne({
      _id: req.params.id,
      role: "doctor",
      status: "approved",
    })
      .select("name email phone specialty department")
      .lean();

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const profile = await DoctorProfile.findOne({ userId: doctor._id })
      .populate("department", "name location")
      .lean();

    if (!profile?.profileCompleted) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile is not complete",
      });
    }

    return res.json({
      success: true,
      doctor: {
        ...doctor,
        department: profile.department || doctor.department,
        profile,
      },
    });
  } catch (error) {
    console.error("Get doctor error:", error);
    return res.status(500).json({ success: false, message: "Failed to load doctor" });
  }
}

async function getDoctorSlots(req, res) {
  try {
    const date = req.query.date;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "A valid date (YYYY-MM-DD) is required",
      });
    }

    const profile = await DoctorProfile.findOne({ userId: req.params.id }).lean();

    if (!profile?.profileCompleted) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const appointments = await Appointment.find({
      doctor: req.params.id,
      date,
      isActive: true,
    })
      .select("startTime")
      .lean();

    const bookedStartTimes = appointments.map((appointment) => appointment.startTime);
    const slots = generateSlots(profile.availability, date, bookedStartTimes, 30);

    return res.json({
      success: true,
      date,
      slots,
      firstAvailable: slots[0]?.startTime || null,
    });
  } catch (error) {
    console.error("Get doctor slots error:", error);
    return res.status(500).json({ success: false, message: "Failed to load slots" });
  }
}

module.exports = {
  completeDoctorProfile,
  getDoctorProfile,
  listDoctors,
  getDoctorById,
  getDoctorSlots,
};
