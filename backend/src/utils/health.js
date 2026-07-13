// Task Q1: takes a pool as a parameter (rather than importing the module-
// level singleton directly) purely so this can be unit-tested against a
// fake pool that deliberately fails, without touching the real database
// connection — the actual /api/health route in app.js always calls this
// with the real pool from ./config/db.
async function checkDatabaseHealth(pool) {
  try {
    await pool.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false };
  }
}

module.exports = { checkDatabaseHealth };
