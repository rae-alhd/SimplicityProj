// Task Q1: centralized Express error handler, extracted into its own
// module (rather than inline in app.js) so it can be unit-tested directly
// with a fake err/req/res, the same pattern this project already uses for
// orderStatus.js/paymentStatus.js/fulfillment.js. MUST be registered last
// in app.js.
//
// Every existing route already catches its own errors and responds
// directly (res.status(400/403/404/...).json(...)), so this only ever
// catches things that reach next(err): malformed-JSON/oversized-body
// errors from express.json(), CORS origin rejections from ./config/cors,
// and any truly unexpected thrown error. It never includes a stack trace
// or the raw internal error message in the response — in any
// environment — only a safe generic one; the real error is still
// console.error'd server-side for debugging (dev and production alike).
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.corsRejection) {
    return res.status(403).json({ error: "This origin is not allowed to access the API." });
  }

  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({ error: "Request body is too large." });
  }

  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Malformed JSON in request body." });
  }

  console.error("[errorHandler] unexpected error:", err);

  const status = Number.isInteger(err.status) ? err.status : 500;
  const message = status < 500 && err.expose ? err.message : "Internal server error";
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
