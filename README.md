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
