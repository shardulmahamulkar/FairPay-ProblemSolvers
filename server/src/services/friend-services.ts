import { Friend } from "../models/Friend";
import { User } from "../models/User";
import { OwedBorrow } from "../models/OwedBorrow";

export class FriendService {

    // Send a friend request (one-way, pending)
    static async addFriend(userId: string, query: { email?: string; username?: string; phone?: string }) {
        const filter: any = {};
        if (query.email) filter.email = query.email.toLowerCase();
        else if (query.username) filter.username = query.username;
        else if (query.phone) filter.phone = query.phone;
        else throw new Error("Provide email, username, or phone to find a friend");

        const friendUser = await User.findOne(filter);
        if (!friendUser) throw new Error("User not found. Ask them to sign up on FairPay!");

        const friendId = friendUser.authId;
        if (friendId === userId) throw new Error("You can't add yourself as a friend!");

        // Check if friendship/request already exists
        const existing = await Friend.findOne({ userId, friendId });
        if (existing) {
            if (existing.status === "pending") throw new Error("Friend request already sent!");
            throw new Error("Already friends!");
        }

        // Check if they already sent you a request — auto-accept if so
        const reverse = await Friend.findOne({ userId: friendId, friendId: userId, status: "pending" });
        if (reverse) {
            // Auto-accept: update both sides to accepted
            reverse.status = "accepted";
            await reverse.save();
            await Friend.create({ userId, friendId, status: "accepted" });
            return { friendId, username: friendUser.username, email: friendUser.email, avatar: friendUser.avatar, autoAccepted: true };
        }

        // Create one-way pending request
        await Friend.create({ userId, friendId, status: "pending" });
        return { friendId, username: friendUser.username, email: friendUser.email, avatar: friendUser.avatar, status: "pending" };
    }

    // Get incoming friend requests for a user
    static async getFriendRequests(userId: string) {
        const requests = await Friend.find({ friendId: userId, status: "pending" });
        return Promise.all(requests.map(async (r) => {
            const sender = await User.findOne({ authId: r.userId });
            return {
                _id: r._id,
                senderId: r.userId,
                username: sender?.displayName || sender?.username || r.userId.substring(0, 8),
                email: sender?.email || "",
                avatar: sender?.avatar || "",
                createdAt: r.createdAt,
            };
        }));
    }

    // Accept a friend request
    static async acceptFriend(userId: string, senderId: string) {
        const request = await Friend.findOne({ userId: senderId, friendId: userId, status: "pending" });
        if (!request) throw new Error("No pending request from this user");

        request.status = "accepted";
        await request.save();

        // Create the reverse (so both sides are friends)
        const reverseExists = await Friend.findOne({ userId, friendId: senderId });
        if (!reverseExists) {
            await Friend.create({ userId, friendId: senderId, status: "accepted" });
        } else {
            await Friend.updateOne({ userId, friendId: senderId }, { status: "accepted" });
        }

        return { success: true };
    }

    // Reject/cancel a friend request
    static async rejectFriend(userId: string, senderId: string) {
        await Friend.deleteOne({ userId: senderId, friendId: userId, status: "pending" });
        return { success: true };
    }

    // Get all accepted friends for a user (with balance info)
    static async getFriends(userId: string) {
        const friendDocs = await Friend.find({ userId, status: "accepted" });

        const enriched = await Promise.all(
            friendDocs.map(async (f) => {
                const friendUser = await User.findOne({ authId: f.friendId });

                const friendOwesUser = await OwedBorrow.find({
                    payerId: f.friendId,
                    payeeId: userId,
                    status: "pending",
                });
                const theyOweYou = friendOwesUser.reduce((sum, d) => sum + d.amount, 0);

                const userOwesFriend = await OwedBorrow.find({
                    payerId: userId,
                    payeeId: f.friendId,
                    status: "pending",
                });
                const youOweThem = userOwesFriend.reduce((sum, d) => sum + d.amount, 0);

                const netBalance = theyOweYou - youOweThem;

                return {
                    _id: f._id,
                    friendId: f.friendId,
                    nickname: f.nickname || "",
                    displayName: f.displayName || friendUser?.displayName || friendUser?.username || f.friendId.substring(0, 8),
                    email: friendUser?.email || "",
                    avatar: friendUser?.avatar || "",
                    username: friendUser?.username || "",
                    owedAmount: netBalance,
                };
            })
        );

        return enriched;
    }

    // Update friend (nickname, display name)
    static async updateFriend(userId: string, friendId: string, updates: { nickname?: string; displayName?: string }) {
        const friend = await Friend.findOne({ userId, friendId });
        if (!friend) throw new Error("Friendship not found");

        if (updates.nickname !== undefined) friend.nickname = updates.nickname;
        if (updates.displayName !== undefined) friend.displayName = updates.displayName;

        await friend.save();
        return friend;
    }

    // Remove a friend (bidirectional)
    static async removeFriend(userId: string, friendId: string) {
        await Friend.deleteOne({ userId, friendId });
        await Friend.deleteOne({ userId: friendId, friendId: userId });
    }
}
