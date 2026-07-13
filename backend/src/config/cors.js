// Task Q1: locks CORS to explicitly configured frontend origin(s) instead
// of the previous unrestricted `cors()` (which reflected any Origin). The
// standard local Vite dev origins are always allowed in non-production so
// local development stays convenient without any env configuration.
const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function parseConfiguredOrigins(env = process.env) {
  const raw = env.ALLOWED_ORIGINS || env.FRONTEND_URL || "";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildAllowedOrigins(env = process.env) {
  const configured = parseConfiguredOrigins(env);
  if (env.NODE_ENV === "production") {
    return configured;
  }
  return [...new Set([...configured, ...DEV_ORIGINS])];
}

const allowedOrigins = buildAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    // Requests with no Origin header — curl, server-to-server calls, the
    // health check, and every Supertest request in this project's own
    // integration-test suite (Supertest never sets Origin) — are not
    // subject to the browser same-origin model, so they're always allowed.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const err = new Error(`Origin "${origin}" is not allowed by CORS.`);
    err.corsRejection = true;
    return callback(err);
  },
  // The frontend authenticates with an explicit `Authorization: Bearer`
  // header (see frontend/src/config/api.js + localStorage token), never
  // cookies — so CORS "credentials" mode, which only governs cookies/HTTP
  // auth/TLS client certs, is not needed and is deliberately left off.
};

module.exports = { corsOptions, allowedOrigins, buildAllowedOrigins };
