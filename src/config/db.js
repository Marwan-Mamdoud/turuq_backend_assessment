/**
 * Database configuration module.
 * Handles establishing a connection to MongoDB via Mongoose.
 * Exits the process on connection failure to prevent the server
 * from running without a working database.
 */
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
