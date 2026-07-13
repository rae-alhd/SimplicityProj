require("dotenv").config();

// Task Q1: production-only startup validation. Deliberately imported and
// called ONLY here, never from app.js — app.js is imported directly by
// every integration test (NODE_ENV=test), and this must never run there.
// PORT itself is intentionally not validated: Render (and most PaaS hosts)
// injects it automatically, and the `|| 5000` fallback below is only ever
// used for local development.
const { validateProductionEnv } = require("./config/envValidation");
validateProductionEnv();

const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected"); // 👈 THIS SHOULD APPEAR
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error("Database connection failed:", err.message);
  }
});

// Task Q1: graceful shutdown. Lives here (not app.js) so importing app.js
// for tests never registers these handlers or touches process.exit — each
// integration-test file closes its own copy of the pool explicitly
// instead (see tests/integration/helpers/db.js). shuttingDown guards
// against a duplicate handler firing twice (e.g. some process managers
// send both SIGINT and SIGTERM during one shutdown).
let shuttingDown = false;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received: shutting down gracefully...`);

  server.close(async (err) => {
    if (err) {
      console.error("Error while closing HTTP server:", err.message);
    }

    try {
      await pool.end();
      console.log("PostgreSQL pool closed.");
    } catch (poolErr) {
      console.error("Error while closing PostgreSQL pool:", poolErr.message);
    }

    process.exit(err ? 1 : 0);
  });

  // server.close() waits for in-flight requests to finish but stops
  // accepting new ones immediately; if something hangs, don't let the
  // process live forever.
  setTimeout(() => {
    console.error("Forced shutdown after 10s — some connection did not close in time.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));