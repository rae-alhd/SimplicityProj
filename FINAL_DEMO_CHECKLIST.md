# Simplicity — Final Graduation Demo Checklist

## 0. Pre-Demo Setup

### Migrations (run all, in order, against the exact DB the demo will use)

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

If this is a fresh clone/DB, verify `backend/.env`'s `DATABASE_URL` points at the right database before running these.

### Start the servers

- [ ] Backend: `cd backend` → `npm install` (only if needed) → `npm run dev` — confirm "PostgreSQL connected" and it's listening on port **5000**.
- [ ] Frontend: `cd frontend` → `npm install` (only if needed) → `npm run dev` — confirm the Vite URL in the terminal (usually **http://localhost:5173**).

### URLs to have ready

- Public: `/`, `/products`, `/men`, `/women`, `/customize`, `/cart`, `/checkout`, `/login`
- Admin: `/dashboard`, `/admin/products`, `/admin/orders`, `/admin/customization`, `/admin/homepage`

---

## 1. Admin Navigation

- [ ] From `/dashboard`, click each AdminNav link (Dashboard/Products/Orders/Customization/Homepage/Storefront) — confirm it loads the right page and highlights as active.
- [ ] Confirm the same nav bar looks identical across all five admin pages.

## 2. Admin Logout

- [ ] From a non-Dashboard admin page (e.g. `/admin/products`), click Logout — confirm a full reload to `/login` and that the top Navbar no longer shows admin links or its own Logout button.
- [ ] Try navigating directly back to `/admin/products` — should redirect to `/login`.

## 3. Admin Products

- [ ] Create a product (name/category/target/price/description/stock/customizable/active) — confirm it appears and the Edit panel auto-opens.
- [ ] Edit fields, Save Changes — confirm persistence.
- [ ] Search by name/category/target — list narrows.
- [ ] Click each filter chip (Active/Inactive/Customizable/Ready-to-wear/In Stock/Out of Stock) — correct subset shows.
- [ ] Delete a test product — removed from list.

## 4. Product Colors / Images

- [ ] Add a color (name + hex) — appears with swatch.
- [ ] Edit a color's name/hex — updates.
- [ ] Deactivate a color — shows Inactive, disappears from the image-upload color dropdown.
- [ ] Reactivate — reappears.
- [ ] Delete an inactive color (Delete only shows when inactive) — permanently removed.
- [ ] Upload a general image (no color selected) — tagged "General image".
- [ ] Upload a color-specific image — tagged with that color's name.
- [ ] Set an image as Main — badge moves correctly.
- [ ] Deactivate the Main image — another active image becomes Main automatically.

## 5. Low Stock Threshold

- [ ] Confirm "Low stock alert at" shows the saved value (default 5).
- [ ] Change it (e.g. to 2), Save — badges recompute (1–2 = amber "Low stock", 3–5 now "Stock: X").
- [ ] Reload — new threshold persisted.

## 6. Dashboard — Inventory Alerts

- [ ] Out of Stock / Low Stock counts and threshold match `/admin/products`.
- [ ] Attention list (up to 5) matches actual low/out-of-stock products.
- [ ] "Manage Products" button → navigates to `/admin/products`.
- [ ] Stats and Profit/Earnings sections still show correct numbers.

## 7. Product Details — Color/Gallery

- [ ] On a multi-color product, clicking a swatch switches the gallery to that color's images (falls back to general images if none).
- [ ] Thumbnail row works when multiple images exist.
- [ ] "In Stock"/"Out of Stock" label is correct.
- [ ] On an out-of-stock product, Add to Cart and Customize are disabled and show "Out of Stock".

## 8. Customize Page

- [ ] Product picker shows all customizable products with images.
- [ ] An out-of-stock customizable product shows "Out of Stock" and can't be selected/added.
- [ ] Pick product → color/size/design/placement → custom text/note → Add to Cart succeeds.

## 9. Cart — Stock Guard

- [ ] Cart item shows "Available stock: X".
- [ ] `+` disables at the stock limit ("Max stock reached"); forcing it past shows an alert.
- [ ] `−` and Remove still work normally.

## 10. Checkout — Stock Deduction

- [ ] Note a product's stock, checkout with it in cart — order succeeds, cart clears, stock decreases by the ordered quantity (verify in `/admin/products`).
- [ ] Try ordering more than available stock — checkout is blocked with a clear "Only X available" error.

## 11. Admin Orders

- [ ] Product thumbnails show per line item.
- [ ] Customization/design details (placement, text, note, design image, collection) show for customized items.
- [ ] Search (order id/`#id`, customer name, email, phone, product name) narrows correctly.
- [ ] Status chips filter correctly and combine with search.

## 12. Admin Notes

- [ ] Type a note, Save Note — shows "Saving..." briefly.
- [ ] Refresh — note persisted.
- [ ] Customer's own checkout Notes (if present) is untouched and visually distinct from Admin Notes.

## 13. Status Timeline

- [ ] Order with no changes shows only "Order placed — Pending" + "No status changes yet."
- [ ] Change status — new "Old → New" row with timestamp appears after refresh.
- [ ] Re-select the same status — no duplicate row added.

## 14. Cancel Order — Stock Restore

- [ ] Change a non-cancelled order to Cancelled — confirm the browser confirmation dialog appears.
- [ ] Confirm — stock increases by the ordered quantities (check `/admin/products`), badge shows "Stock restored" (green).
- [ ] Change away from cancelled and back to cancelled again — stock does **not** restore a second time.

## 15. Admin Homepage Settings

- [ ] Edit hero title/highlight/subtitle/buttons/announcement, Save — succeeds.
- [ ] Upload a new hero image — updates.
- [ ] Edit/upload Men/Women/Custom Studio card images — each saves independently.

## 16. Storefront / Homepage Preview

- [ ] Open `/` — hero, buttons, announcement, and category cards match what was just set in Admin Homepage.
- [ ] Click Men/Women/Custom Studio cards — navigate correctly.
- [ ] Browse `/products`, `/men`, `/women` — images, Out of Stock badges, and Customize buttons (only on customizable, in-stock products) render correctly.

---

## What to Say — Owner/Admin Feature Talking Points

- *"This is the admin dashboard — the owner logs in once and gets stats, profit tracking, and automatic low/out-of-stock inventory alerts."*
- *"Every admin page shares this navigation bar, so switching between Products, Orders, Customization, and Homepage content is one click."*
- *"Product management has full CRUD, per-color image galleries so customers see the right photo for the color they pick, and a configurable low-stock threshold the owner can tune."*
- *"The stock system is guarded end-to-end: customers can't add out-of-stock items or exceed available stock in their cart, checkout re-validates and deducts stock atomically, and cancelling an order restores that stock exactly once — never double-counted."*
- *"Order management gives full visibility — who ordered what, with thumbnails and full customization detail — plus an internal Admin Notes field customers never see, and a status timeline so every change is tracked with a timestamp."*
- *"Homepage content — hero, buttons, announcement bar, category cards — is fully editable from the admin panel with zero code changes, and updates reflect live on the public storefront."*
