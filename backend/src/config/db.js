require("dotenv").config();
const { Pool, types } = require("pg");

// Task O1: DATE columns (order_fulfillment.estimated_delivery_date) default
// to being parsed into a JS Date at local midnight, which then serializes
// to JSON as a UTC instant that can land on the previous or next calendar
// day depending on the server's timezone — a real bug, not cosmetic, since
// the customer-facing date display then depends on server TZ. OID 1082 is
// DATE; returning the raw "YYYY-MM-DD" string sidesteps all of that.
types.setTypeParser(1082, (value) => value);

// Task P1: normal app execution (dev/production) always uses DATABASE_URL,
// completely unchanged. Only when NODE_ENV=test does this module redirect
// to TEST_DATABASE_URL — and even then, only after the same four-condition
// safety check integration tests themselves rely on, so importing app.js
// under NODE_ENV=test can never silently fall through to the real database
// just because TEST_DATABASE_URL was misconfigured or missing.
const isTestEnv = process.env.NODE_ENV === "test";
if (isTestEnv) {
  require("./testDbGuard").assertSafeTestDatabase();
}
const connectionString = isTestEnv
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("connect", () => {
  console.log("PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("Unexpected DB error", err);
  process.exit(1);
});

module.exports = pool;