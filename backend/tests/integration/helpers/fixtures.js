// Task P1: product/cart fixtures for integration tests. Every product name
// (and Variant color/size) is unique per call — no test depends on a fixed
// product ID or a name that could collide with another test's data.
const { pool } = require("./db");
const app = require("../../../src/app");
const request = require("supertest");

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 6)}`;
}

// GENERAL-inventory, STANDARD-sizing product — the simplest possible
// checkout fixture, mirrors the real "One Size" product shape used
// throughout this project's own manual testing.
async function createGeneralProduct({ stock = 50, price = 25.0 } = {}) {
  const name = unique("Test General Product");
  const result = await pool.query(
    `INSERT INTO products
       (name, description, category, target_group, base_price, stock_quantity,
        is_customizable, is_active, sizing_mode, standard_size_label, inventory_mode)
     VALUES ($1, 'integration test fixture', 'Test', 'UNISEX', $2, $3, false, true, 'STANDARD', 'One Size', 'GENERAL')
     RETURNING *`,
    [name, price, stock]
  );
  return result.rows[0];
}

// MULTI_SIZE / VARIANT product with exactly one active color+size
// combination and its own independent stock pool.
async function createVariantProduct({ stock = 20, price = 40.0 } = {}) {
  const name = unique("Test Variant Product");
  const colorName = unique("Color");
  const sizeLabel = unique("Sz").slice(0, 10);

  const productResult = await pool.query(
    `INSERT INTO products
       (name, description, category, target_group, base_price, stock_quantity,
        is_customizable, is_active, sizing_mode, inventory_mode)
     VALUES ($1, 'integration test fixture', 'Test', 'UNISEX', $2, 0, false, true, 'MULTI_SIZE', 'VARIANT')
     RETURNING *`,
    [name, price]
  );
  const product = productResult.rows[0];

  const colorResult = await pool.query(
    "INSERT INTO customizable_product_colors (product_id, color_name, is_active) VALUES ($1, $2, true) RETURNING *",
    [product.id, colorName]
  );
  const sizeResult = await pool.query(
    "INSERT INTO customizable_product_sizes (product_id, size_label, is_active) VALUES ($1, $2, true) RETURNING *",
    [product.id, sizeLabel]
  );
  const variantResult = await pool.query(
    `INSERT INTO product_inventory_variants (product_id, color_id, size_id, stock_quantity)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [product.id, colorResult.rows[0].id, sizeResult.rows[0].id, stock]
  );

  return {
    product,
    color: colorResult.rows[0],
    size: sizeResult.rows[0],
    variant: variantResult.rows[0],
  };
}

async function addGeneralToCart(customer, productId, quantity = 1) {
  return request(app)
    .post("/api/cart")
    .set("Authorization", customer.authHeader)
    .send({ product_id: productId, quantity });
}

async function addVariantToCart(customer, productId, colorName, sizeLabel, quantity = 1) {
  return request(app)
    .post("/api/cart")
    .set("Authorization", customer.authHeader)
    .send({ product_id: productId, quantity, color: colorName, size: sizeLabel });
}

async function placeOrder(customer, overrides = {}) {
  return request(app)
    .post("/api/orders")
    .set("Authorization", customer.authHeader)
    .send({
      customer_name: overrides.customer_name || "Integration Test Customer",
      address: overrides.address || "123 Test Street",
      phone: overrides.phone,
      notes: overrides.notes,
      is_gift: overrides.is_gift,
    });
}

module.exports = {
  unique,
  createGeneralProduct,
  createVariantProduct,
  addGeneralToCart,
  addVariantToCart,
  placeOrder,
};
