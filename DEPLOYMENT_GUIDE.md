# Simplicity — Deployment Guide (Private Owner/Admin Test Version)

This guide covers deploying Simplicity as a **private test version** for the owner/admin to try live — not a full production launch. Task Q1 hardened the backend for this (environment validation, CORS allowlist, rate limiting, a real health check, graceful shutdown) without changing any business behavior — see the "Production Readiness" sections below for what that added.

- **Database:** Neon PostgreSQL
- **Backend:** Render
- **Frontend:** Vercel

---

## 1. Pre-Deployment Checklist

- [ ] `git status` is clean — no uncommitted changes you meant to include are missing, nothing unexpected is staged.
- [ ] `cd frontend && npm run build` completes with no errors.
- [ ] `cd backend && npm start` runs locally without crashing and connects to the database.
- [ ] `cd backend && npm test` (unit + integration, against `TEST_DATABASE_URL` only) passes — see README.md's Testing section.
- [ ] [GitHub Actions CI](#how-to-verify-ci-before-deploying) is green on the commit you're about to deploy.
- [ ] All migrations in `backend/migrations/` are present and you know their order (see [section 4](#4-neon-database-steps) below) — currently `000` through `026`. Migrations `024`, `025`, and `026` (payments, order fulfillment, tracking-unavailable) are already applied on the shared development database; never rewrite an already-applied migration file — add a new one instead.

---

## 2. Required Environment Variables — Render (Backend)

| Variable | Required? | Value |
|---|---|---|
| `DATABASE_URL` | Yes | Neon connection string (see step 4) |
| `JWT_SECRET` | Yes | A long random secret used to sign login tokens — see [generating a secure JWT_SECRET](#generating-a-secure-jwt_secret) below |
| `JWT_EXPIRES_IN` | Yes | e.g. `1h` |
| `NODE_ENV` | Yes | `production` |
| `FRONTEND_URL` | Yes (or `ALLOWED_ORIGINS`) | Your deployed Vercel URL, e.g. `https://your-app.vercel.app` — see [CORS configuration](#cors-configuration) |
| `ALLOWED_ORIGINS` | Optional | Comma-separated list, if more than one frontend origin needs access (e.g. production + a preview deploy). Takes priority over `FRONTEND_URL`. |
| `BACKEND_PUBLIC_URL` | Optional | The Render backend's own public URL |

With `NODE_ENV=production`, the backend refuses to start at all if `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, or both `FRONTEND_URL`/`ALLOWED_ORIGINS` are missing, or if `JWT_SECRET` looks like a placeholder or is shorter than 32 characters — see [`backend/src/config/envValidation.js`](backend/src/config/envValidation.js). This is deliberate: it's better for a misconfigured deploy to fail immediately and loudly on Render's own logs than to boot in a broken/insecure state. `TEST_DATABASE_URL` is never required for production startup.

**`BACKEND_PUBLIC_URL`** should be the URL Render gives your backend service, for example:
```
https://your-backend-name.onrender.com
```
This is used when the backend builds absolute URLs for uploaded images (product photos, homepage hero/card images, design images). If it's missing, the backend falls back to detecting the URL from the incoming request — but setting it explicitly is the safest, most predictable option.

### Generating a secure JWT_SECRET

**PowerShell:**
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Paste the output directly into Render's `JWT_SECRET` environment variable. Never reuse the placeholder value from `backend/.env.example`, never reuse your local development secret, and never commit the real value anywhere.

### CORS configuration

The backend only accepts cross-origin requests from origins you explicitly configure via `FRONTEND_URL` (or `ALLOWED_ORIGINS` for more than one) — see [`backend/src/config/cors.js`](backend/src/config/cors.js). Requests with no `Origin` header at all (server-to-server calls, curl, health checks) are always allowed, since the browser same-origin model is what CORS protects in the first place. Local development (`http://localhost:5173`) is always allowed automatically outside of `NODE_ENV=production` — you don't need to configure anything for local dev. If you add a Vercel preview deployment with its own URL, add it to `ALLOWED_ORIGINS` alongside your production URL.

---

## 3. Required Environment Variables — Vercel (Frontend)

| Variable | Value |
|---|---|
| `VITE_API_URL` | The Render backend's API base URL, **including `/api`** |

Example:
```
https://your-backend-name.onrender.com/api
```

The frontend reads this via `import.meta.env.VITE_API_URL`. In local development (`npm run dev`), it falls back to `http://localhost:5000/api` if unset — no configuration needed for local dev. In a **production build** (`npm run build`, which is exactly what Vercel's build step runs), `VITE_API_URL` is **required** — the build fails outright, before any bundle is produced, unless the value is a valid `http://`/`https://` URL whose path is **exactly `/api`** (a trailing slash is normalized away, but a bare origin, `/`, `/wrong`, a sub-path like `/api/v2`, a near-miss like `/apis`, or wrong casing like `/API` are all rejected — as are `javascript:`/`data:`/`ftp:` schemes, an embedded username/password, a query string, or a fragment). It deliberately does **not** fall back to `localhost` or to a same-origin relative `/api` in production — either would mean every API call silently targets the wrong place (nothing on a visitor's machine, or the Vercel origin itself, which has no API to answer it) instead of failing the deploy loudly. See [`frontend/vite.config.js`](frontend/vite.config.js) and [`frontend/src/config/validateApiUrl.js`](frontend/src/config/validateApiUrl.js) for the exact validation, and [`frontend/.env.example`](frontend/.env.example) for the placeholder.

A trailing slash is normalized away automatically (`https://your-backend.onrender.com/api/` and `.../api` both work identically) — every frontend request already appends its own leading `/`, so a trailing slash on `VITE_API_URL` itself would otherwise produce a broken double-slash path.

Never put backend secrets (`JWT_SECRET`, `DATABASE_URL`) in a `VITE_`-prefixed variable — anything with that prefix is bundled into the public JS served to every visitor's browser.

---

## 4. Neon (Database) Steps

1. Create a new Neon project and a database inside it.
2. Copy the connection string Neon gives you — this is your `DATABASE_URL`. Make sure it requires SSL (Neon connection strings do by default).
3. **Back up before running migrations against a database that already has real data** — Neon's own branching/history feature covers this, or `pg_dump` if you prefer a portable file.
4. Run every migration file in `backend/migrations/`, **in numeric order**, against this database before the backend is used for the first time:
   ```
   000_create_base_schema.sql
   001_create_product_images.sql
   002_backfill_product_images.sql
   003_create_homepage_settings.sql
   004_add_homepage_category_cards.sql
   005_create_design_collections.sql
   006_add_order_design_snapshot_fields.sql
   007_add_color_id_to_product_images.sql
   008_add_stock_restored_to_orders.sql
   009_create_store_settings.sql
   010_add_admin_notes_to_orders.sql
   011_create_order_status_history.sql
   012_create_collection_design_variants.sql
   013_create_collection_design_variant_sizes.sql
   014_create_collection_design_preview_images.sql
   015_add_design_variant_id_to_cart_items.sql
   016_add_design_variant_snapshot_to_order_items.sql
   017_add_customization_option_id_to_collection_designs.sql
   018_add_is_gift_to_orders.sql
   019_create_product_inventory_variants.sql
   020_add_inventory_snapshot_to_order_items.sql
   021_add_sizing_mode_to_products.sql
   022_add_order_production_workflow.sql
   023_reconcile_legacy_order_workflow_data.sql
   024_create_payments.sql
   025_add_order_fulfillment.sql
   026_add_tracking_unavailable.sql
   ```
   This project has no migration-tracking table — every migration file is written to be safely re-runnable (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.), so re-applying the full set is idempotent. **Never rerun a destructive migration blindly** against a database with real data if you're not certain it's safe to re-apply — read the file first. **Never rewrite an already-applied migration file** (`024`, `025`, and `026` are already applied against the shared development database) — add a new numbered migration instead if something needs to change.
5. **Verify the schema afterward**: connect with `psql` (or any client) and spot-check that the tables you expect exist — at minimum `users`, `products`, `orders`, `payments`, `order_fulfillment`. The [health endpoint](#health-endpoint) confirms the backend can connect at all, but not that every table is present.

The database starts empty — nothing will work until migrations are applied.

---

## 5. Render (Backend) Steps

1. Connect your GitHub repo to Render and create a new **Web Service**.
2. **Root directory:** `backend`
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. Add the environment variables from section 2 (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV=production`, `FRONTEND_URL`) — you can leave `BACKEND_PUBLIC_URL` for the next step, since you don't know the URL yet. The backend will refuse to start if any of the required ones are missing (see section 2) — check Render's logs if the deploy doesn't come up healthy.
6. Deploy.
7. Once live, copy the URL Render assigned to the service (e.g. `https://your-backend-name.onrender.com`).
8. Go back into the environment variables and set `BACKEND_PUBLIC_URL` to that exact URL.
9. Redeploy (or restart the service) so the new variable takes effect.

---

## 6. Vercel (Frontend) Steps

1. Connect your GitHub repo to Vercel and create a new project.
2. **Root directory:** `frontend`
3. **Build command:** `npm run build`
4. **Output directory:** `dist`
5. Add the environment variable from section 3: `VITE_API_URL` = `https://your-backend-name.onrender.com/api`
6. Deploy.

---

## 7. After-Deployment Test Checklist

Run through this on the live URLs before handing it to the owner:

- [ ] `GET https://your-backend-name.onrender.com/api/health` returns `{"status":"ok","database":"connected",...}` with a `200` — see [Health Endpoint](#health-endpoint) below.
- [ ] `node scripts/smoke-test.js https://your-backend-name.onrender.com` passes all checks — see [Smoke Test](#smoke-test) below.
- [ ] Login / Register
- [ ] Products load on the storefront
- [ ] Product images load correctly
- [ ] Admin Products page loads and works
- [ ] Admin image uploads (product, color-specific, homepage hero/cards) work and produce correct (non-localhost) URLs
- [ ] Customize page works end-to-end
- [ ] Cart works, including stock limits
- [ ] Checkout completes and deducts stock
- [ ] Admin Orders page loads, search/filter work
- [ ] Admin Notes save and persist
- [ ] Status Timeline records changes
- [ ] Homepage settings save and reflect on the public homepage

(For a more detailed step-by-step version of this checklist, see `FINAL_DEMO_CHECKLIST.md`.)

---

## 8. Important Limitation — Uploads Storage

Uploaded files (product images, homepage images, design images) are stored on **Render's local filesystem** under `backend/uploads/`. On most Render plans this storage is **ephemeral** — it can be wiped on redeploy or restart. This is a real, current limitation — it has not been fixed by Task Q1, only documented and defended against (safe filenames, MIME allowlist, size/count limits — see [`backend/src/routes/admin.products.routes.js`](backend/src/routes/admin.products.routes.js) and its two sibling upload routes).

- **For this private test deployment, this is acceptable.** If it happens, the owner may just need to re-upload a few images.
- **For real production later**, uploads should move to persistent/cloud storage. A future migration path that would **not** require breaking any currently-working upload URL:
  1. Every uploaded-image URL is already built through one place — [`backend/src/utils/publicUrl.js`](backend/src/utils/publicUrl.js)'s `getPublicBaseUrl()` — and every image is served from a predictable `/uploads/<category>/<filename>` path. A cloud-storage migration would swap what `getPublicBaseUrl()` (or a new equivalent) returns and what `multer`'s `storage` engine writes to (e.g. `multer-s3` instead of `multer.diskStorage`), without changing any route's request/response shape.
  2. Existing images already on local disk could be uploaded to the new storage provider and their `product_images.image_url` / equivalent rows updated in place — a one-time backfill script, not a schema change.
  3. This has intentionally **not** been implemented here — it requires choosing and paying for a provider (Cloudinary, S3, a Render persistent disk, etc.), which is outside this task's scope without the owner's approval.

---

## Health Endpoint

`GET /api/health` (no authentication required) performs a real `SELECT 1` against the database and returns:

```json
{ "status": "ok", "database": "connected", "timestamp": "2026-07-13T12:00:00.000Z" }
```

with HTTP `200` when the database is reachable, or

```json
{ "status": "error", "database": "unavailable", "timestamp": "2026-07-13T12:00:00.000Z" }
```

with HTTP `503` when it isn't. The response never includes a connection string, table name, row count, or stack trace. Use this as Render's health-check URL if/when you configure one, and as the first thing to check after any deploy or restart.

---

## Smoke Test

[`backend/scripts/smoke-test.js`](backend/scripts/smoke-test.js) is a safe, read-only script that checks a running backend (local or deployed) without logging in and without creating, modifying, or deleting any real user/order/payment/product/stock row. It checks: the health endpoint, the public product listing, a safe JSON 404 on an unknown route, and that admin-only routes reject unauthenticated requests.

**PowerShell:**
```powershell
cd backend
node scripts/smoke-test.js https://your-backend-name.onrender.com
# or, against local dev:
node scripts/smoke-test.js http://localhost:5000
# or via the npm script:
npm run smoke:test -- http://localhost:5000
```

It requires an explicit URL (argument or `SMOKE_TEST_BASE_URL` env var) — there is no default, so it can never accidentally run against production by mistake. It prints a clear PASS/FAIL line per check and exits non-zero if anything fails, so it's safe to use as a post-deploy gate.

---

## Graceful Restart

The backend (`backend/src/server.js`) handles `SIGINT`/`SIGTERM` by: refusing new connections, letting in-flight requests finish (up to 10 seconds), closing the PostgreSQL pool, then exiting. Render sends `SIGTERM` before restarting or redeploying a service, so a normal Render restart/redeploy already goes through this path — no manual action needed. If you ever need to restart the process yourself on a machine with real POSIX signals (Render's Linux containers, not a local Windows dev machine), `kill -TERM <pid>` triggers the same clean shutdown as `Ctrl+C`.

---

## Rollback Checklist

If a deploy causes a problem:

- [ ] **Render (backend):** open the service's Deploys tab and roll back to the previous successful deploy — Render keeps prior deploys available for this.
- [ ] **Vercel (frontend):** open the project's Deployments tab, find the last known-good deployment, and "Promote to Production" (or equivalent) — Vercel keeps every deployment addressable.
- [ ] **Database:** if the problem was caused by a migration, do **not** attempt to "undo" it by writing a reverse migration under pressure — restore from the Neon backup/branch taken in [step 4.3](#4-neon-database-steps) instead, or add a new forward-only migration once you understand the actual fix.
- [ ] After rolling back, re-run the [smoke test](#smoke-test) and the [health endpoint](#health-endpoint) check against the rolled-back URLs before telling anyone it's fixed.

---

## Common Deployment Failures

| Symptom | Likely cause |
|---|---|
| Backend won't start; Render logs show `Refusing to start in production: missing required environment variable(s): ...` | One of `DATABASE_URL`/`JWT_SECRET`/`JWT_EXPIRES_IN`/`FRONTEND_URL` (or `ALLOWED_ORIGINS`) isn't set on Render. |
| Backend won't start; logs show `JWT_SECRET is missing, a placeholder, or shorter than 32 characters` | `JWT_SECRET` on Render is still the `.env.example` placeholder, or too short — [generate a real one](#generating-a-secure-jwt_secret). |
| Frontend loads but every API call fails with a CORS error in the browser console | `FRONTEND_URL`/`ALLOWED_ORIGINS` on Render doesn't exactly match the frontend's real deployed origin (scheme + host, no trailing slash). |
| Vercel build fails with `VITE_API_URL is required for a production build.` | `VITE_API_URL` isn't set (or is blank/invalid) on Vercel — this is the build gate working as intended, not a bug. Set it and trigger a new deploy — see section 3. |
| Frontend loads but every API call 404s or targets `localhost` | Shouldn't happen anymore — `npm run build` now refuses to produce a bundle at all without a valid `VITE_API_URL`. If you see this, the deployed bundle predates this build gate; trigger a fresh Vercel build. |
| Everything worked yesterday, uploaded images are gone today | Render's ephemeral filesystem was wiped on redeploy/restart — see [Uploads Storage](#8-important-limitation--uploads-storage) above. Re-upload the affected images. |
| `GET /api/health` returns `503` | The database is unreachable — check `DATABASE_URL` and Neon's own status/dashboard. |
| A request that used to work now returns `429` | Rate limiting (`backend/src/middleware/rateLimit.js`) — expected under real abuse or aggressive automated testing against a live URL; wait for the window to reset (15 minutes) or confirm it isn't a false positive from testing tooling sharing one IP (e.g. everyone on an office NAT). Note the counter is per backend process (default in-memory store, no Redis) — it resets on every restart/redeploy, and would not be shared across replicas if this were ever scaled beyond one instance. |

---

## How to Verify CI Before Deploying

1. Push your branch (or open a PR) — GitHub Actions runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml) automatically.
2. Confirm both jobs are green: **Backend (unit + integration)** and **Frontend (tests + build)**.
3. If either fails, open the failed step's log in the Actions tab — it's the same commands you can run locally (`npm test`, `npm run test:coverage`, `npm run build`), so it should reproduce locally too.
4. Only deploy a commit whose CI run is green. CI does not deploy anything itself — deployment is always the separate, manual Render/Vercel steps above.

---

## Notes

- This is a **private test deployment**, not a hardened production launch, but CORS is now restricted to explicitly configured origins (not permissive `cors()`) — see [CORS configuration](#cors-configuration) above.
- No code, frontend, backend, or package files are touched by *this guide itself* — it is documentation only. (Task Q1, which this guide now reflects, did make real backend/frontend changes — see its own final report for the exact file list.)
