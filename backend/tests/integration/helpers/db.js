// Task P1: the ONLY pool integration tests use — this is literally
// require("../../../src/config/db"), which itself refuses to connect to
// anything but TEST_DATABASE_URL when NODE_ENV=test (set by
// tests/integration/_setup.js, preloaded before any test file runs). There
// is no second, parallel "test pool" implementation to keep in sync.
const pool = require("../../../src/config/db");
const { assertSafeTestDatabase } = require("../../../src/config/testDbGuard");

// App tables only — homepage_settings/store_settings are independent
// singleton config tables untouched by order/product/user tests.
const TABLES_IN_FK_SAFE_ORDER = [
  "payment_status_history",
  "order_status_history",
  "order_admin_notes",
  "order_fulfillment",
  "payments",
  "order_items",
  "cart_items",
  "orders",
  "collection_design_preview_images",
  "collection_design_variant_sizes",
  "collection_design_variants",
  "collection_designs",
  "design_collections",
  "product_inventory_variants",
  "customization_examples",
  "customizable_product_sizes",
  "customizable_product_colors",
  "customization_options",
  "product_images",
  "products",
  "users",
];

// Re-checked immediately before the one genuinely destructive operation
// this whole test suite performs — defense in depth on top of db.js's own
// module-load-time check, so a future refactor of db.js can't silently
// remove the guard that makes this TRUNCATE safe to call.
async function resetDatabase() {
  assertSafeTestDatabase();
  await pool.query(`TRUNCATE TABLE ${TABLES_IN_FK_SAFE_ORDER.join(", ")} RESTART IDENTITY CASCADE`);
}

module.exports = { pool, resetDatabase };
