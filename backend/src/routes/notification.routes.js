const express = require("express");
const router = express.Router();

const {
  listMine,
  markRead,
  markAllRead,
} = require("../controllers/notification.controller");
const { restrictToLogin } = require("../middlewares/auth.middleware");

router.use(restrictToLogin);

router.get("/", listMine);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

module.exports = router;
