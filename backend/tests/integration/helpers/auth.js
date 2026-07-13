// Task P1: user/auth fixtures for integration tests. Every email is unique
// per call — tests never share or depend on a fixed user ID.
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("./db");

let counter = 0;
function uniqueEmail(prefix = "test") {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 8)}@test.local`;
}

async function createUser({ role = "user", email } = {}) {
  const finalEmail = email || uniqueEmail(role);
  const hash = await bcrypt.hash("TestPass123!", 10);
  const result = await pool.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role",
    [finalEmail, hash, role]
  );
  return result.rows[0];
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  });
}

async function createCustomer(overrides = {}) {
  const user = await createUser({ role: "user", ...overrides });
  const token = signToken(user);
  return { user, token, authHeader: `Bearer ${token}` };
}

async function createAdmin(overrides = {}) {
  const user = await createUser({ role: "admin", ...overrides });
  const token = signToken(user);
  return { user, token, authHeader: `Bearer ${token}` };
}

module.exports = { uniqueEmail, createUser, signToken, createCustomer, createAdmin };
