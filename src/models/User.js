/**
 * User profile model.
 * Represents the core CRUD resource managed by this API.
 * Email is unique and indexed for fast lookups and duplicate prevention.
 */
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    age: {
      type: Number,
      required: false,
      min: [0, "Age must be a positive number"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
