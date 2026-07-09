# Simplicity — Deployment Guide (Private Owner/Admin Test Version)

This guide covers deploying Simplicity as a **private test version** for the owner/admin to try live — not a full production launch.

- **Database:** Neon PostgreSQL
- **Backend:** Render
- **Frontend:** Vercel

---

## 1. Pre-Deployment Checklist

- [ ] `git status` is clean — no uncommitted changes you meant to include are missing, nothing unexpected is staged.
- [ ] `cd frontend && npm run build` completes with no errors.
- [ ] `cd backend && npm start` runs locally without crashing and connects to the database.
- [ ] Migrations `001` through `011` are present in `backend/migrations/` and you know their order:
  ```
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
  ```

---

## 2. Required Environment Variables — Render (Backend)

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string (see step 4) |
| `JWT_SECRET` | A long random secret used to sign login tokens |
| `NODE_ENV` | `production` |
| `BACKEND_PUBLIC_URL` | The Render backend's public URL |

**`BACKEND_PUBLIC_URL`** should be the URL Render gives your backend service, for example:
```
https://your-backend-name.onrender.com
```
This is used when the backend builds absolute URLs for uploaded images (product photos, homepage hero/card images, design images). If it's missing, the backend falls back to detecting the URL from the incoming request — but setting it explicitly is the safest, most predictable option.

---

## 3. Required Environment Variables — Vercel (Frontend)

| Variable | Value |
|---|---|
| `VITE_API_URL` | The Render backend's API base URL, **including `/api`** |

Example:
```
https://your-backend-name.onrender.com/api
```

The frontend reads this via `import.meta.env.VITE_API_URL` and falls back to `http://localhost:5000/api` if it's not set — so local development is unaffected either way.

---

## 4. Neon (Database) Steps

1. Create a new Neon project and a database inside it.
2. Copy the connection string Neon gives you — this is your `DATABASE_URL`. Make sure it requires SSL (Neon connection strings do by default).
3. Run migrations `001` through `011`, in order, against this new Neon database before the backend is used for the first time. The database starts empty — nothing will work until this is done.

---

## 5. Render (Backend) Steps

1. Connect your GitHub repo to Render and create a new **Web Service**.
2. **Root directory:** `backend`
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. Add the environment variables from section 2 (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`) — you can leave `BACKEND_PUBLIC_URL` for the next step, since you don't know the URL yet.
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

Uploaded files (product images, homepage images, design images) are stored on **Render's local filesystem** under `backend/uploads/`. On most Render plans this storage is **ephemeral** — it can be wiped on redeploy or restart.

- **For this private test deployment, this is acceptable.** If it happens, the owner may just need to re-upload a few images.
- **For real production later**, uploads should move to persistent/cloud storage (e.g. Cloudinary, AWS S3, or a Render persistent disk) so files survive redeploys reliably.

---

## Notes

- This is a **private test deployment**, not a hardened production launch — CORS is currently permissive (`cors()` with no restricted origin list), which is fine for this stage but worth tightening to the exact Vercel domain if this ever becomes a real launch.
- No code, frontend, backend, or package files are touched by this guide — it is documentation only.
