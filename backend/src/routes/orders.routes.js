const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  groupImagesByProduct,
  resolveMainImageUrl,
} = require("../utils/productImages");
const { resolveInventoryVariant } = require("../utils/inventory");
const {
  STATUS_LABELS,
  VALID_STATUSES,
  validateTransition,
} = require("../utils/orderStatus");
const {
  PAYMENT_STATUS_LABELS,
  VALID_PAYMENT_STATUSES,
  PAYMENT_METHOD_LABELS,
  VALID_PAYMENT_METHODS,
  validatePaymentTransition,
} = require("../utils/paymentStatus");
const {
  SHIPPING_METHOD_LABELS,
  VALID_SHIPPING_METHODS,
  isSafeTrackingUrl,
  validateFulfillmentInput,
  validateReadyToShippedRequirements,
} = require("../utils/fulfillment");

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
  const { customer_name, phone, address, notes, is_gift, payment_method } = req.body;

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

  // Task N1 correction: Checkout.jsx has no real payment-method selector —
  // accepting an explicit payment_method here would let a manipulated
  // browser request claim a method the customer never actually chose.
  // Every checkout payment is unconditionally PENDING/MANUAL until a real
  // selector exists; the owner can still set CASH_ON_DELIVERY/BANK_TRANSFER
  // afterward via PATCH /orders/:id/payment. Rejected before the
  // transaction opens, so nothing (order/payment/stock/cart) is touched.
  if (payment_method !== undefined) {
    return res.status(400).json({
      error: "Payment method selection is not available at checkout.",
    });
  }

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
    p.sizing_mode,
    p.standard_size_label,

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

    // 1.42 Task L1: revalidate sizing mode fresh, right before the order is
    // created — mirrors the design-variant revalidation above. Nothing
    // about Cart's own POST-time validation is trusted alone here: the
    // owner may have switched the product's sizing mode, changed the
    // standard label, or deactivated a size in the time since Add to Cart.
    const standardSizeLabelSnapshotByCartItemIndex = new Map();

    for (let i = 0; i < cartItems.length; i++) {
      const item = cartItems[i];

      if (item.sizing_mode === "STANDARD") {
        if (item.size !== null && item.size !== undefined) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error:
              "One of your items needs to be selected again because its size configuration has changed.",
          });
        }

        // Permanent snapshot of the label the customer actually saw —
        // never re-derived from the live products.standard_size_label
        // later, so a subsequent rename never changes this order.
        standardSizeLabelSnapshotByCartItemIndex.set(i, item.standard_size_label);
        continue;
      }

      // MULTI_SIZE. Design-linked items already got equivalent (and
      // variant-restriction-aware) size revalidation via
      // validateAndSnapshotDesignVariant above — only a plain, non-design
      // item needs this generic active-size check.
      if (!item.design_id) {
        const activeSizesResult = await client.query(
          "SELECT size_label FROM customizable_product_sizes WHERE product_id = $1 AND is_active = true",
          [item.product_id]
        );
        const activeSizes = activeSizesResult.rows;

        if (activeSizes.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error:
              "One of your items is no longer available in any size. Please remove it from your cart.",
          });
        }

        const submittedSizeLabel =
          typeof item.size === "string" ? item.size.trim().toLowerCase() : "";

        const matchedSize = activeSizes.find(
          (s) => s.size_label.trim().toLowerCase() === submittedSizeLabel
        );

        if (!matchedSize) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error:
              "One of your items needs to be selected again because its size is no longer available.",
          });
        }
      }
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

    // 3. Create the order. Task M1: new orders start at 'new', the first
    // stage of the production workflow (was 'pending').
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, customer_name, phone, address, notes, total_price, status, is_gift)
       VALUES ($1, $2, $3, $4, $5, $6, 'new', $7)
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

    // 3.5 Task N1: create this order's payment record inside the same
    // transaction. No real gateway or checkout selector exists — every new
    // order unconditionally starts PENDING/MANUAL (payment_method is
    // rejected above if the request tried to supply one at all). If this
    // insert throws for any reason, the catch block below rolls back
    // everything already done above — no order, no order_items, no stock
    // deduction, no cart clearing.
    await client.query(
      `INSERT INTO payments (order_id, status, payment_method) VALUES ($1, 'PENDING', 'MANUAL')`,
      [order.id]
    );

    // 3.6 Task O1: create this order's (empty) fulfillment record in the
    // same transaction — every order gets exactly one row, mirroring the
    // payments insert above, so the Ready -> Shipped transition later
    // always has a row to update. Nothing is set yet; the owner fills it
    // in when the order actually ships.
    await client.query(
      `INSERT INTO order_fulfillment (order_id) VALUES ($1)`,
      [order.id]
    );

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
  // Task L1: null for MULTI_SIZE lines, the permanent standard-label
  // snapshot for STANDARD lines.
  const standardSizeLabelSnapshot =
    standardSizeLabelSnapshotByCartItemIndex.get(i) ?? null;

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
      inventory_variant_id,
      standard_size_label_snapshot
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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

      standardSizeLabelSnapshot,
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
   Task M1: builds a customer-safe timeline from the real
   order_status_history rows, prefixed with the implicit "New" stage that
   begins at order creation (never has its own history row). Exposes only
   status/label/timestamp — no changed_by, no internal user IDs.
───────────────────────────────────────────── */
function buildCustomerTimeline(order, historyRows) {
  const timeline = [
    {
      status: "new",
      status_label: STATUS_LABELS.new,
      timestamp: order.created_at,
    },
  ];

  for (const entry of historyRows) {
    timeline.push({
      status: entry.new_status,
      status_label: STATUS_LABELS[entry.new_status] || entry.new_status,
      timestamp: entry.created_at,
    });
  }

  return timeline;
}

/* ─────────────────────────────────────────────
   Task N1: customer-safe payment timeline, mirroring buildCustomerTimeline
   above — an implicit initial "Pending Payment" entry at the payment's own
   created_at (no history row exists for that initial state, same reasoning
   as order status), followed by real payment_status_history transitions.
   Exposes only status/label/timestamp — no changed_by, no change_note.
───────────────────────────────────────────── */
function buildCustomerPaymentTimeline(paymentCreatedAt, historyRows) {
  const timeline = [
    {
      status: "PENDING",
      status_label: PAYMENT_STATUS_LABELS.PENDING,
      timestamp: paymentCreatedAt,
    },
  ];

  for (const entry of historyRows) {
    timeline.push({
      status: entry.new_status,
      status_label: PAYMENT_STATUS_LABELS[entry.new_status] || entry.new_status,
      timestamp: entry.created_at,
    });
  }

  return timeline;
}

/* ─────────────────────────────────────────────
   GET /api/orders/my
   Logged-in user's own orders with their items.
───────────────────────────────────────────── */
router.get("/my", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch orders, LEFT JOINed to their one payment record (Task N1) and
    // one fulfillment record (Task O1). LEFT JOIN is defensive — every
    // order should have exactly one row of each post-migration, but this
    // never 500s if one were ever missing.
    const ordersResult = await pool.query(
      `
      SELECT
        o.*,
        pay.id AS payment_id,
        pay.status AS payment_status,
        pay.payment_method AS payment_method,
        pay.transaction_reference AS transaction_reference,
        pay.paid_at AS paid_at,
        pay.refunded_at AS refunded_at,
        pay.created_at AS payment_created_at,
        ful.shipping_method AS shipping_method,
        ful.carrier_name AS carrier_name,
        ful.tracking_number AS tracking_number,
        ful.tracking_url AS tracking_url,
        ful.estimated_delivery_date AS estimated_delivery_date,
        ful.shipped_at AS shipped_at,
        ful.delivered_at AS delivered_at,
        ful.tracking_unavailable AS tracking_unavailable
      FROM orders o
      LEFT JOIN payments pay ON pay.order_id = o.id
      LEFT JOIN order_fulfillment ful ON ful.order_id = o.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      `,
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

    // Customer-safe timeline: status_history minus changed_by/internal IDs.
    const historyResult = await pool.query(
      `SELECT order_id, new_status, created_at
       FROM order_status_history WHERE order_id = ANY($1::int[]) ORDER BY created_at ASC`,
      [orderIds]
    );

    const historyByOrder = {};
    for (const entry of historyResult.rows) {
      if (!historyByOrder[entry.order_id]) historyByOrder[entry.order_id] = [];
      historyByOrder[entry.order_id].push(entry);
    }

    // Task N1: customer-safe payment history, keyed by order_id (payment_id
    // isn't exposed to customers, so there's no need to key by it instead).
    const paymentIds = orders.map((o) => o.payment_id).filter(Boolean);
    const paymentHistoryResult = paymentIds.length
      ? await pool.query(
          `SELECT order_id, new_status, created_at
           FROM payment_status_history WHERE payment_id = ANY($1::int[]) ORDER BY created_at ASC`,
          [paymentIds]
        )
      : { rows: [] };

    const paymentHistoryByOrder = {};
    for (const entry of paymentHistoryResult.rows) {
      if (!paymentHistoryByOrder[entry.order_id]) paymentHistoryByOrder[entry.order_id] = [];
      paymentHistoryByOrder[entry.order_id].push(entry);
    }

    // Attach items to each order. admin_notes (the legacy single-field
    // internal note column) is explicitly stripped here — customers must
    // never receive it, and `SELECT *` above would otherwise include it.
    // Same for payment_id/payment_created_at — internal-only, not part of
    // the customer-safe payment contract.
    const ordersWithItems = orders.map((order) => {
      const {
        admin_notes,
        payment_id,
        payment_created_at,
        payment_status,
        payment_method,
        transaction_reference,
        paid_at,
        refunded_at,
        shipping_method,
        carrier_name,
        tracking_number,
        tracking_url,
        estimated_delivery_date,
        shipped_at,
        delivered_at,
        tracking_unavailable,
        ...safeOrder
      } = order;

      // Safe reference is only ever shown once money has actually moved —
      // never while still Pending or after a Failed attempt.
      const safeTransactionReference =
        payment_status === "PAID" || payment_status === "REFUNDED"
          ? transaction_reference || null
          : null;

      // Task O1: shipping/carrier/tracking details are only ever shown once
      // the order has actually shipped — never before, even if the owner
      // pre-filled them early via PATCH /fulfillment while still Ready.
      const isShippedOrDelivered = order.status === "shipped" || order.status === "delivered";
      const safeTrackingUrl =
        isShippedOrDelivered && isSafeTrackingUrl(tracking_url) ? tracking_url : null;

      return {
        ...safeOrder,
        status_display_label: STATUS_LABELS[order.status] || order.status,
        status_timeline: buildCustomerTimeline(order, historyByOrder[order.id] || []),
        payment_status,
        payment_status_display_label: PAYMENT_STATUS_LABELS[payment_status] || payment_status,
        payment_method,
        payment_method_display_label: PAYMENT_METHOD_LABELS[payment_method] || payment_method,
        safe_transaction_reference: safeTransactionReference,
        paid_at,
        refunded_at,
        payment_timeline: buildCustomerPaymentTimeline(
          payment_created_at,
          paymentHistoryByOrder[order.id] || []
        ),
        shipping_method: isShippedOrDelivered ? shipping_method : null,
        shipping_method_display_label: isShippedOrDelivered
          ? SHIPPING_METHOD_LABELS[shipping_method] || shipping_method
          : null,
        carrier_name: isShippedOrDelivered ? carrier_name : null,
        tracking_number: isShippedOrDelivered ? tracking_number : null,
        safe_tracking_url: safeTrackingUrl,
        estimated_delivery_date: isShippedOrDelivered ? estimated_delivery_date : null,
        shipped_at,
        delivered_at,
        // Task O1 correction: a derived, customer-safe signal — never the
        // raw tracking_unavailable database field itself. Only ever
        // "UNAVAILABLE" for a Shipped/Delivered Courier order with a
        // confirmed-unavailable tracking number and none on file; null in
        // every other case, so the frontend shows "Tracking is not
        // available for this shipment." instead of implying it was simply
        // forgotten.
        tracking_status:
          isShippedOrDelivered &&
          shipping_method === "COURIER" &&
          tracking_unavailable === true &&
          !tracking_number
            ? "UNAVAILABLE"
            : null,
        items: itemsByOrder[order.id] || [],
      };
    });

    res.json(ordersWithItems);
  } catch (err) {
    console.error("Fetch my orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

/* ─────────────────────────────────────────────
   GET /api/orders
   Admin only — all orders with items. Task M1 adds optional filters, all
   applied server-side with parameterized SQL:
     ?status=in_production
     ?search=jane            (order number, customer name, or email)
     ?gift=true|false
     ?customized=true|false  (at least one order_item.is_customized)
     ?date_from=2026-01-01   (created_at >=, inclusive)
     ?date_to=2026-01-31     (created_at <, i.e. through end of that day)
   Task N1 adds:
     ?payment_status=PAID
     ?payment_method=BANK_TRANSFER
     ?refund_required=true|false   (order.status='cancelled' AND payment.status='PAID')
   Task O1 adds:
     ?fulfillment=ready_to_ship|in_transit|delivered
     ?shipping_method=COURIER
     ?tracking_missing=true|false
   Response shape is unchanged/additive: every existing field stays, plus
   status_display_label, contains_customized_items, item_count, and the full
   payment/fulfillment fields/history per order.
───────────────────────────────────────────── */
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  const {
    status, search, gift, customized, date_from, date_to,
    payment_status, payment_method, refund_required,
    fulfillment, shipping_method, tracking_missing,
  } = req.query;

  try {
    const conditions = [];
    const params = [];

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
        });
      }
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (gift === "true" || gift === "false") {
      params.push(gift === "true");
      conditions.push(`o.is_gift = $${params.length}`);
    }

    if (customized === "true") {
      conditions.push(
        `EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.is_customized = true)`
      );
    } else if (customized === "false") {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.is_customized = true)`
      );
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      params.push(term);
      const searchParamText = `$${params.length}`;
      params.push(term);
      const searchParamId = `$${params.length}`;
      conditions.push(
        `(o.customer_name ILIKE ${searchParamText} OR u.email ILIKE ${searchParamText} OR CAST(o.id AS TEXT) ILIKE ${searchParamId} OR LPAD(CAST(o.id AS TEXT), 5, '0') ILIKE ${searchParamId})`
      );
    }

    if (date_from) {
      params.push(date_from);
      conditions.push(`o.created_at >= $${params.length}::date`);
    }

    if (date_to) {
      params.push(date_to);
      conditions.push(`o.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (payment_status) {
      if (!VALID_PAYMENT_STATUSES.includes(payment_status)) {
        return res.status(400).json({
          error: `payment_status must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`,
        });
      }
      params.push(payment_status);
      conditions.push(`pay.status = $${params.length}`);
    }

    if (payment_method) {
      if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
        return res.status(400).json({
          error: `payment_method must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
        });
      }
      params.push(payment_method);
      conditions.push(`pay.payment_method = $${params.length}`);
    }

    if (refund_required === "true") {
      conditions.push(`(o.status = 'cancelled' AND pay.status = 'PAID')`);
    } else if (refund_required === "false") {
      conditions.push(`NOT (o.status = 'cancelled' AND pay.status = 'PAID')`);
    }

    if (fulfillment) {
      const FULFILLMENT_STATUS_MAP = {
        ready_to_ship: "ready",
        in_transit: "shipped",
        delivered: "delivered",
      };
      const mappedStatus = FULFILLMENT_STATUS_MAP[fulfillment];
      if (!mappedStatus) {
        return res.status(400).json({
          error: `fulfillment must be one of: ${Object.keys(FULFILLMENT_STATUS_MAP).join(", ")}`,
        });
      }
      params.push(mappedStatus);
      conditions.push(`o.status = $${params.length}`);
    }

    if (shipping_method) {
      if (!VALID_SHIPPING_METHODS.includes(shipping_method)) {
        return res.status(400).json({
          error: `shipping_method must be one of: ${VALID_SHIPPING_METHODS.join(", ")}`,
        });
      }
      params.push(shipping_method);
      conditions.push(`ful.shipping_method = $${params.length}`);
    }

    // A Courier shipment with an explicitly confirmed tracking_unavailable
    // is deliberately complete, not missing — COALESCE handles any legacy
    // row where the column could theoretically read NULL safely as false.
    if (tracking_missing === "true") {
      conditions.push(
        `(o.status = 'shipped' AND ful.shipping_method = 'COURIER' AND (ful.tracking_number IS NULL OR ful.tracking_number = '') AND COALESCE(ful.tracking_unavailable, false) = false)`
      );
    } else if (tracking_missing === "false") {
      conditions.push(
        `NOT (o.status = 'shipped' AND ful.shipping_method = 'COURIER' AND (ful.tracking_number IS NULL OR ful.tracking_number = '') AND COALESCE(ful.tracking_unavailable, false) = false)`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const ordersResult = await pool.query(
      `SELECT
         o.*,
         u.email AS user_email,
         pay.id AS payment_id,
         pay.status AS payment_status,
         pay.payment_method AS payment_method,
         pay.transaction_reference AS transaction_reference,
         pay.paid_at AS paid_at,
         pay.failed_at AS failed_at,
         pay.refunded_at AS refunded_at,
         pay.failure_reason AS failure_reason,
         pay.refund_reason AS refund_reason,
         pay.created_at AS payment_created_at,
         pay.updated_at AS payment_updated_at,
         ful.id AS fulfillment_id,
         ful.shipping_method AS shipping_method,
         ful.carrier_name AS carrier_name,
         ful.tracking_number AS tracking_number,
         ful.tracking_url AS tracking_url,
         ful.estimated_delivery_date AS estimated_delivery_date,
         ful.shipped_at AS shipped_at,
         ful.delivered_at AS delivered_at,
         ful.private_note AS fulfillment_private_note,
         ful.tracking_unavailable AS tracking_unavailable,
         ful.updated_at AS fulfillment_updated_at,
         fu.email AS fulfillment_updated_by_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN payments pay ON pay.order_id = o.id
       LEFT JOIN order_fulfillment ful ON ful.order_id = o.id
       LEFT JOIN users fu ON fu.id = ful.updated_by
       ${whereClause}
       ORDER BY o.created_at DESC`,
      params
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

    // changed_by resolved to an email for display — never a bare internal
    // user ID left for the admin UI to guess at.
    const historyResult = await pool.query(
      `SELECT h.*, u.email AS changed_by_email
       FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.order_id = ANY($1::int[]) ORDER BY h.created_at ASC`,
      [orderIds]
    );

    const historyByOrder = {};
    for (const entry of historyResult.rows) {
      if (!historyByOrder[entry.order_id]) historyByOrder[entry.order_id] = [];
      historyByOrder[entry.order_id].push(entry);
    }

    // Task N1: complete payment history (private change_note + author
    // included — admin-only route, safe to expose in full).
    const paymentIds = orders.map((o) => o.payment_id).filter(Boolean);
    const paymentHistoryResult = paymentIds.length
      ? await pool.query(
          `SELECT h.*, u.email AS changed_by_email
           FROM payment_status_history h
           LEFT JOIN users u ON u.id = h.changed_by
           WHERE h.order_id = ANY($1::int[]) ORDER BY h.created_at ASC`,
          [orderIds]
        )
      : { rows: [] };

    const paymentHistoryByOrder = {};
    for (const entry of paymentHistoryResult.rows) {
      if (!paymentHistoryByOrder[entry.order_id]) paymentHistoryByOrder[entry.order_id] = [];
      paymentHistoryByOrder[entry.order_id].push(entry);
    }

    const ordersWithItems = orders.map((order) => {
      const items = itemsByOrder[order.id] || [];
      const {
        payment_created_at,
        payment_updated_at,
        fulfillment_private_note,
        fulfillment_updated_at,
        fulfillment_updated_by_email,
        ...orderFields
      } = order;

      // Task O1 derived fields — never auto-transitioned, only surfaced. A
      // Courier shipment with an explicitly confirmed tracking_unavailable
      // is a deliberately complete state, not a missing/incomplete one.
      const trackingMissing =
        order.status === "shipped" &&
        order.shipping_method === "COURIER" &&
        !order.tracking_number &&
        order.tracking_unavailable !== true;
      const fulfillmentComplete =
        Boolean(order.shipping_method) &&
        (order.shipping_method !== "COURIER" ||
          (order.carrier_name && (order.tracking_number || order.tracking_unavailable === true)));

      return {
        ...orderFields,
        status_display_label: STATUS_LABELS[order.status] || order.status,
        contains_customized_items: items.some((item) => item.is_customized),
        item_count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        items,
        status_history: historyByOrder[order.id] || [],
        payment_status_display_label: PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status,
        payment_method_display_label: PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method,
        // Task N1: a cancelled order whose payment is still PAID needs a
        // manual refund — this is never auto-set to REFUNDED, only surfaced.
        refund_required: order.status === "cancelled" && order.payment_status === "PAID",
        payment_history: paymentHistoryByOrder[order.id] || [],
        shipping_method_display_label: order.shipping_method
          ? SHIPPING_METHOD_LABELS[order.shipping_method] || order.shipping_method
          : null,
        private_note: fulfillment_private_note,
        fulfillment_updated_by_email: fulfillment_updated_by_email || null,
        ready_to_ship: order.status === "ready",
        in_transit: order.status === "shipped",
        tracking_missing: trackingMissing,
        fulfillment_complete: fulfillmentComplete,
      };
    });

    res.json(ordersWithItems);
  } catch (err) {
    console.error("Admin fetch orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

/* ─────────────────────────────────────────────
   Task N1: owner payment endpoints. Kept in orders.routes.js rather than a
   separate payments.routes.js — mirrors Task M1's admin-notes endpoints,
   which are order-scoped resources living alongside the order routes that
   already mount at /api/orders.
───────────────────────────────────────────── */
const MAX_TRANSACTION_REFERENCE_LENGTH = 200;
const MAX_PAYMENT_CHANGE_NOTE_LENGTH = 2000;

function serializePayment(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    status: row.status,
    status_display_label: PAYMENT_STATUS_LABELS[row.status] || row.status,
    payment_method: row.payment_method,
    payment_method_display_label: PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method,
    transaction_reference: row.transaction_reference,
    paid_at: row.paid_at,
    failed_at: row.failed_at,
    refunded_at: row.refunded_at,
    failure_reason: row.failure_reason,
    refund_reason: row.refund_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/orders/:orderId/payment — admin only. Full record + history +
// refund_required, for a focused refresh after a mutation.
router.get("/:orderId/payment", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.orderId);

  try {
    const orderResult = await pool.query("SELECT id, status FROM orders WHERE id = $1", [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    const paymentResult = await pool.query("SELECT * FROM payments WHERE order_id = $1", [orderId]);
    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: "Payment record not found for this order." });
    }
    const payment = paymentResult.rows[0];

    const historyResult = await pool.query(
      `SELECT h.*, u.email AS changed_by_email
       FROM payment_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.order_id = $1 ORDER BY h.created_at ASC`,
      [orderId]
    );

    res.json({
      payment: serializePayment(payment),
      refund_required: orderResult.rows[0].status === "cancelled" && payment.status === "PAID",
      payment_history: historyResult.rows,
    });
  } catch (err) {
    console.error("Fetch payment error:", err);
    res.status(500).json({ error: "Failed to fetch payment." });
  }
});

// PATCH /api/orders/:orderId/payment — admin only. Body:
//   { status, payment_method?, transaction_reference?, change_note?, failure_reason?, refund_reason? }
// Enforces the PENDING/FAILED/PAID/REFUNDED transition graph, sets
// server-generated timestamps, and writes exactly one payment_status_history
// row per real transition (idempotent same-status re-selects write nothing).
router.patch("/:orderId/payment", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const {
    status,
    payment_method,
    transaction_reference,
    change_note,
    failure_reason,
    refund_reason,
  } = req.body;

  if (!status || !VALID_PAYMENT_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`,
    });
  }

  if (payment_method !== undefined && !VALID_PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({
      error: `payment_method must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
    });
  }

  const trimmedRef =
    typeof transaction_reference === "string" ? transaction_reference.trim() : undefined;
  if (trimmedRef !== undefined && trimmedRef.length > MAX_TRANSACTION_REFERENCE_LENGTH) {
    return res.status(400).json({
      error: `transaction_reference must be ${MAX_TRANSACTION_REFERENCE_LENGTH} characters or fewer.`,
    });
  }

  const trimmedNote = typeof change_note === "string" ? change_note.trim() : "";
  if (trimmedNote.length > MAX_PAYMENT_CHANGE_NOTE_LENGTH) {
    return res.status(400).json({
      error: `change_note must be ${MAX_PAYMENT_CHANGE_NOTE_LENGTH} characters or fewer.`,
    });
  }

  const trimmedFailureReason = typeof failure_reason === "string" ? failure_reason.trim() : "";
  const trimmedRefundReason = typeof refund_reason === "string" ? refund_reason.trim() : "";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderCheck = await client.query("SELECT id FROM orders WHERE id = $1", [orderId]);
    if (orderCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found." });
    }

    // Lock the payment row so a concurrent update can't race this one.
    const paymentResult = await client.query(
      "SELECT * FROM payments WHERE order_id = $1 FOR UPDATE",
      [orderId]
    );
    if (paymentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment record not found for this order." });
    }
    const currentPayment = paymentResult.rows[0];

    const transition = validatePaymentTransition(currentPayment.status, status);
    if (!transition.ok) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: transition.error });
    }

    if (transition.idempotent) {
      await client.query("ROLLBACK");
      return res.json({
        message: "Payment status unchanged.",
        payment: serializePayment(currentPayment),
      });
    }

    // Field requirements only apply to a genuine transition — an idempotent
    // re-select above never reaches here.
    if (status === "FAILED" && !trimmedFailureReason) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "failure_reason is required when marking a payment as Failed.",
      });
    }

    if (status === "REFUNDED" && !trimmedRefundReason) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "refund_reason is required when refunding a payment.",
      });
    }

    const effectiveMethod = payment_method || currentPayment.payment_method;
    const effectiveReference =
      trimmedRef !== undefined ? trimmedRef : currentPayment.transaction_reference || "";

    // Bank Transfer payments must carry a reference by the time they're
    // marked Paid — Cash on Delivery / Manual never require one.
    if (status === "PAID" && effectiveMethod === "BANK_TRANSFER" && !effectiveReference) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "transaction_reference is required for Bank Transfer payments marked as Paid.",
      });
    }

    const updates = ["status = $1", "updated_at = now()"];
    const values = [status];
    let idx = 2;

    if (payment_method !== undefined) {
      updates.push(`payment_method = $${idx++}`);
      values.push(payment_method);
    }
    if (trimmedRef !== undefined) {
      updates.push(`transaction_reference = $${idx++}`);
      values.push(trimmedRef || null);
    }

    if (status === "PAID") {
      // Never overwrite an already-recorded first payment time.
      updates.push(`paid_at = COALESCE(paid_at, now())`);
    }

    if (status === "FAILED") {
      updates.push(`failed_at = now()`);
      updates.push(`failure_reason = $${idx++}`);
      values.push(trimmedFailureReason);
    }

    if (status === "REFUNDED") {
      updates.push(`refunded_at = now()`);
      updates.push(`refund_reason = $${idx++}`);
      values.push(trimmedRefundReason);
    }

    // Task N1 chosen behavior for Failed -> Pending (retry): CLEAR the
    // previous failure's footprint rather than preserving it. failed_at and
    // failure_reason represent the *current* unresolved failure; once the
    // owner retries, that failure is no longer active — the full record
    // still exists permanently in payment_status_history either way.
    if (status === "PENDING" && currentPayment.status === "FAILED") {
      updates.push(`failed_at = NULL`);
      updates.push(`failure_reason = NULL`);
    }

    values.push(orderId);
    const updateResult = await client.query(
      `UPDATE payments SET ${updates.join(", ")} WHERE order_id = $${idx} RETURNING *`,
      values
    );

    await client.query(
      `INSERT INTO payment_status_history (payment_id, order_id, old_status, new_status, changed_by, change_note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [currentPayment.id, orderId, currentPayment.status, status, req.user.id, trimmedNote || null]
    );

    await client.query("COMMIT");

    res.json({ message: "Payment updated.", payment: serializePayment(updateResult.rows[0]) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update payment error:", err);
    res.status(500).json({ error: "Failed to update payment." });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/orders/:id/status
   Admin only — move an order through the production workflow:
   new -> design_review -> in_production -> ready -> shipped -> delivered
   (new/design_review/in_production/ready may also go to cancelled).
   Body: { status: "new"|"design_review"|"in_production"|"ready"|"shipped"|"delivered"|"cancelled" }
───────────────────────────────────────────── */
// Thrown when a cancellation needs to restock an item whose GENERAL product
// or VARIANT inventory row no longer exists. Caught below to roll back the
// whole transaction and return a controlled 400 instead of a generic 500 —
// distinct from any other unexpected error.
class MissingInventoryForCancellationError extends Error {}

router.patch("/:id/status", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
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

    // Task M1: enforce the production-workflow transition graph before
    // touching anything. Re-selecting the same status is a no-op success —
    // no history row, no restock, no write at all.
    const transition = validateTransition(currentOrder.status, status);

    if (!transition.ok) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: transition.error });
    }

    if (transition.idempotent) {
      await client.query("ROLLBACK");
      const fullOrder = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
      return res.json({
        message: "Order status unchanged.",
        order: fullOrder.rows[0],
      });
    }

    // Task O1: Ready -> Shipped requires owner-entered fulfillment info in
    // this same request ("Save & Mark Shipped" is one combined action) —
    // validated here, before any write, so a rejected request changes
    // nothing at all: no order status, no history, no partial fulfillment
    // update. shipped_at is never taken from the browser — set below from
    // the server clock only once validation passes.
    let fulfillmentFieldsToApply = null;

    if (currentOrder.status === "ready" && status === "shipped") {
      const inputValidation = validateFulfillmentInput(req.body);
      if (!inputValidation.ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: inputValidation.error });
      }

      // Only a real, explicit boolean counts — validateFulfillmentInput
      // above already rejected anything else (e.g. the string "true").
      const trackingUnavailable = inputValidation.fields.tracking_unavailable === true;
      const requirementCheck = validateReadyToShippedRequirements(
        inputValidation.fields,
        trackingUnavailable
      );
      if (!requirementCheck.ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: requirementCheck.error });
      }

      fulfillmentFieldsToApply = inputValidation.fields;

      // Task O1 correction: persist the confirmation itself, normalized —
      // never true for a non-Courier method, and always cleared the moment
      // a real tracking number is entered (a number present at all means
      // tracking is no longer "unavailable", regardless of what the
      // request separately claimed).
      if (fulfillmentFieldsToApply.shipping_method === "COURIER") {
        fulfillmentFieldsToApply.tracking_unavailable = fulfillmentFieldsToApply.tracking_number
          ? false
          : trackingUnavailable;
      } else {
        fulfillmentFieldsToApply.tracking_unavailable = false;
      }
    }

    // Shipped -> Delivered needs no fulfillment fields at all — tracking
    // corrections happen separately via PATCH /:orderId/fulfillment.
    // delivered_at, like shipped_at, is always server time.
    const markDelivered = currentOrder.status === "shipped" && status === "delivered";

    if (fulfillmentFieldsToApply) {
      const setClauses = [];
      const values = [];
      let idx = 1;
      for (const [key, value] of Object.entries(fulfillmentFieldsToApply)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(value);
      }
      setClauses.push(`shipped_at = COALESCE(shipped_at, now())`);
      setClauses.push(`updated_at = now()`);
      setClauses.push(`updated_by = $${idx++}`);
      values.push(req.user.id);
      values.push(orderId);

      const fulfillmentUpdateResult = await client.query(
        `UPDATE order_fulfillment SET ${setClauses.join(", ")} WHERE order_id = $${idx} RETURNING order_id`,
        values
      );

      if (fulfillmentUpdateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Fulfillment record not found for this order." });
      }
    }

    if (markDelivered) {
      const fulfillmentUpdateResult = await client.query(
        `UPDATE order_fulfillment
         SET delivered_at = COALESCE(delivered_at, now()), updated_at = now(), updated_by = $1
         WHERE order_id = $2
         RETURNING order_id`,
        [req.user.id, orderId]
      );

      if (fulfillmentUpdateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Fulfillment record not found for this order." });
      }
    }

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

    // Log the transition for the status timeline. The idempotent
    // same-status case already returned above, so this is always a real
    // transition — exactly one history row per call.
    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [orderId, currentOrder.status, status, req.user.id]
    );

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
   Task O1: owner fulfillment endpoints. Kept in orders.routes.js — mirrors
   Task N1's payment endpoints, order-scoped resources living alongside the
   order routes that already mount at /api/orders.
───────────────────────────────────────────── */
function serializeFulfillment(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    shipping_method: row.shipping_method,
    shipping_method_display_label: row.shipping_method
      ? SHIPPING_METHOD_LABELS[row.shipping_method] || row.shipping_method
      : null,
    carrier_name: row.carrier_name,
    tracking_number: row.tracking_number,
    tracking_url: row.tracking_url,
    estimated_delivery_date: row.estimated_delivery_date,
    shipped_at: row.shipped_at,
    delivered_at: row.delivered_at,
    private_note: row.private_note,
    tracking_unavailable: row.tracking_unavailable,
    created_at: row.created_at,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

// GET /api/orders/:orderId/fulfillment — admin only.
router.get("/:orderId/fulfillment", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.orderId);

  try {
    const orderResult = await pool.query("SELECT id, status FROM orders WHERE id = $1", [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    const fulfillmentResult = await pool.query(
      "SELECT * FROM order_fulfillment WHERE order_id = $1",
      [orderId]
    );
    if (fulfillmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Fulfillment record not found for this order." });
    }
    const fulfillment = fulfillmentResult.rows[0];

    res.json({
      fulfillment: serializeFulfillment(fulfillment),
      ready_to_ship: orderResult.rows[0].status === "ready",
      in_transit: orderResult.rows[0].status === "shipped",
      tracking_missing:
        orderResult.rows[0].status === "shipped" &&
        fulfillment.shipping_method === "COURIER" &&
        !fulfillment.tracking_number &&
        fulfillment.tracking_unavailable !== true,
    });
  } catch (err) {
    console.error("Fetch fulfillment error:", err);
    res.status(500).json({ error: "Failed to fetch fulfillment." });
  }
});

// PATCH /api/orders/:orderId/fulfillment — admin only. Corrects fulfillment
// fields independently of the order-status transition above (e.g. fixing a
// mistyped tracking number after Shipped, or preparing shipping info while
// still Ready). Never touches order status, shipped_at, or delivered_at —
// those are exclusively server-set via PATCH /:id/status.
router.patch("/:orderId/fulfillment", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.orderId);

  const validation = validateFulfillmentInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  // Guard on the client's raw input before any normalization below adds an
  // implicit field to an otherwise genuinely empty request.
  if (Object.keys(validation.fields).length === 0) {
    return res.status(400).json({ error: "No fulfillment fields were provided." });
  }

  try {
    const orderResult = await pool.query("SELECT id FROM orders WHERE id = $1", [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    const currentResult = await pool.query(
      `SELECT f.shipping_method, f.tracking_number, f.tracking_unavailable, o.status AS order_status
       FROM order_fulfillment f
       JOIN orders o ON o.id = f.order_id
       WHERE f.order_id = $1`,
      [orderId]
    );
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Fulfillment record not found for this order." });
    }
    const current = currentResult.rows[0];

    // Task O1 correction: build the *effective final* state — current DB
    // values merged with whatever this request actually changes — so the
    // shipped-Courier tracking invariant is checked against what the row
    // will actually look like after this update, not just the one field
    // the request happened to touch. Covers every request shape: clearing
    // tracking_number, flipping tracking_unavailable to false with no
    // number in play, switching shipping_method to COURIER on a row that
    // never had tracking data, and any partial combination of these.
    const effectiveMethod =
      validation.fields.shipping_method !== undefined
        ? validation.fields.shipping_method
        : current.shipping_method;
    const effectiveTrackingNumber =
      validation.fields.tracking_number !== undefined
        ? validation.fields.tracking_number
        : current.tracking_number;
    const effectiveTrackingUnavailablePreNormalization =
      validation.fields.tracking_unavailable !== undefined
        ? validation.fields.tracking_unavailable
        : current.tracking_unavailable;

    // Same normalization as the Ready -> Shipped path — never true for a
    // non-Courier method, and always cleared the moment a real tracking
    // number is in play, regardless of what tracking_unavailable itself
    // was requested as.
    const effectiveTrackingUnavailable =
      effectiveMethod !== "COURIER"
        ? false
        : effectiveTrackingNumber
        ? false
        : effectiveTrackingUnavailablePreNormalization;

    if (
      (current.order_status === "shipped" || current.order_status === "delivered") &&
      effectiveMethod === "COURIER" &&
      !effectiveTrackingNumber &&
      effectiveTrackingUnavailable !== true
    ) {
      return res.status(400).json({
        error:
          "A shipped Courier order must have a tracking number or be marked as tracking unavailable.",
      });
    }

    validation.fields.tracking_unavailable = effectiveTrackingUnavailable;

    const fieldEntries = Object.entries(validation.fields);
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of fieldEntries) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(value);
    }
    setClauses.push(`updated_at = now()`);
    setClauses.push(`updated_by = $${idx++}`);
    values.push(req.user.id);
    values.push(orderId);

    const updateResult = await pool.query(
      `UPDATE order_fulfillment SET ${setClauses.join(", ")} WHERE order_id = $${idx} RETURNING *`,
      values
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "Fulfillment record not found for this order." });
    }

    res.json({
      message: "Fulfillment updated.",
      fulfillment: serializeFulfillment(updateResult.rows[0]),
    });
  } catch (err) {
    console.error("Update fulfillment error:", err);
    res.status(500).json({ error: "Failed to update fulfillment." });
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

/* ─────────────────────────────────────────────
   Task M1: Private Owner Notes — a richer, multi-entry note system on
   order_admin_notes, additive alongside the older single-field
   orders.admin_notes column/endpoint above (left untouched). Admin-only;
   customers never receive these in any response.
───────────────────────────────────────────── */
const MAX_NOTE_LENGTH = 2000;

function serializeAdminNote(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    note_text: row.note_text,
    created_at: row.created_at,
    updated_at: row.updated_at,
    admin_user_id: row.admin_user_id,
    admin_email: row.admin_email || null,
  };
}

// GET /api/orders/:orderId/admin-notes — newest first.
router.get(
  "/:orderId/admin-notes",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    const orderId = parseInt(req.params.orderId);

    try {
      const orderCheck = await pool.query("SELECT id FROM orders WHERE id = $1", [
        orderId,
      ]);
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: "Order not found." });
      }

      const result = await pool.query(
        `
        SELECT n.*, u.email AS admin_email
        FROM order_admin_notes n
        LEFT JOIN users u ON u.id = n.admin_user_id
        WHERE n.order_id = $1
        ORDER BY n.created_at DESC
        `,
        [orderId]
      );

      res.json({ notes: result.rows.map(serializeAdminNote) });
    } catch (err) {
      console.error("Fetch admin notes error:", err);
      res.status(500).json({ error: "Failed to fetch admin notes." });
    }
  }
);

// POST /api/orders/:orderId/admin-notes — Body: { note_text }
router.post(
  "/:orderId/admin-notes",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const noteText = typeof req.body.note_text === "string" ? req.body.note_text.trim() : "";

    if (!noteText) {
      return res.status(400).json({ error: "Note text is required." });
    }
    if (noteText.length > MAX_NOTE_LENGTH) {
      return res.status(400).json({
        error: `Note text must be ${MAX_NOTE_LENGTH} characters or fewer.`,
      });
    }

    try {
      const orderCheck = await pool.query("SELECT id FROM orders WHERE id = $1", [
        orderId,
      ]);
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: "Order not found." });
      }

      const insertResult = await pool.query(
        `INSERT INTO order_admin_notes (order_id, admin_user_id, note_text)
         VALUES ($1, $2, $3) RETURNING *`,
        [orderId, req.user.id, noteText]
      );

      const withEmail = await pool.query(
        `SELECT n.*, u.email AS admin_email
         FROM order_admin_notes n
         LEFT JOIN users u ON u.id = n.admin_user_id
         WHERE n.id = $1`,
        [insertResult.rows[0].id]
      );

      res.status(201).json({
        message: "Note added.",
        note: serializeAdminNote(withEmail.rows[0]),
      });
    } catch (err) {
      console.error("Create admin note error:", err);
      res.status(500).json({ error: "Failed to add admin note." });
    }
  }
);

// PATCH /api/orders/:orderId/admin-notes/:noteId — Body: { note_text }
router.patch(
  "/:orderId/admin-notes/:noteId",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const noteId = parseInt(req.params.noteId);
    const noteText = typeof req.body.note_text === "string" ? req.body.note_text.trim() : "";

    if (!noteText) {
      return res.status(400).json({ error: "Note text is required." });
    }
    if (noteText.length > MAX_NOTE_LENGTH) {
      return res.status(400).json({
        error: `Note text must be ${MAX_NOTE_LENGTH} characters or fewer.`,
      });
    }

    try {
      // Verify the note actually belongs to this order before touching it.
      const existing = await pool.query(
        "SELECT id, order_id FROM order_admin_notes WHERE id = $1",
        [noteId]
      );
      if (existing.rows.length === 0 || existing.rows[0].order_id !== orderId) {
        return res.status(404).json({ error: "Note not found for this order." });
      }

      const updateResult = await pool.query(
        `UPDATE order_admin_notes
         SET note_text = $1, updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [noteText, noteId]
      );

      const withEmail = await pool.query(
        `SELECT n.*, u.email AS admin_email
         FROM order_admin_notes n
         LEFT JOIN users u ON u.id = n.admin_user_id
         WHERE n.id = $1`,
        [updateResult.rows[0].id]
      );

      res.json({
        message: "Note updated.",
        note: serializeAdminNote(withEmail.rows[0]),
      });
    } catch (err) {
      console.error("Update admin note error:", err);
      res.status(500).json({ error: "Failed to update admin note." });
    }
  }
);

// DELETE /api/orders/:orderId/admin-notes/:noteId
router.delete(
  "/:orderId/admin-notes/:noteId",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const noteId = parseInt(req.params.noteId);

    try {
      const existing = await pool.query(
        "SELECT id, order_id FROM order_admin_notes WHERE id = $1",
        [noteId]
      );
      if (existing.rows.length === 0 || existing.rows[0].order_id !== orderId) {
        return res.status(404).json({ error: "Note not found for this order." });
      }

      await pool.query("DELETE FROM order_admin_notes WHERE id = $1", [noteId]);

      res.json({ message: "Note deleted." });
    } catch (err) {
      console.error("Delete admin note error:", err);
      res.status(500).json({ error: "Failed to delete admin note." });
    }
  }
);

module.exports = router;