// Task P1: applies every migration file, in order, to TEST_DATABASE_URL —
// and only TEST_DATABASE_URL. Reuses the exact same safety guard the app's
// own db.js and the integration-test helpers rely on, so this script can
// never accidentally run against DATABASE_URL even if invoked directly.
//
// Usage (PowerShell):
//   $env:NODE_ENV = "test"; node scripts/migrate-test-db.js
//
// This project has no migration-tracking table (migrations are applied
// manually throughout its history) — every migration file is written to be
// re-runnable (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, etc.),
// so re-applying the full set here is safe and idempotent.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { assertSafeTestDatabase } = require("../src/config/testDbGuard");

async function main() {
  const testDatabaseUrl = assertSafeTestDatabase();

  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      process.stdout.write(`Applying ${file}... `);
      await client.query(sql);
      console.log("OK");
    }
    console.log(`\nApplied ${files.length} migration file(s) to the test database.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
