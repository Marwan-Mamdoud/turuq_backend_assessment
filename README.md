# User Data Handling API (Backend Assessment - Task 1)

RESTful API built with Express.js and Mongoose for managing User Profile resources with full CRUD operations, protected by JWT-based admin authentication.

## Tech Stack

- Node.js + Express.js
- MongoDB with Mongoose
- JWT (jsonwebtoken) for authentication
- bcrypt for password hashing
- Joi for input validation
- helmet + express-mongo-sanitize for security
- Swagger (swagger-jsdoc + swagger-ui-express) for API docs
- Jest + Supertest for testing

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your MongoDB URI and JWT secret.

### 3. Run the server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5000` by default.

### 4. Run tests

```bash
npm test
```

## API Documentation

| Endpoint | Description |
|----------|-------------|
| `http://localhost:5000/api-docs` | Swagger UI (interactive) |
| `http://localhost:5000/api-docs.json` | Raw OpenAPI 3.0 JSON (for Postman/Insomnia import) |

> **Note:** `/api-docs` loads Swagger UI assets from a CDN (unpkg) instead of serving them locally. This avoids a known blank-page issue on Vercel, where serverless functions don't reliably serve `swagger-ui-dist`'s static assets.

## API Endpoints

### Authentication

| Method | Route            | Description                    | Auth Required |
|--------|------------------|--------------------------------|---------------|
| POST   | `/auth/register` | Register a new admin account   | No            |
| POST   | `/auth/login`    | Login and receive JWT token    | No            |

### Users (all require `Authorization: Bearer <token>` header)

| Method | Route        | Description                                      |
|--------|--------------|--------------------------------------------------|
| POST   | `/users`     | Create a new user profile                        |
| GET    | `/users`     | List all users (pagination + age filtering)      |
| GET    | `/users/:id` | Get a single user by ID                          |
| PUT    | `/users/:id` | Update a user                                    |
| DELETE | `/users/:id` | Delete a user                                    |

#### GET /users Query Parameters

| Param   | Type    | Default | Description                      |
|---------|---------|---------|----------------------------------|
| page    | number  | 1       | Page number                      |
| limit   | number  | 10      | Items per page                   |
| age     | number  | -       | Filter by exact age              |
| minAge  | number  | -       | Minimum age filter               |
| maxAge  | number  | -       | Maximum age filter               |
| search  | string  | -       | Partial, case-insensitive match on name and email |

#### Pagination Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

## Deploying to Vercel

### Prerequisites

1. A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works).
2. A [Vercel](https://vercel.com) account connected to your GitHub repo.

### MongoDB Atlas — Network Access

Vercel serverless functions run from dynamic IP addresses that change between invocations. You **must** add `0.0.0.0/0` (Allow Access from Anywhere) in your MongoDB Atlas cluster's **Network Access** settings, otherwise connections will be randomly rejected in production.

### Environment Variables on Vercel

Set these in **Vercel Dashboard → Project Settings → Environment Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Secret key for signing JWTs | `your_super_secret_key_here` |
| `JWT_EXPIRES_IN` | Token expiration duration | `1d` |

> **Note:** `PORT` is not needed on Vercel — the platform manages the listening port itself.

### Deploy

Push to GitHub, import the repo in Vercel, and deploy. The `vercel.json` at the project root handles routing all requests to the serverless function in `api/index.js`.

After deployment, update the production server URL in `src/app.js` (the Swagger `servers` field) and re-deploy.

### Architecture

Vercel runs the app as a **serverless function** rather than a long-running process:

- `api/index.js` — serverless entry point, lazily connects to MongoDB and delegates to the Express app.
- `src/app.js` — the Express app (no `app.listen()` call), shared by both local dev and Vercel.
- `src/server.js` — local dev only (`npm run dev`/`npm start`), connects to DB and calls `app.listen()`.

## Design Decisions

### Open `/auth/register` endpoint
The registration endpoint is intentionally left unprotected for this assessment to make it easy to create the first admin account and test the application end-to-end. In production, this would be restricted to existing admins or removed entirely.

### Email uniqueness handling
Email uniqueness is validated at both the Mongoose schema level (`unique: true`) and in the controller layer to return a clean `409 Conflict` response instead of a raw MongoDB duplicate-key error.

### Caching
GET /users results are cached in-memory using [node-cache](https://www.npmjs.com/package/node-cache) with a 60-second TTL. The cache key includes the full query string so different combinations of page, limit, age, and search are cached separately. On any write operation (POST, PUT, DELETE), the entire cache is flushed to prevent stale data from being served.

**Why node-cache over Redis?** This is a single-instance application scoped to a single Node process. Redis adds deployment complexity (external service, connection management) that isn't justified for this assessment's scope. Node-cache is zero-config and lives in the same process.

### Error handling
All errors are returned in a consistent format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error 1", "Detailed error 2"]
}
```

## Project Structure

```
src/
├── config/
│   └── db.js                      # Mongoose connection
├── models/
│   ├── Admin.js                   # Admin schema
│   └── User.js                    # User schema
├── controllers/
│   ├── auth.controller.js         # Register + Login logic
│   └── user.controller.js         # CRUD operations
├── routes/
│   ├── auth.routes.js             # Auth routes with Swagger
│   └── user.routes.js             # User routes with Swagger
├── middlewares/
│   ├── auth.middleware.js         # JWT verification
│   ├── validate.middleware.js     # Joi validation schemas
│   └── errorHandler.middleware.js # Centralized error handler
├── utils/
│   ├── asyncHandler.js            # Async error wrapper
│   ├── cache.js                   # In-memory cache (node-cache)
│   └── generateToken.js           # JWT generation
├── app.js                         # Express app setup (shared)
└── server.js                      # Local dev entry point
api/
└── index.js                       # Vercel serverless entry point
vercel.json                        # Vercel deployment config
```

## Future Improvements

- Add rate limiting on `/auth/login` to prevent brute-force attacks
- Add role-based access control
- Implement refresh tokens
- Add request logging (morgan)
