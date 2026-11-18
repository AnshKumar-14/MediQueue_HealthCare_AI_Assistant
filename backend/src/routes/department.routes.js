const express = require("express");
const router = express.Router();
const {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/department.controller");
const {
  restrictToLogin,
  authorizeUserRole,
} = require("../middlewares/auth.middleware");

router.get("/", listDepartments);

router.post("/", restrictToLogin, authorizeUserRole("admin"), createDepartment);
router.patch("/:id", restrictToLogin, authorizeUserRole("admin"), updateDepartment);
router.delete("/:id", restrictToLogin, authorizeUserRole("admin"), deleteDepartment);

module.exports = router;
