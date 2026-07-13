// Task Q1: rate-limiting integration test — kept in its own file/process
// (node:test runs each file as a separate process) so the in-memory
// rate-limit counters here can never be affected by, or affect, any other
// test file. No other test in this suite calls POST /api/auth/login or
// /register over HTTP at all (every other integration test signs JWTs
// directly via tests/integration/helpers/auth.js), so this file is the
// only thing that ever touches this counter.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const { pool, resetDatabase } = require("./helpers/db");

describe("Rate limiting — authentication routes", () => {
  before(async () => {
    await resetDatabase();
  });

  after(async () => {
    await pool.end();
  });

  test("returns 429 once the login rate-limit threshold is exceeded", async () => {
    const statuses = [];

    // backend/src/middleware/rateLimit.js sets authLimiter's threshold to
    // 10 requests per window — send 12 to guarantee at least one 429.
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@ratelimit.test.local", password: "wrong-password" });
      statuses.push(res.status);
    }

    assert.ok(
      statuses.includes(429),
      `expected at least one 429 among: ${statuses.join(", ")}`
    );

    const lastStatus = statuses[statuses.length - 1];
    assert.equal(lastStatus, 429);
  });

  test("a 429 response is clear JSON, not an HTML page or empty body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@ratelimit.test.local", password: "wrong-password" });
    assert.equal(res.status, 429);
    assert.equal(typeof res.body.error, "string");
  });
});
