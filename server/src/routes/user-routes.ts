import { Router } from "express";
import { User } from "../models/User";

export const userRoutes = Router();

// Sync user from Firebase → MongoDB (upsert)
// Called on every login from the frontend
userRoutes.post("/sync", async (req, res) => {
    try {
        const { authId, username, email, phone, avatar, displayName, upiId } = req.body;
        if (!authId) return res.status(400).json({ error: "authId is required" });

        // Only update avatar if the incoming value is a real image (http URL or
        // base64 data URI). If it's initials (e.g. "AB") or empty, preserve
        // whatever is already stored so custom uploaded photos survive login syncs.
        const isRealImage = (v: string | undefined) =>
            v && (v.startsWith("http") || v.startsWith("data:"));

        const setFields: Record<string, any> = {
            username: username || email?.split("@")[0] || authId.substring(0, 8),
            displayName: displayName || "",
            email: email || "",
            phone: phone || "",
            ...(upiId !== undefined && { upiId }),
        };

        if (isRealImage(avatar)) {
            // Incoming value is a real image — store it (overrides old value)
            setFields.avatar = avatar;
        }
        // else: leave the existing avatar in MongoDB untouched

        const user = await User.findOneAndUpdate(
            { authId },
            { $set: setFields },
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
