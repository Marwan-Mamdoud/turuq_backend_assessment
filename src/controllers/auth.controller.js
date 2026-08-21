/**
 * Authentication controller.
 * Handles admin registration and login.
 *
 * Register is intentionally left unprotected (no auth middleware)
 * for this assessment — this makes it easy to create the first
 * admin account and test the full flow end-to-end. In a production
 * system, this would be restricted to existing admins or removed entirely.
 *
 * Both functions use the generic "Invalid credentials" message on
 * login failure to avoid revealing whether the username or password
 * was the incorrect part (security best practice).
 */
import bcrypt from "bcrypt";
import Admin from "../models/Admin.js";
import generateToken from "../utils/generateToken.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Register a new admin account.
 * Checks username uniqueness explicitly to return a clean 409
 * instead of relying on the raw MongoDB duplicate-key error,
 * which would leak internal schema details to the client.
 *
 * @param {object} req - Express request (body: { username, password })
 * @param {object} res - Express response
 * @returns {201} Admin data + JWT token
 * @returns {409} If username already exists
 * @returns {400} If validation fails
 */
export const register = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Explicit duplicate check returns a clean 409 with a user-friendly
  // message, rather than letting MongoDB throw a raw duplicate-key error
  // (code 11000) which would be caught by the error handler but with
  // a less descriptive message.
  const existingAdmin = await Admin.findOne({ username });
  if (existingAdmin) {
    return res.status(409).json({
      success: false,
      message: "Username already exists",
      errors: ["An admin with this username is already registered"],
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const admin = await Admin.create({
    username,
    password: hashedPassword,
  });

  const token = generateToken(admin._id);

  res.status(201).json({
    success: true,
    message: "Admin registered successfully",
    data: {
      id: admin._id,
      username: admin.username,
      createdAt: admin.createdAt,
    },
    token,
  });
});

/**
 * Authenticate an admin and return a JWT token.
 * Uses `.select("+password")` to explicitly include the password
 * field (hidden by default on the schema) for bcrypt comparison.
 *
 * @param {object} req - Express request (body: { username, password })
 * @param {object} res - Express response
 * @returns {200} Admin data + JWT token on successful login
 * @returns {401} Generic "Invalid credentials" for wrong username or password
 */
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // The password field has `select: false` on the schema, so we
  // must explicitly include it to compare against the provided password.
  const admin = await Admin.findOne({ username }).select("+password");
  if (!admin) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
      errors: ["Username or password is incorrect"],
    });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
      errors: ["Username or password is incorrect"],
    });
  }

  const token = generateToken(admin._id);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      id: admin._id,
      username: admin.username,
    },
    token,
  });
});
