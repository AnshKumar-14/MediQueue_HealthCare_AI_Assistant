const Department = require("../models/Department");
const DoctorProfile = require("../models/DoctorProfile");

async function listDepartments(req, res) {
  try {
    const filter = { isActive: true };
    if (req.user?.role === "admin" && req.query.includeInactive === "true") {
      delete filter.isActive;
    }

    const departments = await Department.find(filter).sort({ name: 1 }).lean();

    const counts = await DoctorProfile.aggregate([
      { $match: { department: { $ne: null }, profileCompleted: true } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));

    return res.json({
      success: true,
      departments: departments.map((department) => ({
        ...department,
        doctorCount: countMap.get(String(department._id)) || 0,
      })),
    });
  } catch (error) {
    console.error("List departments error:", error);
    return res.status(500).json({ success: false, message: "Failed to load departments" });
  }
}

async function createDepartment(req, res) {
  try {
    const { name, description = "", location = "" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Department name is required" });
    }

    const department = await Department.create({
      name: name.trim(),
      description,
      location,
    });

    return res.status(201).json({ success: true, department });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Department already exists" });
    }
    console.error("Create department error:", error);
    return res.status(500).json({ success: false, message: "Failed to create department" });
  }
}

async function updateDepartment(req, res) {
  try {
    const { name, description, location, isActive } = req.body;

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    return res.json({ success: true, department });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Department already exists" });
    }
    console.error("Update department error:", error);
    return res.status(500).json({ success: false, message: "Failed to update department" });
  }
}

async function deleteDepartment(req, res) {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    return res.json({ success: true, message: "Department deactivated", department });
  } catch (error) {
    console.error("Delete department error:", error);
    return res.status(500).json({ success: false, message: "Failed to deactivate department" });
  }
}

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
