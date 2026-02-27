import mongoose from "mongoose";

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI?.trim();

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI missing in .env");
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: "fairpay",
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });

    console.log("MongoDB connected 🟢");
  } catch (err) {
    console.error("MongoDB connection error ❌ (Note: Server will still start in degraded mode)");
    console.error(err);
    // Removed process.exit(1) to allow server to start for frontend communication
  }
}

