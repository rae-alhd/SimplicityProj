// Task Q1: production-only startup validation. Deliberately called ONLY
// from server.js, never from app.js — app.js is imported directly by every
// integration test (NODE_ENV=test), and this file must never make that
// import path throw or require production-only variables like
// FRONTEND_URL. TEST_DATABASE_URL is intentionally never referenced here;
// that protection lives entirely in testDbGuard.js and stays untouched.
const PLACEHOLDER_JWT_SECRETS = new Set([
  "replace-with-a-long-random-string",
  "secret",
  "changeme",
  "change-me",
  "your-secret-key",
  "jwt_secret",
  "jwtsecret",
  "test",
  "password",
  "12345678",
]);

const MIN_JWT_SECRET_LENGTH = 32;

// Never prints the value of any variable it checks — only names.
function validateProductionEnv(env = process.env) {
  if (env.NODE_ENV !== "production") return;

  const missing = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");
  if (!env.JWT_EXPIRES_IN) missing.push("JWT_EXPIRES_IN");
  if (!env.FRONTEND_URL && !env.ALLOWED_ORIGINS) {
    missing.push("FRONTEND_URL or ALLOWED_ORIGINS");
  }

  if (missing.length > 0) {
    throw new Error(
      `Refusing to start in production: missing required environment variable(s): ${missing.join(", ")}.`
    );
  }

  const secret = env.JWT_SECRET.trim();
  if (PLACEHOLDER_JWT_SECRETS.has(secret.toLowerCase()) || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `Refusing to start in production: JWT_SECRET is missing, a placeholder, or shorter than ${MIN_JWT_SECRET_LENGTH} characters. ` +
      `Generate a real one, e.g.: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
}

module.exports = { validateProductionEnv, MIN_JWT_SECRET_LENGTH };
