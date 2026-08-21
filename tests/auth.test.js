import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import app from "../src/app.js";
import Admin from "../src/models/Admin.js";

let mongoServer;
let token;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Admin.deleteMany({});
});

describe("Auth Endpoints", () => {
  const adminData = { username: "testadmin", password: "password123" };

  describe("POST /auth/register", () => {
    it("should register a new admin", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send(adminData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.data.username).toBe(adminData.username);
    });

    it("should return 409 for duplicate username", async () => {
      await request(app).post("/auth/register").send(adminData);

      const res = await request(app)
        .post("/auth/register")
        .send(adminData);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for missing fields", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ username: "only" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for short password", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ username: "admin", password: "123" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/auth/register").send(adminData);
    });

    it("should login successfully and return token", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send(adminData);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      token = res.body.token;
    });

    it("should return 401 for wrong password", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ username: "testadmin", password: "wrongpassword" });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 for non-existent username", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ username: "nouser", password: "password123" });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should not reveal whether username or password was wrong", async () => {
      const res1 = await request(app)
        .post("/auth/login")
        .send({ username: "wronguser", password: "wrongpass" });

      const res2 = await request(app)
        .post("/auth/login")
        .send({ username: "testadmin", password: "wrongpass" });

      expect(res1.body.message).toBe(res2.body.message);
    });
  });
});
