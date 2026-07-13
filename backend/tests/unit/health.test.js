// Task Q1: pure unit tests for the health-check DB probe, using a fake
// pool via dependency injection so this never touches a real database
// connection — this is what makes the "health endpoint failure" case
// (item 2 of Task Q1's testing list) practical to test at all, since
// forcing the real TEST_DATABASE_URL connection to actually fail mid-run
// would be disruptive to every other integration test sharing it.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { checkDatabaseHealth } = require("../../src/utils/health");

describe("health.checkDatabaseHealth", () => {
  test("returns ok:true when the query succeeds", async () => {
    const fakePool = { query: async () => ({ rows: [{ "?column?": 1 }] }) };
    const result = await checkDatabaseHealth(fakePool);
    assert.equal(result.ok, true);
  });

  test("returns ok:false (never throws) when the query rejects", async () => {
    const fakePool = {
      query: async () => {
        throw new Error("connection refused");
      },
    };
    const result = await checkDatabaseHealth(fakePool);
    assert.equal(result.ok, false);
  });
});
