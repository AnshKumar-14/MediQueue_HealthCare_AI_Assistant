const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { Server } = require("socket.io");

const connectDB = require("./src/config/db");
const { seedDatabase } = require("./src/config/seed");
const authRoutes = require("./src/routes/auth.routes");
const doctorRoutes = require("./src/routes/doctor.routes");
const departmentRoutes = require("./src/routes/department.routes");
const appointmentRoutes = require("./src/routes/appointment.routes");
const queueRoutes = require("./src/routes/queue.routes");
const adminRoutes = require("./src/routes/admin.routes");
const patientRoutes = require("./src/routes/patient.routes");
const notificationRoutes = require("./src/routes/notification.routes");
const reportRoutes = require("./src/routes/report.routes");
const medicalRecordRoutes = require("./src/routes/medicalRecord.routes");
const chatRoutes = require("./src/routes/chat.routes");
const auditMiddleware = require("./src/middlewares/audit.middleware");
const { startReminderScheduler } = require("./src/services/chat/reminder.service");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
});

app.set("io", io);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(auditMiddleware);

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/records", medicalRecordRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("MediQueue API is running");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    time: new Date(),
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, message: "Internal server error" });
});

io.on("connection", (socket) => {
  socket.emit("connected", { at: Date.now() });

  socket.on("join", ({ doctorId } = {}) => {
    if (doctorId) socket.join(`queue:doctor:${doctorId}`);
    socket.join("queue:all");
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await seedDatabase();
  startReminderScheduler();

  server.listen(PORT, () => {
    console.log(`MediQueue API running at http://localhost:${PORT}`);
  });
};

startServer();
