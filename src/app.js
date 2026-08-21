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
import swaggerUi from "swagger-ui-express";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";

const app = express();

// Security hardening: sets secure HTTP headers, strips $/.-prefixed
// keys from user input (NoSQL injection prevention), enables CORS.
app.use(helmet());
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
      description: "RESTful API for managing User Profiles with JWT-based admin authentication",
    },
    // TODO: Replace <your-project> with actual Vercel project name after deployment.
    servers: [
      { url: `http://localhost:${process.env.PORT || 5000}`, description: "Local development" },
      { url: "https://<your-project>.vercel.app", description: "Production (Vercel)" },
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
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve the raw OpenAPI JSON spec for importing into Postman, Insomnia, etc.
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
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
