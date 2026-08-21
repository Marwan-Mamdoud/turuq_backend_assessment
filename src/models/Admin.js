/**
 * Admin model.
 * Stores admin credentials for JWT authentication.
 * Password is excluded by default via `select: false` to prevent
 * accidental leakage in API responses — it is only explicitly
 * selected during login comparison.
 */
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      // Excluded from all queries by default; only selected during
      // login when we need to compare the plaintext password hash.
      select: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);
