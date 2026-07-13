// Task P1: the one place that decides whether it's safe to run anything
// against TEST_DATABASE_URL. Every integration-test entry point (and
// config/db.js itself, when NODE_ENV=test) calls this before opening a
// connection — never trust a single check alone; all four conditions must
// hold, or nothing runs.
function assertSafeTestDatabase() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      'Integration tests refused to run because NODE_ENV is not "test".'
    );
  }

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      "Integration tests refused to run because TEST_DATABASE_URL is not set."
    );
  }

  if (testUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Integration tests refused to run because TEST_DATABASE_URL is identical to DATABASE_URL."
    );
  }

  let dbName = "";
  try {
    dbName = new URL(testUrl).pathname.replace(/^\//, "").toLowerCase();
  } catch (err) {
    throw new Error(
      "Integration tests refused to run because TEST_DATABASE_URL is not a valid connection string."
    );
  }

  if (!dbName.includes("test") && !dbName.includes("testing")) {
    throw new Error(
      "Integration tests refused to run because TEST_DATABASE_URL is not a test database."
    );
  }

  return testUrl;
}

module.exports = { assertSafeTestDatabase };
