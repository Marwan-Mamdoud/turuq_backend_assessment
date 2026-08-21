/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header.
 * On success, attaches the full Admin document to `req.admin` so that
 * downstream controllers can identify which admin is performing the
 * request (e.g. for audit trails or ownership checks).
 *
 * Returns 401 Unauthorized for missing, invalid, or expired tokens,
 * and also if the admin referenced by the token no longer exists in
 * the database (e.g. was deleted after the token was issued).
 */
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify the admin still exists — token may have been issued
    // before the admin account was deleted.
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Admin not found.",
      });
    }

    // Attach the full admin document so downstream handlers
    // (e.g. controllers) can access req.admin for audit logging
    // or ownership verification.
    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

export default auth;
