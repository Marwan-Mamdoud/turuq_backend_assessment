/**
 * Task Breakdown:
 * 1. Set up Express app skeleton + MongoDB connection
 * 2. Build User and Admin Mongoose models with validation
 * 3. Implement auth (register/login) + JWT issuing
 * 4. Implement JWT auth middleware, apply to /users routes
 * 5. Implement User CRUD controllers (Create -> Read -> Update -> Delete)
 * 6. Add centralized error handling and validation middleware
 * 7. Add pagination + age filtering to GET /users
 * 8. Add security hardening (helmet, mongo-sanitize)
 * 9. Documentation and tests
 */

// Load environment variables from .env before anything else,
// since all other modules may reference process.env values.
import dotenv from "dotenv";
dotenv.config();

import connectDB from "./config/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, then start listening — ensures the
// database is ready before accepting any requests.
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API docs: http://localhost:${PORT}/api-docs`);
  });
});
