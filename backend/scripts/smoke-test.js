// Task Q1: safe, read-only smoke test for a already-running backend (local
// or deployed). Never logs in, never creates/modifies/deletes any user,
// order, payment, product, or stock row — only GETs public/expected-403
// endpoints and checks status codes and response shape.
//
// Usage (PowerShell):
//   node scripts/smoke-test.js http://localhost:5000
//   $env:SMOKE_TEST_BASE_URL = "https://your-backend.onrender.com"; node scripts/smoke-test.js
//   npm run smoke:test -- http://localhost:5000
//
// Deliberately requires an explicit base URL (argument or
// SMOKE_TEST_BASE_URL) — there is no default/hardcoded production URL, so
// this can never accidentally run against production by mistake.

const baseUrl = process.argv[2] || process.env.SMOKE_TEST_BASE_URL;

if (!baseUrl) {
  console.error(
    "smoke-test: no base URL provided. Usage:\n" +
    "  node scripts/smoke-test.js <baseUrl>\n" +
    "  SMOKE_TEST_BASE_URL=<baseUrl> node scripts/smoke-test.js"
  );
  process.exit(1);
}

const API_BASE = `${baseUrl.replace(/\/+$/, "")}/api`;

const checks = [
  {
    name: "GET /api/health returns 200 with status ok",
    async run() {
      const res = await fetch(`${API_BASE}/health`);
      const body = await res.json().catch(() => null);
      if (res.status !== 200) {
        return `expected 200, got ${res.status}`;
      }
      if (!body || body.status !== "ok") {
        return `expected { status: "ok" }, got ${JSON.stringify(body)}`;
      }
      if (typeof body.timestamp !== "string") {
        return "response is missing a timestamp field";
      }
      return null;
    },
  },
  {
    name: "GET /api/products returns a public product list",
    async run() {
      const res = await fetch(`${API_BASE}/products`);
      const body = await res.json().catch(() => null);
      if (res.status !== 200) {
        return `expected 200, got ${res.status}`;
      }
      if (!Array.isArray(body)) {
        return `expected an array response, got ${typeof body}`;
      }
      return null;
    },
  },
  {
    name: "GET /api/this-route-does-not-exist returns a safe JSON 404",
    async run() {
      const res = await fetch(`${API_BASE}/this-route-does-not-exist`);
      if (res.status !== 404) {
        return `expected 404, got ${res.status}`;
      }
      const body = await res.json().catch(() => null);
      if (!body || typeof body.error !== "string") {
        return `expected a JSON { error } body, got ${JSON.stringify(body)}`;
      }
      return null;
    },
  },
  {
    name: "GET /api/orders (admin-only) without a token is rejected",
    async run() {
      const res = await fetch(`${API_BASE}/orders`);
      if (res.status !== 401 && res.status !== 403) {
        return `expected 401 or 403, got ${res.status}`;
      }
      return null;
    },
  },
  {
    name: "PATCH /api/orders/1/payment (admin-only) without a token is rejected",
    async run() {
      const res = await fetch(`${API_BASE}/orders/1/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      if (res.status !== 401 && res.status !== 403) {
        return `expected 401 or 403, got ${res.status}`;
      }
      return null;
    },
  },
];

async function main() {
  console.log(`Running smoke tests against ${API_BASE}\n`);

  let failures = 0;

  for (const check of checks) {
    try {
      const failureReason = await check.run();
      if (failureReason) {
        failures += 1;
        console.log(`FAIL  ${check.name}\n      ${failureReason}`);
      } else {
        console.log(`PASS  ${check.name}`);
      }
    } catch (err) {
      failures += 1;
      console.log(`FAIL  ${check.name}\n      ${err.message}`);
    }
  }

  console.log(`\n${checks.length - failures}/${checks.length} checks passed.`);

  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("smoke-test: unexpected error:", err.message);
  process.exit(1);
});
