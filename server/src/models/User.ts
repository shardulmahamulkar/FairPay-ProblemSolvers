//will see this later, as we will use only oauth for now

import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    authId: {
      type: String, // firebase UID
      required: true,
      unique: true,
      index: true,
    },

    username: {
      type: String,
      required: true,
      trim: true,
    },

    displayName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      sparse: true,
    },

    phone: {
      type: String,
      sparse: true,
    },

    avatar: {
      type: String,
    },
  },
  { timestamps: true }
);

export const User = model("User", userSchema);