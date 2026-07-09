// Resolves the backend's own public base URL for building absolute URLs
// (e.g. uploaded image URLs). Prefers an explicit BACKEND_PUBLIC_URL so a
// deployment can pin it exactly; falls back to the requesting host instead
// of a hardcoded localhost URL so it still works correctly when that env
// var isn't set (e.g. on a new Render deploy before it's configured).
function getPublicBaseUrl(req) {
  return process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
}

module.exports = { getPublicBaseUrl };
