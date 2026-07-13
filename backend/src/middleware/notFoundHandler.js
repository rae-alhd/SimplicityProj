// Task Q1: small, safe JSON 404 for unknown /api routes. Lives in its own
// module (rather than inline in app.js) so it can be unit-tested directly
// with a fake req/res, the same pattern this project already uses for
// orderStatus.js/paymentStatus.js/fulfillment.js.
function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

module.exports = { notFoundHandler };
