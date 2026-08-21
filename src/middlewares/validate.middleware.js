/**
 * Joi validation middleware.
 * Provides a reusable `validate` middleware factory and pre-defined
 * schemas for all request bodies. Validation runs before controllers
 * to ensure only well-formed data reaches the business logic layer.
 *
 * - `abortEarly: false` collects all validation errors, not just the first.
 * - `stripUnknown: true` removes any unexpected fields from the request body.
 * - Custom error messages make client-facing responses human-readable.
 */
import Joi from "joi";

/**
 * Express middleware factory that validates req.body against a Joi schema.
 * Returns 400 with all validation errors if the schema check fails.
 *
 * @param {Joi.ObjectSchema} schema - Joi schema to validate against
 * @returns {Function} Express middleware
 */
export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((d) => d.message);
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors,
    });
  }

  req.body = value;
  next();
};

/** Schema for POST /auth/register — username must be 3-30 chars, password at least 6. */
export const registerSchema = Joi.object({
  username: Joi.string().trim().min(3).max(30).required().messages({
    "string.empty": "Username is required",
    "string.min": "Username must be at least 3 characters",
    "any.required": "Username is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters",
    "any.required": "Password is required",
  }),
});

/** Schema for POST /auth/login — no length constraints on login, just presence. */
export const loginSchema = Joi.object({
  username: Joi.string().trim().required().messages({
    "string.empty": "Username is required",
    "any.required": "Username is required",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

/** Schema for POST /users — name and email are required, age is optional positive integer. */
export const createUserSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must not be empty",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().lowercase().messages({
    "string.email": "Please provide a valid email",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  // `allow(null, "")` permits clearing the age field by sending null or empty string.
  age: Joi.number().integer().positive().allow(null, "").optional().messages({
    "number.base": "Age must be a number",
    "number.integer": "Age must be a whole number",
    "number.positive": "Age must be a positive number",
  }),
});

/**
 * Schema for PUT /users/:id — all fields optional, but at least one
 * must be provided (enforced by `.min(1)`) to prevent empty updates.
 */
export const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(1).optional().messages({
    "string.min": "Name must not be empty",
  }),
  email: Joi.string().email().lowercase().optional().messages({
    "string.email": "Please provide a valid email",
  }),
  age: Joi.number().integer().positive().allow(null, "").optional().messages({
    "number.base": "Age must be a number",
    "number.integer": "Age must be a whole number",
    "number.positive": "Age must be a positive number",
  }),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});
