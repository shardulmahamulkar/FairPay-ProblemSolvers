import { Schema, model, Types } from "mongoose";

const statsSchema = new Schema(
    {
        groupId: {
            type: Types.ObjectId,
            ref: "Group",
            required: true,
            unique: true,
        },

        budget: {
            type: Number,
            default: 0,
        },

        spent: {
            type: Number,
            default: 0,
        },

        moneyLeft: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

export const Stats = model("Stats", statsSchema);
