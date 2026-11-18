/* eslint-disable no-console */
/**
 * Read-only database health check.
 *
 * Usage (from the backend folder):
 *   npm run db:check
 *   USE_MEMORY_DB=true npm run db:check   (temporary in-memory database)
 *
 * Verifies the connection, lists collections, document counts and indexes.
 * Never writes or deletes anything in a persistent database. In memory mode the
 * collections and indexes are created inside the throwaway database so the
 * report is meaningful.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const models = [
  require("../src/models/User"),
  require("../src/models/Department"),
  require("../src/models/DoctorProfile"),
  require("../src/models/Appointment"),
  require("../src/models/QueueEntry"),
  require("../src/models/MedicalRecord"),
  require("../src/models/Notification"),
  require("../src/models/AuditLog"),
  require("../src/models/ClinicInfo"),
  require("../src/models/ChatConversation"),
  require("../src/models/ChatMessage"),
  require("../src/models/IntakeSummary"),
  require("../src/models/Reminder"),
];

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
      "USE_MEMORY_DB=true - checking a temporary in-memory MongoDB"
    );
  } else if (!uri) {
    uri = "mongodb://127.0.0.1:27017/mediqueue";
    console.log(
      "MONGO_URI is not set. Falling back to mongodb://127.0.0.1:27017/mediqueue"
    );
  }

  console.log(`Connecting to ${redact(uri)} ...`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  console.log(`Connected to database "${db.databaseName}"\n`);

  // A memory database starts empty, so build the schema inside it before
  // reporting. This never runs against Atlas or a local persistent server.
  if (useMemory) {
    for (const model of models) {
      await model.createCollection();
      await model.syncIndexes();
    }
    console.log("Created collections and indexes in the in-memory database\n");
  }

  const expected = models.map((model) => model.collection.collectionName).sort();
  const actual = (await db.listCollections().toArray()).map((c) => c.name);
  const missing = expected.filter((name) => !actual.includes(name));
  const unexpected = actual
    .filter((name) => !expected.includes(name))
    .sort();

  for (const name of actual.sort()) {
    const count = await db.collection(name).countDocuments();
    const indexes = await db.collection(name).indexes();
    console.log(`${name}: ${count} document(s), ${indexes.length} index(es)`);
    for (const index of indexes) {
      const flags = [];
      if (index.unique) flags.push("unique");
      if (index.expireAfterSeconds !== undefined) {
        flags.push(`ttl=${index.expireAfterSeconds}s`);
      }
      console.log(
        `  - ${Object.entries(index.key)
          .map(([field, direction]) => `${field}:${direction}`)
          .join(", ")}${flags.length ? ` (${flags.join(", ")})` : ""}`
      );
    }
  }

  console.log("");
  if (missing.length) {
    console.log("Missing collections:", missing.join(", "));
    console.log("Run `npm run db:setup` to create them.");
  } else {
    console.log("All expected collections exist.");
  }

  if (unexpected.length) {
    console.log(
      `Unexpected collections: ${unexpected.join(", ")} (not used by the app)`
    );
  }

  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

main().catch(async (error) => {
  console.error("Database check failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
