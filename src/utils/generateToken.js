/**
 * JWT generation utility.
 * Signs a payload containing the admin's MongoDB `_id` and returns
 * a token that expires according to the JWT_EXPIRES_IN env variable.
 *
 * @param {string} id - The admin's MongoDB document ID to embed in the JWT payload
 * @returns {string} Signed JWT string
 */
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

export default generateToken;
