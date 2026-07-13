// Task Q1: targeted rate limiting for abuse-prone endpoints only — never
// applied to normal product browsing. IP-based (express-rate-limit's
// default keyGenerator uses req.ip), which is only trustworthy because
// app.js sets `trust proxy` to a specific hop count rather than `true` —
// see the comment there.
//
// Thresholds are sized generously above this project's own integration
// test traffic so `npm test` never trips them:
//   - checkout.test.js places up to 6 orders in a single run
//   - payments.test.js performs up to 14 payment-status mutations
// No existing test calls /api/auth/login or /api/auth/register over HTTP
// at all (integration tests sign JWTs directly), so authLimiter's
// threshold is chosen purely for production brute-force resistance.
const rateLimit = require("express-rate-limit");

function jsonRateLimitHandler(req, res) {
  res.status(429).json({
    error: "Too many requests. Please try again later.",
  });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

const adminMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

module.exports = { authLimiter, checkoutLimiter, adminMutationLimiter };
