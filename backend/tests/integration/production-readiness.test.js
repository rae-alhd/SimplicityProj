// Task Q1: production-readiness integration tests — real HTTP requests
// against the real Express app (via Supertest), against TEST_DATABASE_URL
// only, exactly like every other integration test file in this suite.
//
// before/after live at file level, not inside individual describe blocks —
// nesting them inside one describe closes the shared pool before later
// describes in this same file run (P1's own lesson, documented in
// tests/integration/helpers/db.js).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const { pool, resetDatabase } = require("./helpers/db");

before(async () => {
  await resetDatabase();
});

after(async () => {
  await pool.end();
});

describe("Health endpoint", () => {
  test("GET /api/health returns 200 with a customer-safe body when the DB is reachable", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.equal(res.body.database, "connected");
    assert.equal(typeof res.body.timestamp, "string");
  });

  test("the health response never leaks a connection string, table name, or stack trace", async () => {
    const res = await request(app).get("/api/health");
    const raw = JSON.stringify(res.body);
    assert.equal(raw.toLowerCase().includes("postgres"), false);
    assert.equal(raw.toLowerCase().includes("stack"), false);
    assert.equal(raw.includes(process.env.TEST_DATABASE_URL), false);
  });

  test("does not require authentication", async () => {
    const res = await request(app).get("/api/health");
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });
});

describe("Unknown API routes", () => {
  test("GET on an unknown /api route returns a safe JSON 404", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist");
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.error, "string");
  });

  test("POST on an unknown /api route also returns a safe JSON 404", async () => {
    const res = await request(app).post("/api/also-does-not-exist").send({});
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.error, "string");
  });
});

describe("Global error handling — no stack traces leak over HTTP", () => {
  test("malformed JSON body returns 400 with a safe message, not a stack trace", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not valid json");
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, "string");
    assert.equal("stack" in res.body, false);
  });

  test("an oversized JSON body is rejected with 413, not a crash", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "big@test.local", password: "x".repeat(2 * 1024 * 1024) });
    assert.equal(res.status, 413);
  });
});

describe("Normal public product browsing remains usable", () => {
  test("GET /api/products still succeeds and returns an array", async () => {
    const res = await request(app).get("/api/products");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});

describe("CORS — accepts configured origins, rejects unknown ones", () => {
  test("a request with no Origin header (e.g. this test suite) is always allowed", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
  });

  test("a request from the standard local dev origin is allowed", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    assert.equal(res.status, 200);
    assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
  });

  test("a request from an unconfigured origin is rejected with a safe 403", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://evil-attacker.example");
    assert.equal(res.status, 403);
    assert.equal(typeof res.body.error, "string");
    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });
});
