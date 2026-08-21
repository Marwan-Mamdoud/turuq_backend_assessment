/**
 * Centralized error-handling middleware.
 * Registered as the last middleware in the Express app stack.
 * Intercepts errors thrown or forwarded via `next(error)` and maps
 * them to consistent HTTP responses with the shape:
 *   { success: false, message: string, errors: string[] }
 *
 * Handles these specific error types:
 * - Mongoose ValidationError (400) — schema validation failures
 * - Mongoose duplicate key / code 11000 (409) — unique constraint violations
 * - Mongoose CastError (400) — invalid ObjectId or type casts
 * - JsonWebTokenError (401) — malformed or invalid JWT
 * - TokenExpiredError (401) — expired JWT
 * - Default (500) — unexpected server errors, stack trace only in dev
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = [];

  // Mongoose schema validation failure (e.g. required field missing)
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errors = Object.values(err.errors).map((e) => e.message);
  }

  // Mongoose unique constraint violation — the raw error message leaks
  // internal details, so we map it to a clean 409 response.
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for field: ${field}`;
    errors = [`A record with this ${field} already exists`];
  }

  // Mongoose CastError — occurs when an invalid ObjectId is passed
  // to findById or similar methods (e.g. "invalidid" string).
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    errors = ["The provided ID is not valid"];
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    errors = ["The provided token is invalid"];
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    errors = ["The provided token has expired"];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    // Expose stack trace only in development to aid debugging;
    // never leak internal details to clients in production.
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
