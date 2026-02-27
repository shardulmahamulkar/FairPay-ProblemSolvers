import { Schema, model, Types } from "mongoose";

const participatorSchema = new Schema({
  userId: { type: String, ref: "User", required: true },
  splitPercentage: Number, // percentage share in enum or number
  amount: Number, // calculated share
});

const expenseSchema = new Schema(
  {
    // payment id is naturally served by MongoDB's unique _id
    groupId: {
      type: Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },

    userId: { // renamed from paidBy to match "user_id"
      type: String,
      ref: "User",
      required: true,
    },

    expenseNote: String, // optionable, renamed from note

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "bank"],
    },

    category: {
      type: String,
      default: "Other",
    },

    billPhoto: String, // optional

    participatorsInvolved: [participatorSchema], // renamed from splits

    expenseTime: { // corresponding to time
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Expense = model("Expense", expenseSchema);