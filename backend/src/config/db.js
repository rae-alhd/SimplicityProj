require("dotenv").config();
const { Pool, types } = require("pg");

// Task O1: DATE columns (order_fulfillment.estimated_delivery_date) default
// to being parsed into a JS Date at local midnight, which then serializes
// to JSON as a UTC instant that can land on the previous or next calendar
// day depending on the server's timezone — a real bug, not cosmetic, since
// the customer-facing date display then depends on server TZ. OID 1082 is
// DATE; returning the raw "YYYY-MM-DD" string sidesteps all of that.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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