// Shared between vite.config.js (build-time gate, Node.js context) and
// api.js (runtime normalization, browser context) — kept as a small pure
// function with no Node-only or browser-only APIs so both can import it
// identically.
//
// Every call site in this app does `${API_BASE}/something` (never
// `${API_BASE}something`), so a trailing slash on API_BASE would produce
// a distinct, unmatched "//something" path against the backend — the
// trailing-slash strip below is what keeps that convention intact
// regardless of whether the configured value happens to end in "/".
export function normalizeApiUrl(rawValue) {
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!trimmed) {
    return {
      ok: false,
      reason: "missing",
      detail: "It is not set (or blank).",
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      reason: "malformed",
      detail: `The value "${trimmed}" is not a valid URL.`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "protocol",
      detail: `The value "${trimmed}" must use http:// or https:// (got "${parsed.protocol}").`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      reason: "credentials",
      detail: `The value "${trimmed}" must not contain a username or password.`,
    };
  }

  if (parsed.search) {
    return {
      ok: false,
      reason: "query",
      detail: `The value "${trimmed}" must not contain a query string.`,
    };
  }

  if (parsed.hash) {
    return {
      ok: false,
      reason: "fragment",
      detail: `The value "${trimmed}" must not contain a fragment.`,
    };
  }

  // This project's convention is a single, exact "/api" base path — not
  // a bare origin, not a sub-path, not a different casing. Trailing
  // slashes are normalized away before comparing, so "/api" and "/api/"
  // are both accepted, but "/", "/wrong", "/api/v2", "/apis", and "/API"
  // are all rejected.
  const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath !== "/api") {
    return {
      ok: false,
      reason: "path",
      detail: `The value "${trimmed}" must have a base path of exactly "/api" (got "${parsed.pathname}").`,
    };
  }

  return { ok: true, value: trimmed.replace(/\/+$/, "") };
}
