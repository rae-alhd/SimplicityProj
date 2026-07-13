# Simplicity

A full-stack e-commerce platform (Express/PostgreSQL backend, React/Vite
frontend) for a made-to-order clothing store — product customization,
General/Variant inventory, order production workflow, payments, and
shipping & fulfillment.

## Testing

This project has a permanent, automated test suite: backend unit tests
(Node's built-in test runner), backend API integration tests (Supertest
against a real, isolated PostgreSQL test database), and frontend tests
(Vitest + React Testing Library). All of it runs in GitHub Actions CI on
every pull request and every push to `main` — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Test database safety

**The test suite never touches your real development database.** Backend
integration tests connect exclusively to `TEST_DATABASE_URL`, a separate
environment variable from `DATABASE_URL`. A dedicated safety guard
(`backend/src/config/testDbGuard.js`) refuses to run — and refuses to let
`backend/src/config/db.js` open a connection at all — unless **all** of
the following hold:

- `NODE_ENV` is exactly `"test"`
- `TEST_DATABASE_URL` is set
- `TEST_DATABASE_URL` is different from `DATABASE_URL`
- the database name in `TEST_DATABASE_URL` contains `test` or `testing`

If any of these fail, you'll see an explicit error such as:

```
Integration tests refused to run because TEST_DATABASE_URL is not a test database.
```

This is not weakened anywhere in the test suite, and nothing in it ever
truncates or resets `DATABASE_URL`.

### 1. Create a local test database (one-time setup)

You need a PostgreSQL server running locally (the same one your dev
database already uses is fine — this just adds a second, separate
database on it).

**PowerShell**, using `pg` via a one-off Node script (no `psql` CLI
required):

```powershell
cd backend
node -e "require('dotenv').config(); const { Client } = require('pg'); const url = new URL(process.env.DATABASE_URL); url.pathname = '/postgres'; (async () => { const c = new Client({ connectionString: url.toString() }); await c.connect(); await c.query('CREATE DATABASE simplicity_test_db'); await c.end(); console.log('Created simplicity_test_db'); })();"
```

If you have `psql` available instead:

```powershell
psql -U postgres -c "CREATE DATABASE simplicity_test_db;"
```

### 2. Configure `TEST_DATABASE_URL`

Copy `backend/.env.example` to `backend/.env` if you haven't already, then
add a `TEST_DATABASE_URL` line pointing at the database you just created —
same host/user/password as `DATABASE_URL`, different database name:

```
TEST_DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/simplicity_test_db
```

### 3. Apply migrations to the test database

This project has no migration-tracking table — every migration file is
additive and safe to re-run. The helper script applies all of them, in
order, to `TEST_DATABASE_URL` only (it uses the same safety guard above):

**PowerShell:**

```powershell
cd backend
$env:NODE_ENV = "test"
node scripts/migrate-test-db.js
```

Re-run this any time a new migration file is added.

### 4. Run the backend test suite

**PowerShell:**

```powershell
cd backend
npm run test:unit          # pure logic — no database needed
npm run test:integration   # real HTTP requests against TEST_DATABASE_URL
npm run test:coverage      # both, with a coverage report
```

- `test:unit` — order-status transitions, payment transitions, fulfillment
  validation (tracking URLs, shipping methods, Courier/Pickup rules), and
  the General/Variant inventory availability helper. No database
  connection at all.
- `test:integration` — real HTTP requests (via Supertest) against the real
  Express app (`backend/src/app.js`, imported directly — no server port is
  opened), backed by the real `TEST_DATABASE_URL` database. Covers
  authorization, checkout (General and Variant inventory), out-of-stock
  protection, checkout atomicity (a forced mid-transaction failure, using
  a temporary database constraint — never a change to production code),
  the full order production workflow, cancellation and stock restoration,
  payments, refund-required tracking, shipping & fulfillment, customer
  data-privacy (My Orders must never leak private notes, admin IDs, or
  internal flags), and admin order filters.

Integration tests run test **files** sequentially
(`--test-concurrency=1`) — they all share one test database via
`TRUNCATE ... CASCADE` between files, so running them in parallel would
race.

### 5. Run the frontend test suite

**PowerShell:**

```powershell
cd frontend
npm run test:run       # run once
npm run test:watch     # watch mode, for local development
npm run test:coverage  # with a coverage report
```

Covers the shared `orderStatus.js` / `paymentStatus.js` / `fulfillment.js`
display utilities (labels, badge styles, valid next actions) and
`ProductCard` (image renders, the image links to the exact same product
route as "View Details", alt text, the out-of-stock badge never blocks the
click, the "No Image" fallback stays linked).

### 6. Run everything the way CI does

**PowerShell:**

```powershell
cd backend
$env:NODE_ENV = "test"
node scripts/migrate-test-db.js
npm run test:unit
npm run test:integration
cd ..\frontend
npm run test:run
npm run build
```

### How GitHub Actions CI works

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull
request and every push to `main`:

- **Backend job** — starts an ephemeral PostgreSQL 16 service container
  (with a health check so the job waits for it to be ready), points
  `TEST_DATABASE_URL` at it, applies all migrations, then runs backend
  unit tests, integration tests, and coverage. `DATABASE_URL` is
  deliberately left unset in CI.
- **Frontend job** — installs dependencies, runs the frontend test suite
  and coverage, then runs `npm run build`.
- Both jobs use `npm ci` with dependency caching, and the job fails if any
  test or the build fails.
- `JWT_SECRET` in CI is a hardcoded placeholder
  (`ci-test-only-secret-not-a-real-credential`) — not a real credential,
  and not the same value your local `.env` uses.
- Nothing in this workflow deploys anywhere.

### Known coverage gaps

This suite focuses on the order/inventory/payment/fulfillment workflows.
Product galleries, customization collections/designs, homepage/admin
settings, and most of the admin product-management UI are not yet covered
by automated tests — see the latest test-suite report for exact numbers.

## Production Readiness (Task Q1)

Full deployment steps, environment variables, and a production checklist
live in [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md). This section is a
short summary of what backs it.

- **Environment validation** — with `NODE_ENV=production`, the backend
  refuses to start unless `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  and `FRONTEND_URL`/`ALLOWED_ORIGINS` are all set, and refuses a
  placeholder or under-32-character `JWT_SECRET`. Never prints any
  variable's value. See
  [`backend/src/config/envValidation.js`](backend/src/config/envValidation.js).
- **CORS** — locked to explicitly configured frontend origin(s) in
  production instead of the previous unrestricted `cors()`. See
  [`backend/src/config/cors.js`](backend/src/config/cors.js).
- **Rate limiting** — login/register, checkout, and admin payment/
  fulfillment mutations are IP-based rate limited
  (`backend/src/middleware/rateLimit.js`); normal product browsing is not
  limited. Correct client-IP detection depends on `trust proxy` being set
  to `1` (one hop) in `backend/src/app.js`, matching Render's single
  reverse-proxy hop — not `true` (trust everyone), which would make the
  limiter spoofable. **Store limitation, documented honestly:**
  `express-rate-limit` is configured with its default in-memory store —
  there is no Redis or other shared store. This means limits are tracked
  per backend *process*: counters reset on every restart/redeploy, and if
  this were ever scaled to multiple backend replicas (Render's free/starter
  tiers run exactly one), each replica would enforce its own separate
  counter rather than sharing one. That's acceptable for this project's
  current single-instance deployment, but a real multi-replica production
  setup would need a shared store (e.g. Redis via `rate-limit-redis`) for
  the limits to mean what they claim — not added here, since that requires
  a paid/managed service this task wasn't authorized to add.
- **Frontend API URL** — the frontend (Vercel) and backend (Render) are
  deployed separately, so `npm run build` (a production build) now
  **fails the build outright** unless `VITE_API_URL` is a valid `http(s)://`
  URL whose path is **exactly `/api`** (no `javascript:`/`data:`/`ftp:`
  schemes, no embedded credentials, no query string or fragment, and no
  bare origin, sub-path, near-miss, or wrong casing — only `/api` itself,
  trailing slash normalized away) — see
  [`frontend/vite.config.js`](frontend/vite.config.js) and
  [`frontend/src/config/validateApiUrl.js`](frontend/src/config/validateApiUrl.js).
  It deliberately does **not** fall back to a same-origin relative `/api`
  in production, since that would silently send every request to the
  Vercel origin instead of the Render backend. `npm run dev` is
  unaffected and keeps its `http://localhost:5000/api` fallback.
- **Health check** — `GET /api/health` does a real `SELECT 1` and returns
  `200`/`503` accordingly, with no internal details in the response. See
  [Health Endpoint](DEPLOYMENT_GUIDE.md#health-endpoint) in the deployment guide.
- **Global error handling** — a centralized error handler
  (`backend/src/middleware/errorHandler.js`) never returns a stack trace
  or raw internal error message to the client, in any environment; a JSON
  404 handler (`backend/src/middleware/notFoundHandler.js`) covers unknown
  `/api` routes.
- **Graceful shutdown** — `backend/src/server.js` (never `app.js`, which
  every test imports directly) handles `SIGINT`/`SIGTERM` by closing the
  HTTP server and the PostgreSQL pool before exiting.
- **Upload security** — JPEG/PNG/WEBP-only allowlist (no SVG, no
  executables), server-generated filenames sanitized against path
  traversal (`backend/src/utils/safeFilename.js`), per-file and per-batch
  size/count limits, and partially-uploaded files are deleted if the
  following database write fails.
- **Uploads storage** — uploaded images are stored on the backend's local
  filesystem, which is **ephemeral on most Render plans**. This is a real,
  current limitation, not fixed by this task — see
  [Uploads Storage](DEPLOYMENT_GUIDE.md#8-important-limitation--uploads-storage)
  for the honest status and a documented (not yet implemented) migration
  path to persistent storage.
- **Auth token storage** — the JWT is stored in `localStorage` (see
  `frontend/src/pages/Login.jsx`, `Navbar.jsx`, `MyOrders.jsx`), **not** an
  HttpOnly cookie. This is a known, documented tradeoff: `localStorage` is
  readable by any JavaScript running on the page, so a successful XSS
  finding elsewhere in the frontend could steal a logged-in user's token.
  Moving to HttpOnly secure cookies would meaningfully reduce that risk,
  but is a real authentication-architecture change (cookie issuance,
  CSRF protection, SameSite policy) — intentionally out of scope for this
  task rather than rewritten under time pressure.
- **Smoke test** — `backend/scripts/smoke-test.js`
  (`npm run smoke:test -- <url>`) safely checks a running backend
  (health, public product listing, safe 404, admin-route rejection)
  without logging in or modifying any real data. See
  [Smoke Test](DEPLOYMENT_GUIDE.md#smoke-test) in the deployment guide.
