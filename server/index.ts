import express from "express";
import { connectDB } from "./src/db/connect";
import dotenv from "dotenv";
import { groupRoutes } from "./src/routes/group-routes";
import { expenseRoutes } from "./src/routes/expense-routes";
import { friendRoutes } from "./src/routes/friend-routes";
import { userRoutes } from "./src/routes/user-routes";
import { balanceRequestRoutes } from "./src/routes/balance-request-routes";
import { updateRoutes } from "./src/routes/update-routes";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Register all Mongoose models
import "./src/models/User";
import "./src/models/Group";
import "./src/models/Expense";
import "./src/models/OwedBorrow";
import "./src/models/Stats";
import "./src/models/Friend";
import "./src/models/BalanceRequest";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function start() {
  await connectDB();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/", (req, res) => res.send("FairPay API running 🚀"));
  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/api/groups", groupRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/friends", friendRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/balance-requests", balanceRequestRoutes);
  app.use("/api/update", updateRoutes);

  // Serve the zip files dynamically
  app.use("/updates", express.static(path.join(__dirname, "updates")));

  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🟢 Server running at http://localhost:${PORT}`);
  });
}

start();
