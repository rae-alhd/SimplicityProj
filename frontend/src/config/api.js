// Task Q1.1: frontend and backend are deployed separately (Vercel +
// Render) — falling back to a same-origin relative "/api" in production
// would silently send every request to the Vercel origin, which has no
// API to answer it. vite.config.js already refuses to produce a
// production build at all unless VITE_API_URL is a valid, present
// http(s) URL, so by the time this code runs in a real production
// bundle, `import.meta.env.VITE_API_URL` is guaranteed valid — the
// production branch below is a defensive backstop, not the primary
// enforcement point, and throws rather than silently degrading if it's
// ever somehow reached anyway.
import { normalizeApiUrl } from "./validateApiUrl";

function resolveApiBase() {
  const raw = import.meta.env.VITE_API_URL;

  if (import.meta.env.PROD) {
    const result = normalizeApiUrl(raw);
    if (!result.ok) {
      throw new Error(`VITE_API_URL is required for a production build. ${result.detail}`);
    }
    return result.value;
  }

  // Development: the local backend fallback is genuinely convenient, and
  // still normalized if a real VITE_API_URL happens to be configured
  // locally too (e.g. testing against a deployed backend from dev).
  if (raw) {
    const result = normalizeApiUrl(raw);
    if (result.ok) return result.value;
  }

  return "http://localhost:5000/api";
}

const API_BASE = resolveApiBase();

export default API_BASE;
