# Project Prompt: User Data Handling API (Backend Assessment - Task 1)

## 1. Project Overview

Build a **RESTful API** using **Express.js** and **Mongoose (MongoDB)** that manages
"User Profile" resources with full CRUD operations, protected by **JWT-based admin
authentication**. The project must be modular, secure, and follow clean backend
architecture best practices.

## 2. Tech Stack

- **Node.js + Express.js**
- **MongoDB** with **Mongoose** as ODM
- **JWT (jsonwebtoken)** for authentication
- **bcrypt** for password hashing
- **Joi** or **express-validator** for input validation
- **express-mongo-sanitize** + **helmet** for security hardening
- **dotenv** for environment configuration

## 3. Environment Variables (`.env`)

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/<db-name>
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=1d
```

Never hardcode these values. Provide a `.env.example` file (with placeholder values,
no real secrets) in the repository for documentation purposes.

## 4. Data Models

### 4.1 Admin Model (`models/Admin.js`)

Separate from the `User` resource — the Admin is the authenticated actor who is
allowed to perform CRUD operations on User Profiles, not a User Profile itself.

```js
{
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // stored as bcrypt hash, never plain text
  createdAt: { type: Date, default: Date.now }
}
```

### 4.2 User Model (`models/User.js`)

This is the CRUD resource defined by the assessment.

```js
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // indexed, validated format
  age: { type: Number, required: false },
  createdAt: { type: Date, default: Date.now }
}
```

Use Mongoose's `timestamps: true` option where appropriate instead of managing
`createdAt` manually.

## 5. Authentication Flow

### 5.1 `POST /auth/register`

- Accepts `username` and `password`.
- Hashes the password with `bcrypt` (salt rounds: 10) before saving.
- Validates that `username` is unique; return `409 Conflict` if it already exists.
- This endpoint is intentionally left open (not protected) for this assessment so it's
  easy to create the first admin account and test the app end-to-end — this trade-off
  should be explicitly noted in the README as a conscious decision, not an oversight.

### 5.2 `POST /auth/login`

- Accepts `username` and `password`.
- Finds the admin by `username`, compares password via `bcrypt.compare`.
- On success, issues a JWT: `jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })`.
- Returns the token in the response body.
- On failure (wrong username or password), return a generic `401 Unauthorized` — do not
  reveal whether the username or the password was the incorrect part.

### 5.3 Auth Middleware (`middlewares/auth.middleware.js`)

- Reads the token from the `Authorization: Bearer <token>` header.
- Verifies it with `jwt.verify`.
- On success, attaches the decoded admin info to `req.admin` and calls `next()`.
- On missing/invalid/expired token, returns `401 Unauthorized` with a clear message.
- Applied to **all** `/users` routes.

## 6. User CRUD Endpoints (all protected by auth middleware)

| Method | Route        | Description                                                    |
| ------ | ------------ | -------------------------------------------------------------- |
| POST   | `/users`     | Create a new user profile                                      |
| GET    | `/users`     | List all user profiles — supports pagination and age filtering |
| GET    | `/users/:id` | Get a single user profile by ID                                |
| PUT    | `/users/:id` | Update a user profile                                          |
| DELETE | `/users/:id` | Delete a user profile                                          |

### 6.1 `GET /users` — Pagination & Filtering

Query params:

- `page` (default `1`), `limit` (default `10`) — use `.skip()` and `.limit()` at the
  database query level, never fetch everything and paginate in memory.
- `age` — exact match filter, e.g. `?age=25`.
- Optionally also support `minAge` / `maxAge` range filtering for extra flexibility.
- Response should include pagination metadata:
  ```json
  {
    "success": true,
    "data": [ ... ],
    "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
  }
  ```

## 7. Validation Rules

- `name`: required, non-empty string.
- `email`: required, valid email format, must be unique — check uniqueness explicitly
  in the controller/service layer (in addition to the schema-level `unique: true`) so
  a clean `409 Conflict` with a friendly message is returned instead of a raw MongoDB
  duplicate-key error leaking to the client.
- `age`: optional; if provided, must be a positive integer.
- Use a dedicated validation middleware (Joi schema or express-validator chains) per
  route — do not inline validation logic inside controllers.

## 8. Error Handling

- Centralized error-handling middleware (last middleware in `app.js`) that returns a
  consistent shape:
  ```json
  { "success": false, "message": "...", "errors": [ ... ] }
  ```
- Cover these cases explicitly:
  - `400` — validation errors / malformed input
  - `401` — missing or invalid JWT
  - `404` — user/admin not found (e.g. `GET/PUT/DELETE /users/:id` with a non-existent ID)
  - `409` — duplicate email or username
  - `500` — unexpected server/database errors (never leak stack traces in production)
- Wrap all async controller logic in a shared `asyncHandler` utility to avoid repetitive
  try/catch blocks, forwarding errors to `next(error)`.

## 9. Project Structure (modular, clean architecture)

```
src/
├── config/
│   └── db.js                      # Mongoose connection setup
├── models/
│   ├── Admin.js
│   └── User.js
├── controllers/
│   ├── auth.controller.js
│   └── user.controller.js
├── routes/
│   ├── auth.routes.js
│   └── user.routes.js
├── middlewares/
│   ├── auth.middleware.js         # JWT verification
│   ├── validate.middleware.js     # Joi / express-validator schemas
│   └── errorHandler.middleware.js
├── utils/
│   ├── asyncHandler.js
│   └── generateToken.js
├── app.js                         # Express app setup, middleware registration
└── server.js                      # Entry point, DB connection + app.listen
```

## 10. Performance & Security

- Index the `email` field (covered by `unique: true`, but confirm it's present).
- Use `express-mongo-sanitize` to strip any `$`/`.`-prefixed operators from user input
  and prevent NoSQL injection.
- Use `helmet` for secure HTTP headers.
- Never return the `password` field in any Admin-related API response (`select: false`
  on the schema field, or explicitly strip it before sending responses).
- Rate-limit the `/auth/login` endpoint if time allows (e.g. `express-rate-limit`) to
  reduce brute-force risk — optional but worth mentioning as a "future improvement" in
  the README if not implemented.

## 11. Task Breakdown Documentation

Explicitly document (in the README and/or as top-of-file comments) how the task was
broken down and prioritized, roughly in this order:

1. Set up Express app skeleton + MongoDB connection.
2. Build the `User` and `Admin` Mongoose models with validation rules.
3. Implement `POST /auth/register` and `POST /auth/login` + JWT issuing.
4. Implement the JWT auth middleware and apply it to all `/users` routes.
5. Implement User CRUD controllers in order: Create → Read (all + by id) → Update → Delete.
6. Add centralized error handling and validation middleware.
7. Add pagination and age filtering to `GET /users`.
8. Add security hardening (`helmet`, `express-mongo-sanitize`).
9. Write documentation (README, and Swagger/Postman if time allows) and tests.

## 12. Bonus Points (implement if time allows)

- **Deployment**: Deploy to Render (or similar) with MongoDB Atlas as the database;
  provide the live URL in the README.
- **API Documentation**: Add Swagger (`swagger-jsdoc` + `swagger-ui-express`) at
  `/api-docs`, or provide an exported Postman collection.
- **Testing**: Add Jest + Supertest tests covering at minimum: successful user creation,
  fetching a user by id, duplicate email rejection, and unauthorized access rejection.

## 13. Deliverables Checklist

- [✓] Public GitHub repo (or ZIP via Drive link).
- [✓] `README.md` explaining local setup/run instructions, and optionally challenges faced.
- [✓] `.env.example` file (no real secrets committed).
- [✓] If deployed: live API URL + example requests in the README.
- [✓] Task 2 (delivery slots) pseudocode file placed at the repository root.
