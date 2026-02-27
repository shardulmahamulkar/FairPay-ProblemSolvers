import { Schema, model } from "mongoose";

const friendSchema = new Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true,
        },
        friendId: {
            type: String,
            required: true,
        },
        nickname: {
            type: String,
            default: "",
        },
        displayName: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            enum: ["pending", "accepted"],
            default: "accepted", // default accepted so existing friendships are unaffected
        },
    },
    { timestamps: true }
);

// Ensure no duplicate friendships
friendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

export const Friend = model("Friend", friendSchema);
