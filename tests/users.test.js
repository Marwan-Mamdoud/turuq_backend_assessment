import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";

let mongoServer;
let token;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  await request(app).post("/auth/register").send({
    username: "testadmin",
    password: "password123",
  });

  const loginRes = await request(app).post("/auth/login").send({
    username: "testadmin",
    password: "password123",
  });
  token = loginRes.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe("User Endpoints", () => {
  const userData = { name: "John Doe", email: "john@example.com", age: 25 };

  describe("POST /users", () => {
    it("should create a new user", async () => {
      const res = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send(userData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(userData.name);
      expect(res.body.data.email).toBe(userData.email);
    });

    it("should return 409 for duplicate email", async () => {
      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send(userData);

      const res = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send(userData);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without auth token", async () => {
      const res = await request(app)
        .post("/users")
        .send(userData);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for missing name", async () => {
      const res = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "test@test.com" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid email", async () => {
      const res = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Test", email: "notanemail" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /users", () => {
    it("should return empty array when no users exist", async () => {
      const res = await request(app)
        .get("/users")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it("should return users with pagination metadata", async () => {
      for (let i = 0; i < 15; i++) {
        await request(app)
          .post("/users")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: `User ${i}`, email: `user${i}@example.com`, age: 20 + i });
      }

      const res = await request(app)
        .get("/users?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(10);
      expect(res.body.pagination.total).toBe(15);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it("should filter by exact age", async () => {
      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Young", email: "young@test.com", age: 20 });

      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Old", email: "old@test.com", age: 50 });

      const res = await request(app)
        .get("/users?age=20")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].age).toBe(20);
    });

    it("should filter by minAge and maxAge", async () => {
      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "A", email: "a@test.com", age: 18 });

      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "B", email: "b@test.com", age: 30 });

      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "C", email: "c@test.com", age: 45 });

      const res = await request(app)
        .get("/users?minAge=20&maxAge=40")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].age).toBe(30);
    });
  });

  describe("GET /users/:id", () => {
    it("should return a user by ID", async () => {
      const createRes = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send(userData);

      const res = await request(app)
        .get(`/users/${createRes.body.data._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(userData.name);
    });

    it("should return 404 for non-existent ID", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/users/${fakeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid ID format", async () => {
      const res = await request(app)
        .get("/users/invalidid")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PUT /users/:id", () => {
    it("should update a user", async () => {
      const createRes = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send(userData);

      const res = await request(app)
        .put(`/users/${createRes.body.data._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Jane Doe", age: 30 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Jane Doe");
      expect(res.body.data.age).toBe(30);
    });

    it("should return 404 for non-existent user", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/users/${fakeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated" });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 409 when updating to duplicate email", async () => {
      await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send(userData);

      const createRes = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Other", email: "other@example.com" });

      const res = await request(app)
        .put(`/users/${createRes.body.data._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "john@example.com" });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /users/:id", () => {
    it("should delete a user", async () => {
      const createRes = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send(userData);

      const res = await request(app)
        .delete(`/users/${createRes.body.data._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const getRes = await request(app)
        .get(`/users/${createRes.body.data._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.statusCode).toBe(404);
    });

    it("should return 404 for non-existent user", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/users/${fakeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
