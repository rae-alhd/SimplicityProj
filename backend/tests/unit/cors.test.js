// Task Q1: pure unit tests for the CORS origin allowlist logic.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildAllowedOrigins, corsOptions } = require("../../src/config/cors");

function originCallback(origin) {
  return new Promise((resolve, reject) => {
    corsOptions.origin(origin, (err, allowed) => {
      if (err) return reject(err);
      resolve(allowed);
    });
  });
}

describe("cors.buildAllowedOrigins", () => {
  test("in production, only explicitly configured origins are allowed — no automatic dev origins", () => {
    const origins = buildAllowedOrigins({ NODE_ENV: "production", FRONTEND_URL: "https://simplicity.example.com" });
    assert.deepEqual(origins, ["https://simplicity.example.com"]);
  });

  test("in production with no configuration, the allowlist is empty (fail closed, not fail open)", () => {
    const origins = buildAllowedOrigins({ NODE_ENV: "production" });
    assert.deepEqual(origins, []);
  });

  test("ALLOWED_ORIGINS supports a comma-separated list and takes priority over FRONTEND_URL", () => {
    const origins = buildAllowedOrigins({
      NODE_ENV: "production",
      FRONTEND_URL: "https://ignored.example.com",
      ALLOWED_ORIGINS: "https://a.example.com, https://b.example.com",
    });
    assert.deepEqual(origins, ["https://a.example.com", "https://b.example.com"]);
  });

  test("in development, the standard local Vite origins are always included", () => {
    const origins = buildAllowedOrigins({ NODE_ENV: "development" });
    assert.ok(origins.includes("http://localhost:5173"));
  });

  test("in development, configured origins are added alongside the local ones", () => {
    const origins = buildAllowedOrigins({ NODE_ENV: "development", FRONTEND_URL: "https://staging.example.com" });
    assert.ok(origins.includes("http://localhost:5173"));
    assert.ok(origins.includes("https://staging.example.com"));
  });
});

describe("cors.corsOptions.origin — accept/reject behavior", () => {
  test("allows requests with no Origin header at all (curl, server-to-server, Supertest)", async () => {
    const allowed = await originCallback(undefined);
    assert.equal(allowed, true);
  });

  test("allows a configured origin", async () => {
    const allowed = await originCallback("http://localhost:5173");
    assert.equal(allowed, true);
  });

  test("rejects an unconfigured origin with an error", async () => {
    await assert.rejects(() => originCallback("https://evil-attacker.example"));
  });
});
