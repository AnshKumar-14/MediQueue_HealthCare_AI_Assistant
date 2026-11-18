const Notification = require("../models/Notification");

async function listMine(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unread = await Notification.countDocuments({
      user: req.user.id,
      read: false,
    });

    return res.json({ success: true, notifications, unread });
  } catch (error) {
    console.error("List notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load notifications",
    });
  }
}

async function markRead(req, res) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({ success: true, notification });
  } catch (error) {
    console.error("Mark notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
}

async function markAllRead(req, res) {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    return res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notifications",
    });
  }
}

module.exports = { listMine, markRead, markAllRead };
