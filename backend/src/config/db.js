const mongoose = require("mongoose");
require("dotenv").config();

let memoryServer;

const connectDB = async () => {
  try {
    let dbUrl = process.env.MONGO_URI;
    const forceMemory = process.env.USE_MEMORY_DB === "true";

    // Zero-config local development: when no MONGO_URI is provided, start an
    // in-memory MongoDB instance so the API can run without a local install.
    // Data is lost when the process stops. Set MONGO_URI to use a real database.
    // USE_MEMORY_DB=true forces the in-memory database even when MONGO_URI is set.
    if (!dbUrl || forceMemory) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("MONGO_URI is required in production");
      }

      const { MongoMemoryServer } = require("mongodb-memory-server");
      memoryServer = await MongoMemoryServer.create();
      dbUrl = memoryServer.getUri("mediqueue");
      console.log(
        forceMemory
          ? "USE_MEMORY_DB=true - using in-memory MongoDB for this run"
          : "No MONGO_URI set - using in-memory MongoDB for development"
      );
    }

    await mongoose.connect(dbUrl);

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
