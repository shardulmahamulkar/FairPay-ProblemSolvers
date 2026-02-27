import { Schema, model, Types } from "mongoose";

const balanceRequestSchema = new Schema(
    {
        type: {
            type: String,
            enum: ["settlement", "dispute"],
            required: true,
        },

        owedBorrowId: {
            type: Types.ObjectId,
            ref: "OwedBorrow",
            required: true,
        },

        groupId: {
            type: Types.ObjectId,
            ref: "Group",
            required: true,
        },

        requestedBy: {
            type: String, // Firebase UID of who initiated
            required: true,
        },

        targetUserId: {
            type: String, // Firebase UID of who must acknowledge
            required: true,
            index: true,
        },

        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },

        // Dispute-only
        reason: {
            type: String,
            default: "",
        },

        proposedAmount: {
            type: Number,
            default: null,
        },
    },
    { timestamps: true }
);

export const BalanceRequest = model("BalanceRequest", balanceRequestSchema);
