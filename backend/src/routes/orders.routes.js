const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  groupImagesByProduct,
  resolveMainImageUrl,
} = require("../utils/productImages");
const { resolveInventoryVariant } = require("../utils/inventory");

/* ─────────────────────────────────────────────
   HELPER: admin-only guard
   Add this here since you may not have a
   dedicated adminMiddleware yet.
   If you already have one, replace this with:
     const adminMiddleware = require("../middleware/admin.middleware");
───────────────────────────────────────────── */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

/* ─────────────────────────────────────────────
   Task H2: checkout-time design/color/size revalidation.
   Configuration can change between Add to Cart (Task H1) and checkout,
   so H1's earlier validation is never trusted alone here — every
   design-linked Cart row is re-verified fresh, inside the checkout
   transaction, immediately before the order is created.
   Returns { ok: true, snapshot } or { ok: false, error }.
───────────────────────────────────────────── */
async function validateAndSnapshotDesignVariant(client, cartItem) {
  // Legacy rows: design_id present but no design_variant_id at all (added
  // to Cart before Task H1 existed). The exact color/size compatibility
  // originally selected can't be reconstructed unambiguously, so these are
  // blocked with a clear message rather than guessed at — the Cart row
  // itself is left untouched so the customer can reselect the design.
  if (!cartItem.design_variant_id) {
    return {
      ok: false,
      error:
        "One of your customized items needs to be selected again because its design configuration has changed.",
    };
  }

  const variantResult = await client.query(
    `
    SELECT
      cdv.id AS variant_id,
      cdv.design_id AS variant_design_id,
      cdv.color_id AS variant_color_id,
      cdv.is_active AS variant_is_active,
      cd.name AS design_name,
      cd.is_active AS design_is_active,
      dc.is_active AS collection_is_active,
      dc.product_id AS collection_product_id,
      col.color_name AS variant_color_name,
      col.is_active AS variant_color_is_active,
      col.product_id AS variant_color_product_id
    FROM collection_design_variants cdv
    JOIN collection_designs cd ON cd.id = cdv.design_id
    JOIN design_collections dc ON dc.id = cd.collection_id
    JOIN customizable_product_colors col ON col.id = cdv.color_id
    WHERE cdv.id = $1
    `,
    [cartItem.design_variant_id]
  );

  if (variantResult.rows.length === 0) {
    return { ok: false, error: "This design is no longer available." };
  }

  const variant = variantResult.rows[0];

  if (Number(variant.variant_design_id) !== Number(cartItem.design_id)) {
    return {
      ok: false,
      error: "This design is no longer available for this product.",
    };
  }

  if (
    !variant.collection_is_active ||
    !variant.design_is_active ||
    Number(variant.collection_product_id) !== Number(cartItem.product_id)
  ) {
    return {
      ok: false,
      error: "This design is no longer available for this product.",
    };
  }

  if (
    !variant.variant_is_active ||
    !variant.variant_color_is_active ||
    Number(variant.variant_color_product_id) !== Number(cartItem.product_id)
  ) {
    return {
      ok: false,
      error: "This design is no longer available in the selected color.",
    };
  }

  // Re-verify the Cart's stored canonical color still matches the
  // variant's own color — Task H1 already enforces this at Add-to-Cart
  // time, but nothing between then and checkout is trusted alone here.
  if (cartItem.color !== variant.variant_color_name) {
    return {
      ok: false,
      error: "This design is no longer available in the selected color.",
    };
  }

  // Product must still exist and be active.
  const productResult = await client.query(
    "SELECT id, is_active FROM products WHERE id = $1",
    [cartItem.product_id]
  );

  if (productResult.rows.length === 0 || !productResult.rows[0].is_active) {
    return { ok: false, error: "This product is no longer available." };
  }

  const previewsResult = await client.query(
    `
    SELECT image_url
    FROM collection_design_preview_images
    WHERE variant_id = $1 AND is_active = true
    ORDER BY is_main DESC, sort_order ASC, id ASC
    `,
    [cartItem.design_variant_id]
  );

  if (previewsResult.rows.length === 0) {
    return {
      ok: false,
      error: "A preview for this design is no longer available.",
    };
  }

  // Size: sized product requires an active size that's still allowed by
  // this variant's own restrictions (if any); sizeless product accepts
  // null/empty without inventing a fake Standard size.
  const productSizesResult = await client.query(
    "SELECT id, size_label FROM customizable_product_sizes WHERE product_id = $1 AND is_active = true",
    [cartItem.product_id]
  );
  const hasSizes = productSizesResult.rows.length > 0;

  if (hasSizes) {
    const submittedSizeLabel =
      typeof cartItem.size === "string" ? cartItem.size.trim().toLowerCase() : "";

    if (!submittedSizeLabel) {
      return {
        ok: false,
        error: "This design is no longer available in the selected size.",
      };
    }

    const matchedSize = productSizesResult.rows.find(
      (s) => s.size_label.trim().toLowerCase() === submittedSizeLabel
    );

    if (!matchedSize) {
      return {
        ok: false,
        error: "This design is no longer available in the selected size.",
      };
    }

    const restrictionsResult = await client.query(
      "SELECT size_id FROM collection_design_variant_sizes WHERE variant_id = $1",
      [cartItem.design_variant_id]
    );

    if (restrictionsResult.rows.length > 0) {
      const allowedSizeIds = restrictionsResult.rows.map((r) => r.size_id);

      if (!allowedSizeIds.includes(matchedSize.id)) {
        return {
          ok: false,
          error: "This design is no longer available in the selected size.",
        };
      }
    }
  }

  return {
    ok: true,
    snapshot: {
      design_variant_id: variant.variant_id,
      design_color_id: variant.variant_color_id,
      design_preview_image_url: previewsResult.rows[0].image_url,
    },
  };
}

/* ─────────────────────────────────────────────
   Attaches additive, crash-safe design display fields to a list of
   order_items rows — used by both GET /my and GET / (admin) below, so the
   logic lives here once instead of twice.

   Fallback order for design_preview_image_url, per spec:
     1. design_preview_image_url_snapshot (new orders, Task H2)
     2. design_image_url (older orders' generic design-cover snapshot)
     3. current product-color gallery image (legacy orders predating both
        snapshot columns — resolveMainImageUrl's own fallback chain also
        covers tier 4, the general product image, and tier 5, null)
   design_name / design_color_name reuse the existing design_label / color
   snapshot columns rather than duplicating them under new names — both
   are already permanent, immutable snapshots captured at order time.
───────────────────────────────────────────── */
async function attachOrderItemDesignFields(items) {
  const productIds = [
    ...new Set(items.map((item) => item.product_id).filter(Boolean)),
  ];

  const [productsResult, imagesResult, colorsResult] = await Promise.all([
    pool.query("SELECT id, image_url FROM products WHERE id = ANY($1::int[])", [
      productIds,
    ]),
    pool.query(
      `
      SELECT id, product_id, image_url, sort_order, is_main, color_id
      FROM product_images
      WHERE is_active = true AND product_id = ANY($1::int[])
      ORDER BY product_id ASC, sort_order ASC, id ASC
      `,
      [productIds]
    ),
    pool.query(
      `
      SELECT id, product_id, color_name
      FROM customizable_product_colors
      WHERE product_id = ANY($1::int[])
      `,
      [productIds]
    ),
  ]);

  const productImageUrlById = new Map(
    productsResult.rows.map((p) => [p.id, p.image_url])
  );
  const imagesByProduct = groupImagesByProduct(imagesResult.rows);
  const colorIdByProductAndName = new Map(
    colorsResult.rows.map((row) => [
      `${row.product_id}::${row.color_name}`,
      row.id,
    ])
  );

  return items.map((item) => {
    const isDesignLinked = Boolean(item.design_label);

    if (!isDesignLinked) {
      return {
        ...item,
        design_name: null,
        design_color_name: null,
        design_preview_image_url: null,
      };
    }

    let designPreviewImageUrl =
      item.design_preview_image_url_snapshot || item.design_image_url || null;

    if (!designPreviewImageUrl) {
      const productImages = imagesByProduct.get(item.product_id) || [];
      const matchedColorId = item.color
        ? colorIdByProductAndName.get(`${item.product_id}::${item.color}`)
        : undefined;
      const colorImages =
        matchedColorId !== undefined
          ? productImages.filter(
              (img) => Number(img.color_id) === Number(matchedColorId)
            )
          : [];
      const relevantImages = colorImages.length > 0 ? colorImages : productImages;

      designPreviewImageUrl = resolveMainImageUrl(
        relevantImages,
        productImageUrlById.get(item.product_id) || null
      );
    }

    return {
      ...item,
      design_name: item.design_label,
      design_color_name: item.color,
      design_preview_image_url: designPreviewImageUrl,
    };
  });
}

/* ─────────────────────────────────────────────
   POST /api/orders
   Create a new order from the user's cart.
   Body: { customer_name, phone, address, notes }
───────────────────────────────────────────── */
router.post("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { customer_name, phone, address, notes, is_gift } = req.body;

  if (!customer_name || !address) {
    return res
      .status(400)
      .json({ error: "customer_name and address are required." });
  }

  // Task J1: whole-order gift flag. Omitted or false both mean false; only
  // a strict JSON boolean true is accepted as true — no truthy-string
  // coercion ("yes"/"1"/"true"), since no such convention exists elsewhere
  // in this codebase. Anything else is a clear 400, not a silent guess.
  if (is_gift !== undefined && typeof is_gift !== "boolean") {
    return res.status(400).json({ error: "is_gift must be a boolean." });
  }
  const isGift = is_gift === true;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Fetch user's cart items joined with product prices and customization details
const cartResult = await client.query(
  `
  SELECT
    ci.product_id,
    ci.size,
    ci.color,
    ci.quantity,

    ci.is_customized,
    ci.customization_option_id,
    ci.custom_text,
    ci.custom_note,
    ci.design_id,
    ci.design_variant_id,

    p.base_price,
    p.customization_extra_price,
    p.name AS product_name,
    p.is_active,
    p.inventory_mode,

    co.option_label AS customization_label,
    co.extra_price AS customization_option_extra_price,

    cd.name AS design_label,
    cd.image_url AS design_image_url,
    dc.name AS collection_name,

    (
      p.base_price
      + CASE
          WHEN ci.is_customized = true
          THEN COALESCE(p.customization_extra_price, 0) + COALESCE(co.extra_price, 0)
          ELSE 0
        END
    ) AS final_unit_price

  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  LEFT JOIN customization_options co ON ci.customization_option_id = co.id
  LEFT JOIN collection_designs cd ON ci.design_id = cd.id
  LEFT JOIN design_collections dc ON cd.collection_id = dc.id
  WHERE ci.user_id = $1
  `,
  [userId]
);

    const cartItems = cartResult.rows;

    if (cartItems.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Your cart is empty." });
    }

    // 1.4 Revalidate every design-linked Cart row fresh, right before the
    // order is created. Nothing about H1's earlier Add-to-Cart validation
    // is trusted here — the owner may have renamed, deactivated, or
    // reconfigured the design/color/size in the time since. On the first
    // invalid row, roll back immediately: no order and no order_items are
    // ever created, and the Cart itself is left untouched so the customer
    // can fix the affected item and try again.
    const designSnapshotByCartItemIndex = new Map();

    for (let i = 0; i < cartItems.length; i++) {
      const item = cartItems[i];

      if (!item.design_id) continue;

      const validation = await validateAndSnapshotDesignVariant(client, item);

      if (!validation.ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: validation.error });
      }

      designSnapshotByCartItemIndex.set(i, validation.snapshot);
    }

    // 1.45 Task K3: resolve + lock the exact product_inventory_variants row
    // for every cart item belonging to a VARIANT-mode product. Runs after
    // design revalidation so a design-linked item's color has already been
    // re-anchored to its variant's canonical color. Never trusts the Cart
    // row's stored color/size alone — always re-resolved fresh against
    // currently ACTIVE colors/sizes, exactly like the design revalidation
    // above. A missing row (incomplete matrix) is rejected here too — it
    // never silently falls back to General stock.
    const inventorySnapshotByCartItemIndex = new Map();
    const requestedQtyByVariantId = new Map();

    for (let i = 0; i < cartItems.length; i++) {
      const item = cartItems[i];

      if (item.inventory_mode !== "VARIANT") continue;

      const resolution = await resolveInventoryVariant(
        client,
        item.product_id,
        item.color,
        item.size
      );

      if (!resolution.ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "This color and size combination is out of stock.",
        });
      }

      inventorySnapshotByCartItemIndex.set(i, {
        inventory_mode: "VARIANT",
        inventory_variant_id: resolution.variant.id,
      });

      requestedQtyByVariantId.set(
        resolution.variant.id,
        (requestedQtyByVariantId.get(resolution.variant.id) || 0) +
          Number(item.quantity || 0)
      );
    }

    // Lock every distinct variant row FOR UPDATE and re-check its freshest
    // stock_quantity — the earlier resolve above is not trusted alone,
    // same reasoning as the General stock lock below.
    for (const [variantId, requestedQuantity] of requestedQtyByVariantId.entries()) {
      const lockResult = await client.query(
        "SELECT stock_quantity FROM product_inventory_variants WHERE id = $1 FOR UPDATE",
        [variantId]
      );

      if (lockResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "This color and size combination is out of stock.",
        });
      }

      const availableStock = Number(lockResult.rows[0].stock_quantity || 0);

      if (availableStock <= 0 || requestedQuantity > availableStock) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Only the available quantity can be added.",
        });
      }
    }

    // 1.5 Aggregate cart quantity per product for GENERAL-mode items only —
    // VARIANT items were already resolved to their own independent stock
    // pools above and must never be folded into this whole-product total.
    const quantityByProduct = new Map();
    for (const item of cartItems) {
      if (item.inventory_mode === "VARIANT") continue;

      const current = quantityByProduct.get(item.product_id) || 0;
      quantityByProduct.set(
        item.product_id,
        current + Number(item.quantity || 0)
      );
    }

    // 1.6 Check stock for every product before creating the order, locking
    // each product row so concurrent checkouts can't oversell the same stock.
    for (const [productId, requestedQuantity] of quantityByProduct.entries()) {
      const stockResult = await client.query(
        "SELECT name, stock_quantity FROM products WHERE id = $1 FOR UPDATE",
        [productId]
      );

      if (stockResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Product not found." });
      }

      const { name, stock_quantity } = stockResult.rows[0];
      const availableStock = Number(stock_quantity || 0);

      if (availableStock <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `${name} is out of stock.` });
      }

      if (requestedQuantity > availableStock) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Only ${availableStock} item(s) available for ${name}.`,
        });
      }
    }

    // 2. Calculate total
    const totalPrice = cartItems.reduce((sum, item) => {
      return sum + parseFloat(item.final_unit_price) * item.quantity;
    }, 0);

    // 3. Create the order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, customer_name, phone, address, notes, total_price, status, is_gift)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [
        userId,
        customer_name,
        phone || null,
        address,
        notes || null,
        totalPrice.toFixed(2),
        isGift,
      ]
    );

    const order = orderResult.rows[0];

   // 4. Copy cart items into order_items (snapshot name + price + customization
   // details). Design-linked rows additionally carry the fresh snapshot
   // computed during revalidation above — never the raw Cart/client values.
for (let i = 0; i < cartItems.length; i++) {
  const item = cartItems[i];
  const designSnapshot = designSnapshotByCartItemIndex.get(i) || null;
  // Task K3: permanent record of which inventory mechanism controlled this
  // line at checkout — never re-derived from the product's current
  // inventory_mode later (which may have changed since), so cancellation
  // always reverses stock the same way it was deducted.
  const inventorySnapshot = inventorySnapshotByCartItemIndex.get(i) || {
    inventory_mode: "GENERAL",
    inventory_variant_id: null,
  };

  await client.query(
    `
    INSERT INTO order_items
    (
      order_id,
      product_id,
      product_name,
      size,
      color,
      quantity,
      unit_price,
      is_customized,
      customization_label,
      chosen_color,
      chosen_size,
      custom_text,
      custom_note,
      design_label,
      collection_name,
      design_image_url,
      design_variant_id,
      design_color_id_snapshot,
      design_preview_image_url_snapshot,
      inventory_mode_snapshot,
      inventory_variant_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    `,
    [
      order.id,
      item.product_id,
      item.product_name,
      item.size || null,
      item.color || null,
      item.quantity,
      parseFloat(item.final_unit_price).toFixed(2),

      item.is_customized || false,
      item.customization_label || null,
      item.color || null,
      item.size || null,
      item.custom_text || null,
      item.custom_note || null,
      item.design_label || null,
      item.collection_name || null,
      item.design_image_url || null,

      designSnapshot?.design_variant_id || null,
      designSnapshot?.design_color_id || null,
      designSnapshot?.design_preview_image_url || null,

      inventorySnapshot.inventory_mode,
      inventorySnapshot.inventory_variant_id,
    ]
  );
}

    // 4.5 Reduce stock now that the order and its items were created
    // successfully. GENERAL products deduct from products.stock_quantity as
    // before; VARIANT products deduct from their own resolved+locked
    // product_inventory_variants row instead — never both, never the wrong
    // one.
    for (const [productId, requestedQuantity] of quantityByProduct.entries()) {
      await client.query(
        "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2",
        [requestedQuantity, productId]
      );
    }

    for (const [variantId, requestedQuantity] of requestedQtyByVariantId.entries()) {
      await client.query(
        "UPDATE product_inventory_variants SET stock_quantity = stock_quantity - $1, updated_at = now() WHERE id = $2",
        [requestedQuantity, variantId]
      );
    }

    // 5. Clear the user's cart
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Order placed successfully.",
      order,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Order creation error:", err);
    res.status(500).json({ error: "Failed to create order." });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   GET /api/orders/my
   Logged-in user's own orders with their items.
───────────────────────────────────────────── */
router.get("/my", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch orders
    const ordersResult = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return res.json([]);
    }

    // Fetch all items for these orders in one query
    const orderIds = orders.map((o) => o.id);
    const itemsResult = await pool.query(
      `SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC`,
      [orderIds]
    );

    const itemsWithDesignFields = await attachOrderItemDesignFields(
      itemsResult.rows
    );

    // Group items by order_id
    const itemsByOrder = {};
    for (const item of itemsWithDesignFields) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    // Attach items to each order
    const ordersWithItems = orders.map((order) => ({
      ...order,
      items: itemsByOrder[order.id] || [],
    }));

    res.json(ordersWithItems);
  } catch (err) {
    console.error("Fetch my orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

/* ─────────────────────────────────────────────
   GET /api/orders
   Admin only — all orders with items.
───────────────────────────────────────────── */
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT o.*, u.email AS user_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    );

    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map((o) => o.id);
    const itemsResult = await pool.query(
      `SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC`,
      [orderIds]
    );

    const itemsWithDesignFields = await attachOrderItemDesignFields(
      itemsResult.rows
    );

    const itemsByOrder = {};
    for (const item of itemsWithDesignFields) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    const historyResult = await pool.query(
      `SELECT * FROM order_status_history WHERE order_id = ANY($1::int[]) ORDER BY created_at ASC`,
      [orderIds]
    );

    const historyByOrder = {};
    for (const entry of historyResult.rows) {
      if (!historyByOrder[entry.order_id]) historyByOrder[entry.order_id] = [];
      historyByOrder[entry.order_id].push(entry);
    }

    const ordersWithItems = orders.map((order) => ({
      ...order,
      items: itemsByOrder[order.id] || [],
      status_history: historyByOrder[order.id] || [],
    }));

    res.json(ordersWithItems);
  } catch (err) {
    console.error("Admin fetch orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/orders/:id/status
   Admin only — update order status.
   Body: { status: "pending"|"confirmed"|"delivered"|"cancelled" }
───────────────────────────────────────────── */
// Thrown when a cancellation needs to restock an item whose GENERAL product
// or VARIANT inventory row no longer exists. Caught below to roll back the
// whole transaction and return a controlled 400 instead of a generic 500 —
// distinct from any other unexpected error.
class MissingInventoryForCancellationError extends Error {}

router.patch("/:id/status", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;

  const validStatuses = ["pending", "confirmed", "delivered", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the order row so a concurrent status change can't race the
    // stock_restored check below.
    const orderResult = await client.query(
      `SELECT id, status, stock_restored FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found." });
    }

    const currentOrder = orderResult.rows[0];

    // Restock only on the transition into cancelled, and only once ever
    // for this order — reverting to another status and cancelling again
    // must not restore stock a second time. orders.stock_restored is the
    // single whole-order guard for this, unchanged by Task K3.
    const needsRestock = status === "cancelled" && !currentOrder.stock_restored;

    const quantityByProduct = new Map();
    const quantityByVariantId = new Map();

    if (needsRestock) {
      // ── VALIDATE + LOCK EVERY STOCK SOURCE FIRST — no write happens
      // until every item this cancellation needs to restock has been
      // confirmed to exist and locked. Legacy order_items (placed before
      // inventory_mode_snapshot existed) have it NULL — treated identically
      // to 'GENERAL' so every pre-existing order restocks exactly as it
      // always has.
      const itemsResult = await client.query(
        `SELECT product_id, quantity, inventory_mode_snapshot, inventory_variant_id
         FROM order_items WHERE order_id = $1`,
        [orderId]
      );

      for (const item of itemsResult.rows) {
        if (item.inventory_mode_snapshot === "VARIANT") {
          if (item.inventory_variant_id === null) {
            // The exact variant row this order deducted from was deleted
            // since checkout — never restore to products.stock_quantity or
            // to a different variant, never skip it either. Abort the
            // whole cancellation instead.
            throw new MissingInventoryForCancellationError();
          }

          quantityByVariantId.set(
            item.inventory_variant_id,
            (quantityByVariantId.get(item.inventory_variant_id) || 0) +
              Number(item.quantity || 0)
          );
        } else {
          quantityByProduct.set(
            item.product_id,
            (quantityByProduct.get(item.product_id) || 0) +
              Number(item.quantity || 0)
          );
        }
      }

      for (const productId of quantityByProduct.keys()) {
        const productCheck = await client.query(
          "SELECT id FROM products WHERE id = $1 FOR UPDATE",
          [productId]
        );
        if (productCheck.rows.length === 0) {
          throw new MissingInventoryForCancellationError();
        }
      }

      for (const variantId of quantityByVariantId.keys()) {
        const variantCheck = await client.query(
          "SELECT id FROM product_inventory_variants WHERE id = $1 FOR UPDATE",
          [variantId]
        );
        if (variantCheck.rows.length === 0) {
          throw new MissingInventoryForCancellationError();
        }
      }
    }

    // ── Every required stock source is confirmed to exist and locked (or
    // no restock is needed at all) — only now does anything get written.
    const updateResult = await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, orderId]
    );

    let order = updateResult.rows[0];

    // Log the transition for the admin-facing status timeline. Skip if the
    // status didn't actually change (e.g. re-selecting the same value).
    if (currentOrder.status !== status) {
      await client.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status)
         VALUES ($1, $2, $3)`,
        [orderId, currentOrder.status, status]
      );
    }

    if (needsRestock) {
      for (const [productId, restoredQuantity] of quantityByProduct.entries()) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
          [restoredQuantity, productId]
        );
      }

      for (const [variantId, restoredQuantity] of quantityByVariantId.entries()) {
        await client.query(
          `UPDATE product_inventory_variants SET stock_quantity = stock_quantity + $1, updated_at = now() WHERE id = $2`,
          [restoredQuantity, variantId]
        );
      }

      const flagResult = await client.query(
        `UPDATE orders SET stock_restored = true WHERE id = $1 RETURNING *`,
        [orderId]
      );
      order = flagResult.rows[0];
    }

    await client.query("COMMIT");

    res.json({ message: "Order status updated.", order });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err instanceof MissingInventoryForCancellationError) {
      console.error(
        `Order ${orderId}: cancellation aborted — one of its inventory records no longer exists. No stock or order status was changed.`
      );
      return res.status(400).json({
        error:
          "This order cannot be cancelled automatically because one of its inventory records no longer exists. No stock or order status was changed.",
      });
    }

    console.error("Update order status error:", err);
    res.status(500).json({ error: "Failed to update order status." });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/orders/:id/admin-notes
   Admin only — save internal notes for an order. Separate from the
   customer's own checkout `notes` field; never touches order status
   or stock.
   Body: { admin_notes: "text" }
───────────────────────────────────────────── */
router.patch("/:id/admin-notes", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { admin_notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders SET admin_notes = $1 WHERE id = $2 RETURNING *`,
      [admin_notes ?? null, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json({ message: "Admin notes updated", order: result.rows[0] });
  } catch (err) {
    console.error("Update admin notes error:", err);
    res.status(500).json({ error: "Failed to update admin notes." });
  }
});

module.exports = router;