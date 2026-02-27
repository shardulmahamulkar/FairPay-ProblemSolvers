import { Schema, model, Types } from "mongoose";

const memberSchema = new Schema({
  userId: { type: String, ref: "User", required: true },
  addedAt: { type: Date, default: Date.now },
  removedAt: Date,
});

const groupSchema = new Schema(
  {
    groupName: {
      type: String,
      required: true,
      trim: true,
    },

    groupType: {
      type: String,
      enum: ["trip", "home", "event", "other", "travel", "business"],
      default: "other",
    },

    description: String,

    backgroundImage: String,

    members: [memberSchema],

    createdBy: {
      type: String,
      ref: "User",
      required: true,
    },

    startDate: Date,
    endDate: Date,

    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Group = model("Group", groupSchema);