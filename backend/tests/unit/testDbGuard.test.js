// Task P1 audit: pure unit tests for the test-database safety guard. This
// file fully controls process.env for each case (save/restore) rather than
// relying on ambient NODE_ENV, since plain `npm run test:unit` does not set
// NODE_ENV=test the way the integration-test entry point does.
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { assertSafeTestDatabase } = require("../../src/config/testDbGuard");

const ENV_KEYS = ["NODE_ENV", "TEST_DATABASE_URL", "DATABASE_URL"];
let savedEnv;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("testDbGuard.assertSafeTestDatabase — required conditions", () => {
  test("throws when NODE_ENV is not \"test\"", () => {
    delete process.env.NODE_ENV;
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_test_db";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_db";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: 'Integration tests refused to run because NODE_ENV is not "test".' }
    );
  });

  test("throws when TEST_DATABASE_URL is not set", () => {
    process.env.NODE_ENV = "test";
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_db";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is not set." }
    );
  });

  test("throws when TEST_DATABASE_URL is identical to DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    const same = "postgresql://user:pass@localhost:5432/simplicity_test_db";
    process.env.TEST_DATABASE_URL = same;
    process.env.DATABASE_URL = same;
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is identical to DATABASE_URL." }
    );
  });

  test("throws on a malformed TEST_DATABASE_URL rather than crashing", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL = "not a url at all";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_db";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is not a valid connection string." }
    );
  });

  test("returns the URL when every condition is satisfied", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_test_db";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_db";
    assert.equal(assertSafeTestDatabase(), process.env.TEST_DATABASE_URL);
  });
});

describe("testDbGuard.assertSafeTestDatabase — the database name must come from the URL path", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_db";
  });

  test("accepts a path that contains \"test\"", () => {
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_test_db";
    assert.doesNotThrow(() => assertSafeTestDatabase());
  });

  test("accepts a path that contains \"testing\" but not the literal substring \"test\" adjacent to a word boundary", () => {
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_testing_db";
    assert.doesNotThrow(() => assertSafeTestDatabase());
  });

  test("rejects a \"test\" username against a non-test database path", () => {
    process.env.TEST_DATABASE_URL = "postgresql://test_user:pass@localhost:5432/simplicity_db";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is not a test database." }
    );
  });

  test("rejects a \"test\" password against a non-test database path", () => {
    process.env.TEST_DATABASE_URL = "postgresql://user:test_password@localhost:5432/simplicity_db";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is not a test database." }
    );
  });

  test("rejects a \"test\" hostname against a non-test database path", () => {
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@test-host:5432/simplicity_db";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is not a test database." }
    );
  });

  test("rejects a \"test\" query parameter against a non-test database path", () => {
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_db?name=test";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is not a test database." }
    );
  });

  test("rejects a database path with no \"test\"/\"testing\" substring at all", () => {
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/simplicity_staging_db";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is not a test database." }
    );
  });

  test("rejects a URL with no database path at all", () => {
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432";
    assert.throws(
      () => assertSafeTestDatabase(),
      { message: "Integration tests refused to run because TEST_DATABASE_URL is not a test database." }
    );
  });
});
