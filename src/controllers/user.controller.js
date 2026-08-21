/**
 * User CRUD controller.
 * Handles all business logic for User Profile operations.
 *
 * Email uniqueness is checked explicitly in the controller (in addition
 * to the schema-level `unique: true`) so that a clean 409 Conflict
 * response is returned instead of a raw MongoDB duplicate-key error.
 * The schema-level unique constraint acts as a safety net; the
 * controller check provides a better developer experience.
 */
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import cache from "../utils/cache.js";

/**
 * Create a new user profile.
 * Validates email uniqueness before saving to return a friendly 409
 * instead of relying solely on the MongoDB unique index error.
 * Flushes the list cache so subsequent GET /users calls return
 * fresh data that includes this new user.
 *
 * @param {object} req - Express request (body: { name, email, age? })
 * @param {object} res - Express response
 * @returns {201} Created user data
 * @returns {409} If email is already registered
 * @returns {400} If validation fails
 */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, age } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email already exists",
      errors: ["A user with this email is already registered"],
    });
  }

  const user = await User.create({ name, email, age });

  // Flush all cached list results since the dataset has changed.
  // A full flush is intentionally simple here — granular per-key
  // invalidation adds complexity with no real benefit at this scale.
  cache.flushAll();

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: user,
  });
});

/**
 * List all users with pagination, optional age filtering, and search.
 *
 * Pagination is done at the database level using `.skip()` and `.limit()`
 * to avoid fetching all documents into memory. The total count is
 * queried in parallel with the page data via `Promise.all` for
 * efficiency. The response includes metadata so the client can
 * render pagination controls.
 *
 * Results are cached in-memory (node-cache) keyed by the full query
 * string so that identical requests within the TTL avoid redundant
 * DB hits. The cache is flushed on any write operation (create/update/delete).
 *
 * Query params:
 * - page (default 1): 1-indexed page number
 * - limit (default 10): items per page
 * - age: exact age match
 * - minAge / maxAge: range filtering using $gte / $lte operators
 * - search: partial, case-insensitive match against both name and email
 *
 * @param {object} req - Express request (query: { page, limit, age, minAge, maxAge, search })
 * @param {object} res - Express response
 * @returns {200} User array + pagination metadata
 */
export const getUsers = asyncHandler(async (req, res) => {
  // Build a deterministic cache key from the full query string so that
  // different combinations of page/limit/age/search are cached separately.
  const cacheKey = `users:${JSON.stringify(req.query)}`;

  // Return cached response immediately if available, skipping the DB entirely.
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  // Convert to 0-indexed skip value for MongoDB's .skip()
  const skip = (page - 1) * limit;

  const conditions = [];

  // Exact age match filter
  if (req.query.age) {
    conditions.push({ age: parseInt(req.query.age) });
  }
  // Range filters use MongoDB's $gte (>=) and $lte (<=) operators;
  // both can be combined on the same field for a range query.
  if (req.query.minAge || req.query.maxAge) {
    const ageRange = {};
    if (req.query.minAge) ageRange.$gte = parseInt(req.query.minAge);
    if (req.query.maxAge) ageRange.$lte = parseInt(req.query.maxAge);
    conditions.push({ age: ageRange });
  }

  // Search filter: partial, case-insensitive regex match against both
  // name and email using $or. Combined with any age conditions via $and
  // so both filters apply simultaneously, not just one.
  if (req.query.search) {
    const searchRegex = { $regex: req.query.search, $options: "i" };
    conditions.push({
      $or: [
        { name: searchRegex },
        { email: searchRegex },
      ],
    });
  }

  // Combine all conditions with $and so they all apply together.
  // When there's only one condition, use it directly (no wrapper needed).
  const filter = conditions.length === 1
    ? conditions[0]
    : { $and: conditions };

  // Run the data query and count query in parallel to reduce
  // total response time — they hit the same filtered index.
  const [users, total] = await Promise.all([
    User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);

  const response = {
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  // Store the result in cache for subsequent identical requests
  // within the configured TTL (60s by default).
  cache.set(cacheKey, response);

  res.status(200).json(response);
});

/**
 * Get a single user by their MongoDB ID.
 *
 * @param {object} req - Express request (params: { id })
 * @param {object} res - Express response
 * @returns {200} User data
 * @returns {404} If no user found with the given ID
 * @returns {400} If the ID format is invalid (CastError handled centrally)
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
      errors: ["No user exists with the provided ID"],
    });
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * Update a user profile by ID.
 * If the email is being changed, checks uniqueness against other
 * users (excluding the current one via `$ne`) to prevent 409 conflicts.
 * Flushes the list cache after a successful update.
 *
 * @param {object} req - Express request (params: { id }, body: { name?, email?, age? })
 * @param {object} res - Express response
 * @returns {200} Updated user data
 * @returns {404} If no user found with the given ID
 * @returns {409} If the new email is already taken by another user
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Only check email uniqueness if email is actually being changed.
  // The `$ne` (not equal) operator excludes the current user from
  // the uniqueness check so that saving without changing email works.
  if (email) {
    const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
        errors: ["Another user with this email is already registered"],
      });
    }
  }

  // `returnDocument: "after"` returns the updated document instead
  // of the original. `runValidators: true` ensures schema rules
  // (e.g. age >= 0) are enforced on the update too.
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: "after",
    runValidators: true,
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
      errors: ["No user exists with the provided ID"],
    });
  }

  // Flush all cached list results since the dataset has changed.
  cache.flushAll();

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: user,
  });
});

/**
 * Delete a user profile by ID.
 * Flushes the list cache after a successful deletion.
 *
 * @param {object} req - Express request (params: { id })
 * @param {object} res - Express response
 * @returns {200} Deletion confirmation with the deleted user's ID
 * @returns {404} If no user found with the given ID
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
      errors: ["No user exists with the provided ID"],
    });
  }

  // Flush all cached list results since the dataset has changed.
  cache.flushAll();

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
    data: { id: req.params.id },
  });
});
