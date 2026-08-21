/**
 * Async error handler utility.
 * Wraps an async route handler so that any rejected promise is
 * automatically forwarded to Express's error-handling middleware
 * via `next(error)`, eliminating repetitive try/catch blocks
 * in every controller function.
 *
 * @param {Function} fn - Async route handler (req, res, next) => Promise
 * @returns {Function} Express middleware that catches async errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
