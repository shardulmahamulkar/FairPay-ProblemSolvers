import { Router } from "express";
import { User } from "../models/User";

export const userRoutes = Router();

// Sync user from Firebase → MongoDB (upsert)
// Called on every login from the frontend
userRoutes.post("/sync", async (req, res) => {
    try {
        const { authId, username, email, phone, avatar, displayName } = req.body;
        if (!authId) return res.status(400).json({ error: "authId is required" });

        const user = await User.findOneAndUpdate(
            { authId },
            {
                $set: {
                    username: username || email?.split("@")[0] || authId.substring(0, 8),
                    displayName: displayName || "",
                    email: email || "",
                    phone: phone || "",
                    avatar: avatar || "",
                },
            },
            { upsert: true, new: true }
        );

        res.json(user);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Search users (for adding friends)
userRoutes.get("/search", async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== "string") return res.status(400).json({ error: "Query required" });

        const users = await User.find({
            $or: [
                { email: { $regex: q, $options: "i" } },
                { username: { $regex: q, $options: "i" } },
                { phone: { $regex: q, $options: "i" } },
            ],
        }).limit(10);

        res.json(users);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get user by authId
userRoutes.get("/:authId", async (req, res) => {
    try {
        const user = await User.findOne({ authId: req.params.authId });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});
