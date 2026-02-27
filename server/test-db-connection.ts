import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function testConnection() {
  const MONGODB_URI = process.env.MONGODB_URI?.trim();
  console.log("Attempting to connect with URI:", MONGODB_URI?.replace(/:([^@]+)@/, ":****@"));

  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI missing in .env");
    process.exit(1);
  }

  try {
    console.log("Connecting...");
    const start = Date.now();
    
    // Setting a shorter timeout for the test
    await mongoose.connect(MONGODB_URI, {
      dbName: "fairpay",
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    
    const end = Date.now();
    console.log(`✅ MongoDB connected in ${end - start}ms`);
    process.exit(0);
  } catch (err: any) {
    console.error("❌ MongoDB connection error!");
    const errorInfo = {
        name: err.name,
        message: err.message,
        reason: err.reason,
        code: err.code
    };
    const { writeFileSync } = require("fs");
    writeFileSync("error_details.json", JSON.stringify(errorInfo, null, 2));
    process.exit(1);
  }
}

testConnection();
