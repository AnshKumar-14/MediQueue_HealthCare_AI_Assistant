/* eslint-disable no-console */
/**
 * One-shot database setup for MediQueue.
 *
 * Usage (from the backend folder):
 *   npm run db:setup
 *
 * It connects to MONGO_URI (MongoDB Atlas or a local MongoDB server), creates
 * every collection the app uses, syncs all indexes (including TTL cleanup for
 * chat data), seeds the clinic FAQ knowledge base and demo users, then prints
 * a count for each collection so you can verify it in Atlas or Compass.
 *
 * Safe to run repeatedly: setup is idempotent.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const models = {
  users: require("../src/models/User"),
  departments: require("../src/models/Department"),
  doctorprofiles: require("../src/models/DoctorProfile"),
  appointments: require("../src/models/Appointment"),
  queueentries: require("../src/models/QueueEntry"),
  medicalrecords: require("../src/models/MedicalRecord"),
  notifications: require("../src/models/Notification"),
  auditlogs: require("../src/models/AuditLog"),
  clinicinfos: require("../src/models/ClinicInfo"),
  chatconversations: require("../src/models/ChatConversation"),
  chatmessages: require("../src/models/ChatMessage"),
  intakesummaries: require("../src/models/IntakeSummary"),
  reminders: require("../src/models/Reminder"),
};

const { seedDatabase } = require("../src/config/seed");

function redact(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

async function main() {
  const useMemory = process.env.USE_MEMORY_DB === "true";
  let memoryServer = null;
  let uri = process.env.MONGO_URI;

  if (useMemory) {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("mediqueue");
    console.log(
      "USE_MEMORY_DB=true - using a temporary in-memory MongoDB for verification"
    );
  } else if (!uri) {
    uri = "mongodb://127.0.0.1:27017/mediqueue";
    console.log(
      "MONGO_URI is not set. Falling back to mongodb://127.0.0.1:27017/mediqueue"
    );
    console.log(
      "Set MONGO_URI in backend/.env to create the database on MongoDB Atlas."
    );
  }

  console.log(`Connecting to ${redact(uri)} ...`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  console.log(`Connected to database "${db.databaseName}"`);

  // Create collections explicitly so they are visible in Compass even before
  // the first document is written.
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const model of Object.values(models)) {
    const name = model.collection.collectionName;
    if (!existing.has(name)) {
      await model.createCollection();
      console.log(`  created collection ${name}`);
    }
  }

  // Build every index defined in the schemas (unique, compound, TTL, ...).
  for (const model of Object.values(models)) {
    try {
      await model.syncIndexes();
    } catch (error) {
      console.error(
        `  index sync failed for ${model.collection.collectionName}: ${error.message}`
      );
    }
  }
  console.log("Indexes synced");

  // Older builds briefly created a capitalized "User" collection. Mongoose maps
  // the User model to "users", so this collection is unused. Drop it only when
  // it is empty so a real collection with data is never removed.
  if (existing.has("User")) {
    const legacyCount = await db.collection("User").countDocuments();
    if (legacyCount === 0) {
      await db.collection("User").drop();
      console.log("  dropped unused empty collection User");
    }
  }

  await seedDatabase();
  console.log("Seed data ready (clinic info, departments, demo users)");

  const names = (await db.listCollections().toArray())
    .map((collection) => collection.name)
    .sort();

  console.log("\nCollections in this database:");
  for (const name of names) {
    const count = await db.collection(name).countDocuments();
    console.log(`  ${name.padEnd(24)} ${count} document(s)`);
  }

  console.log("\nDatabase name for Compass / Atlas:", db.databaseName);
  console.log(
    "Compass: paste MONGO_URI and the database name above. Atlas: browse the same cluster and database."
  );
  console.log("Setup complete.");

  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

main().catch(async (error) => {
  console.error("Database setup failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
