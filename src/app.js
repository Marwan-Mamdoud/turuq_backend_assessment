/**
 * Express application setup.
 * Configures middleware stack, mounts route handlers, and registers
 * the centralized error handler as the last middleware. This module
 * exports the app without starting the server, allowing supertest
 * to import and test the app without binding to a port.
 */
import express from "express";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import swaggerJsdoc from "swagger-jsdoc";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";

const app = express();

// Security hardening: sets secure HTTP headers, strips $/.-prefixed
// keys from user input (NoSQL injection prevention), enables CORS.
// The CSP explicitly allow-lists unpkg.com because Swagger UI loads
// its CSS/JS bundle from that CDN — helmet's default same-origin-only
// CSP blocks cross-origin assets by design. This is a narrow,
// deliberate exception scoped to scripts, styles, and images only.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"],
        "style-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https://unpkg.com"],
        "connect-src": ["'self'", "https://unpkg.com"],
      },
    },
  })
);
app.use(mongoSanitize());
app.use(cors());
app.use(express.json());

// Swagger API documentation — auto-generated from JSDoc annotations
// in the route files and served at /api-docs.
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "User Data Handling API",
      version: "1.0.0",
      description:
        "RESTful API for managing User Profiles with JWT-based admin authentication",
    },
    // TODO: Replace <your-project> with actual Vercel project name after deployment.
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: "Local development",
      },
      {
        url: "https://turuqbackendassessment.vercel.app",
        description: "Production (Vercel)",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI served via CDN — not swagger-ui-express's static middleware.
// Vercel's serverless filesystem doesn't reliably serve swagger-ui-dist's
// static assets, causing a blank white screen in production even though it
// works locally. Loading CSS/JS from a CDN avoids this entirely.
app.get("/api-docs", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/api-docs.json',
          dom_id: '#swagger-ui',
        });
      };
    </script>
  </body>
</html>`);
});

// Serve the raw OpenAPI JSON spec for importing into Postman, Insomnia, etc.
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Root endpoint — landing page with clickable links to all API resources.
app.get("/", (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Turuq Backend API</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; }
      h1 { margin-bottom: 8px; }
      p { color: #555; margin-bottom: 32px; }
      a { display: block; padding: 14px 18px; margin-bottom: 12px; background: #f5f5f5; border-radius: 8px; text-decoration: none; color: #1a1a1a; font-size: 16px; border: 1px solid #e0e0e0; transition: background 0.15s; }
      a:hover { background: #e8e8e8; }
      span { font-size: 13px; color: #888; }
    </style>
  </head>
  <body>
    <h1>Turuq Backend API</h1>
    <p>The server is running. Navigate to one of the resources below:</p>
    <a href="/api-docs">Swagger UI <span>&mdash; interactive API docs</span></a>
    <a href="/api-docs.json">OpenAPI JSON <span>&mdash; raw spec for Postman / Insomnia</span></a>
    <a href="/health">Health Check <span>&mdash; server status</span></a>
  </body>
</html>`);
});

// Health check endpoint for load balancers and monitoring.
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is running" });
});

// Mount route groups
app.use("/auth", authRoutes);
app.use("/users", userRoutes);

// Centralized error handler must be registered last so that all
// errors thrown by routes/middlewares above are caught here.
app.use(errorHandler);

export default app;
