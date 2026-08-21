/**
 * Vercel serverless entry point.
 *
 * Vercel runs Express apps as serverless functions rather than
 * long-running processes. This file exports a handler that:
 * 1. Lazily connects to MongoDB on the first invocation (cold start).
 * 2. Reuses the connection across subsequent invocations (warm starts)
 *    via the `isConnected` guard — serverless functions can be reused
 *    across requests, so we avoid reconnecting every time.
 * 3. Delegates all request handling to the Express app instance.
 *
 * The app must NOT call `app.listen()` here — Vercel manages the port.
 */
import dotenv from "dotenv";
dotenv.config();

import app from "../src/app.js";
import connectDB from "../src/config/db.js";

let isConnected = false;

export default async function handler(req, res) {
  // Only connect to MongoDB on the first invocation (cold start).
  // Warm starts reuse the existing connection without reconnecting.
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
  return app(req, res);
}
