import { Schema, model, Types } from "mongoose";

const owedBorrowSchema = new Schema(
    {
        groupId: {
            type: Types.ObjectId,
            ref: "Group",
            required: true,
            index: true,
        },

        payerId: {
            type: String,
            ref: "User",
            required: true,
        },

        payeeId: {
            type: String,
            ref: "User",
            required: true,
        },

        amount: {
            type: Number,
            required: true,
        },

        currency: {
            type: String,
            default: "INR",
        },

        status: {
            type: String,
            enum: ["pending", "completed", "disputed"],
            default: "pending",
        },
    },
    { timestamps: true }
);

export const OwedBorrow = model("OwedBorrow", owedBorrowSchema);
