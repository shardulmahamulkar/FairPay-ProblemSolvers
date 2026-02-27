import { Router } from "express";
import { FriendService } from "../services/friend-services";

export const friendRoutes = Router();

// Get all accepted friends for a user
friendRoutes.get("/user/:userId", async (req, res) => {
    try {
        const result = await FriendService.getFriends(req.params.userId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get incoming friend requests
friendRoutes.get("/requests/:userId", async (req, res) => {
    try {
        const result = await FriendService.getFriendRequests(req.params.userId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Send a friend request
friendRoutes.post("/add", async (req, res) => {
    try {
        const { userId, email, username, phone } = req.body;
        const result = await FriendService.addFriend(userId, { email, username, phone });
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Accept a friend request
friendRoutes.post("/accept", async (req, res) => {
    try {
        const { userId, senderId } = req.body;
        const result = await FriendService.acceptFriend(userId, senderId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Reject a friend request
friendRoutes.post("/reject", async (req, res) => {
    try {
        const { userId, senderId } = req.body;
        const result = await FriendService.rejectFriend(userId, senderId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Update friend (nickname, display name)
friendRoutes.put("/update", async (req, res) => {
    try {
        const { userId, friendId, nickname, displayName } = req.body;
        const result = await FriendService.updateFriend(userId, friendId, { nickname, displayName });
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Remove a friend
friendRoutes.delete("/remove", async (req, res) => {
    try {
        const userId = (req.query.userId || req.body?.userId) as string;
        const friendId = (req.query.friendId || req.body?.friendId) as string;
        if (!userId || !friendId) return res.status(400).json({ error: "userId and friendId required" });
        await FriendService.removeFriend(userId, friendId);
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});
