import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE from "../config/api";
import ImageGallery from "../components/ImageGallery";
import { getActiveGallery } from "../utils/productGallery";
import {
  getCompatibleVariant,
  getCompatibleDesigns,
  getCompatibleCollections,
  getAssignedActiveOption,
} from "../utils/designCompatibility";
import {
  availabilityLabel,
  getCombinationAvailability,
} from "../utils/inventoryAvailability";

// /api/customization/products and /api/customization/products/:id do not
// currently select stock_quantity, so this only takes effect once that field
// is present on the product object (kept defensive so it doesn't flag every
// product as out of stock in the meantime).
function isProductOutOfStock(p) {
  return p?.stock_quantity !== undefined && Number(p.stock_quantity || 0) <= 0;
}

// Re-resolves an already-selected design against a newly chosen color or
// size, so a color/size change doesn't blow away a design that's still
// perfectly valid under the new selection. Returns { variant, option } only
// when BOTH the variant and the design's owner-assigned placement resolve —
// otherwise null, meaning the caller must clear the design rather than
// guess or fall back to a different option.
function resolveDesignForSelection(design, color, size, hasSizesValue, options) {
  if (!design || !color) return null;

  const variant = getCompatibleVariant(design, color, size, hasSizesValue);
  if (!variant) return null;

  const option = getAssignedActiveOption(design, options);
  if (!option) return null;

  return { variant, option };
}

function CustomizePage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [config, setConfig] = useState(null);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [selectedDesignVariant, setSelectedDesignVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [isDesignPickerOpen, setIsDesignPickerOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/customization/products`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load customizable products.");
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProducts(list);

        if (list.length > 0) {
          setSelectedProductId(list[0].id);
        }

        setLoadingProducts(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingProducts(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;

    setLoadingConfig(true);
    setError("");

    fetch(`${API_BASE}/customization/products/${selectedProductId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load customization options.");
        return res.json();
      })
      .then((data) => {
        setConfig(data);

        const initialColor = data.colors?.[0] || null;
        const initialSize = data.sizes?.[0] || null;
        const initialHasSizes = (data.sizes || []).length > 0;

        setSelectedColor(initialColor);
        setSelectedSize(initialSize);
        // Task I2: selectedOption is no longer independently chosen by the
        // customer — it's only ever set as a side effect of selecting a
        // design (see the design card onClick below), resolved from that
        // design's own owner-assigned placement. Never default it here.
        setSelectedOption(null);
        setQuantity(1);

        // Auto-select the first collection that's actually compatible with
        // the auto-selected color/size — the old "first collection with any
        // designs" check didn't account for compatibility and could land on
        // a collection with nothing valid to show.
        const firstCompatibleCollection = getCompatibleCollections(
          data.collections || [],
          initialColor,
          initialSize,
          initialHasSizes,
          data.options || []
        )[0];

        setSelectedCollectionId(
          firstCompatibleCollection ? firstCompatibleCollection.id : null
        );
        setSelectedDesign(null);
        setSelectedDesignVariant(null);
        setIsDesignPickerOpen(false);

        setLoadingConfig(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingConfig(false);
      });
  }, [selectedProductId]);

  function selectCollection(collectionId) {
    // Only preserve the current design/variant/option if it already
    // belonged to the collection being (re)selected — otherwise all three
    // are stale. selectedOption is only ever a side effect of selectedDesign
    // (Task I2), so it's preserved or cleared together with it, never alone.
    const preserveDesign =
      selectedDesign && selectedDesign.collection_id === collectionId;

    setSelectedCollectionId(collectionId);
    setSelectedDesign(preserveDesign ? selectedDesign : null);
    setSelectedDesignVariant(preserveDesign ? selectedDesignVariant : null);
    setSelectedOption(preserveDesign ? selectedOption : null);
  }

  // Shared by color and size changes: if a design was already selected, try
  // to keep it selected under the new color/size rather than clearing it
  // outright — only falls back to clearing when the same design genuinely
  // isn't compatible with the new selection.
  function preserveOrClearDesignFor(nextColor, nextSize) {
    if (!selectedDesign) {
      // No design was selected — nothing to preserve, unchanged from before.
      setSelectedCollectionId(null);
      setSelectedDesignVariant(null);
      setSelectedOption(null);
      return;
    }

    const resolved = resolveDesignForSelection(
      selectedDesign,
      nextColor,
      nextSize,
      hasSizes,
      config?.options
    );

    if (resolved) {
      // Same design, same collection — just swap in the new color/size's
      // variant and re-resolve its (unchanged) owner-assigned placement.
      setSelectedDesignVariant(resolved.variant);
      setSelectedOption(resolved.option);
      return;
    }

    // The design isn't compatible with the new color/size — clear it, but
    // only clear the collection too if it has no other ready designs left
    // for the new selection. Do not silently substitute another design.
    setSelectedDesign(null);
    setSelectedDesignVariant(null);
    setSelectedOption(null);

    const collectionStillReady = getCompatibleCollections(
      config?.collections,
      nextColor,
      nextSize,
      hasSizes,
      config?.options
    ).some((c) => c.id === selectedCollectionId);

    if (!collectionStillReady) {
      setSelectedCollectionId(null);
    }
  }

  // Task K3: exact color+size stock combination — only meaningful in
  // Variant mode. General mode never restricts a combination this way
  // (whole-product stock controls availability, unchanged).
  const isVariantInventory = config?.inventory?.inventory_mode === "VARIANT";

  function comboAvailable(colorId, sizeId) {
    if (!isVariantInventory) return true;
    return getCombinationAvailability(config.inventory.combinations, colorId, sizeId)
      .is_available;
  }

  // A color is only fully disabled when NONE of its active sizes are in
  // stock — never merely because the CURRENTLY selected size happens to be
  // unavailable for it. Selecting such a color is exactly what should let
  // the customer discover its other available sizes, so it must stay
  // clickable as long as at least one size works for it.
  function colorHasAnyAvailableSize(colorId) {
    if (!isVariantInventory) return true;
    const productSizes = config?.sizes || [];
    if (productSizes.length === 0) return true;
    return productSizes.some((size) => comboAvailable(colorId, size.id));
  }

  function handleColorSelect(color) {
    setSelectedColor(color);

    // Stock availability is checked first and independently of design
    // compatibility — if the new color makes the previously selected size
    // out of stock, the size clears before design compatibility is
    // (re)evaluated below, so preserveOrClearDesignFor always sees a
    // stock-valid size (or null), never a stale out-of-stock one.
    let effectiveSize = selectedSize;
    if (
      isVariantInventory &&
      selectedSize &&
      !comboAvailable(color?.id ?? null, selectedSize.id)
    ) {
      effectiveSize = null;
      setSelectedSize(null);
    }

    preserveOrClearDesignFor(color, effectiveSize);
  }

  function handleSizeSelect(size) {
    setSelectedSize(size);

    let effectiveColor = selectedColor;
    if (
      isVariantInventory &&
      config?.colors?.length > 0 &&
      selectedColor &&
      !comboAvailable(selectedColor.id, size.id)
    ) {
      effectiveColor = null;
      setSelectedColor(null);
    }

    preserveOrClearDesignFor(effectiveColor, size);
  }

  const product = config?.product;
  const hasColors = Array.isArray(config?.colors) && config.colors.length > 0;
  const hasSizes = Array.isArray(config?.sizes) && config.sizes.length > 0;

  // "Has anything configured at all" (ignores compatibility) controls
  // whether the design section renders at all — a product with zero design
  // collections simply doesn't need one, same as before this task.
  const hasAnyDesignsConfigured = (config?.collections || []).some(
    (c) => c.designs && c.designs.length > 0
  );
  const showDesignSection = hasAnyDesignsConfigured;

  const compatibleCollections = useMemo(
    () =>
      getCompatibleCollections(
        config?.collections,
        selectedColor,
        selectedSize,
        hasSizes,
        config?.options
      ),
    [config, selectedColor, selectedSize, hasSizes]
  );

  const activeCollection = compatibleCollections.find(
    (c) => c.id === selectedCollectionId
  );

  const compatibleDesignsForActiveCollection = useMemo(
    () =>
      getCompatibleDesigns(
        activeCollection,
        selectedColor,
        selectedSize,
        hasSizes,
        config?.options
      ),
    [activeCollection, selectedColor, selectedSize, hasSizes, config]
  );

  const totalPrice = useMemo(() => {
    if (!product) return 0;

    const base = Number(product.base_price || 0);
    const productExtra = Number(product.customization_extra_price || 0);
    const optionExtra = Number(selectedOption?.extra_price || 0);

    return (base + productExtra + optionExtra) * quantity;
  }, [product, selectedOption, quantity]);

  // Base product/color gallery — exactly the existing behavior, unchanged.
  const baseGallery = getActiveGallery(product, selectedColor);

  // The backend already returns preview_images ordered main-first, then
  // sort_order, then id — used exactly as received, never re-sorted or
  // mutated here.
  const designPreviewGallery = selectedDesignVariant?.preview_images || [];

  // A design is only "showing" its own gallery when a variant is selected
  // AND it actually has images. Public-ready variants should always have
  // at least one, but this still fails safely to the base gallery instead
  // of ever rendering a blank/broken stage if that assumption is ever
  // violated.
  const isShowingDesignGallery =
    Boolean(selectedDesignVariant) && designPreviewGallery.length > 0;

  const activeGallery = isShowingDesignGallery ? designPreviewGallery : baseGallery;

  // Forces ImageGallery to remount (and reset to its first image) whenever
  // the underlying gallery source actually changes — a different design's
  // preview set, a different color's base gallery, or falling back from
  // one to the other.
  const galleryKey = isShowingDesignGallery
    ? `design-${selectedDesignVariant.id}`
    : `base-${product?.id ?? "none"}-${selectedColor?.id ?? "none"}`;

  function handleClearDesignPreview() {
    setSelectedDesign(null);
    setSelectedDesignVariant(null);
    setSelectedOption(null);
  }

  const handleAddToCart = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (
      !product ||
      (hasColors && !selectedColor) ||
      (hasSizes && !selectedSize)
    ) {
      alert("Please choose product, color, and size.");
      return;
    }

    // Task I2: selectedOption is never chosen independently anymore — it's
    // only ever set as a side effect of picking a placement-ready design.
    // For a product with a design system (showDesignSection), a complete
    // design selection is required: the design, its color/size-compatible
    // variant, AND its resolved placement all together, or none at all.
    if (showDesignSection) {
      if (!selectedDesign || !selectedDesignVariant || !selectedOption) {
        alert("Please choose an available design.");
        return;
      }
    } else if (!selectedOption) {
      // A customizable product with no design collections configured has no
      // way to resolve a placement on this page — block rather than send an
      // incomplete request, using the same customer-facing wording.
      alert("Please choose an available design.");
      return;
    }

    if (!isVariantInventory && isProductOutOfStock(product)) {
      alert("This product is out of stock.");
      return;
    }

    // Task K3: never allow an unavailable combination into Cart — the
    // backend re-validates this independently, but the customer should
    // never even reach a rejected request here.
    if (
      isVariantInventory &&
      !comboAvailable(selectedColor?.id ?? null, selectedSize?.id)
    ) {
      alert("This color and size combination is out of stock.");
      return;
    }

    try {
      setAdding(true);

      const res = await fetch(`${API_BASE}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: product.id,
          color: selectedColor?.color_name || "Default",
          size: selectedSize?.size_label || null,
          quantity,
          is_customized: true,
          customization_option_id: selectedOption.id,
          design_id: selectedDesign?.id || null,
          design_variant_id: selectedDesignVariant?.id || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Could not add customized item.");
      }

      alert("Customized hoodie added to cart.");
      navigate("/cart");
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (loadingProducts) {
    return <div style={styles.centerPage}>Loading customize studio...</div>;
  }

  if (error) {
    return (
      <div style={styles.centerPage}>
        <h2>Something went wrong</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div style={styles.centerPage}>
        <h2>No customizable products yet</h2>
        <p>Admin needs to mark products as customizable first.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Simplicity Custom Studio</p>
        <h1 style={styles.title}>Design Your Hoodie</h1>
        <p style={styles.subtitle}>
          Choose your base, color, size, and design. Preview the vibe before
          adding it to your cart.
        </p>
      </section>

      <section style={styles.mainGrid}>
        {/* LEFT PREVIEW */}
        <div style={styles.previewPanel}>
          <div style={styles.previewHeader}>
            <span>Live Preview</span>
            <span style={styles.previewBadge}>Custom</span>
          </div>

          <div style={styles.previewStage}>
            <ImageGallery
              key={galleryKey}
              images={activeGallery}
              altText={
                isShowingDesignGallery
                  ? `${selectedDesign?.name || "Design"} on ${
                      selectedColor?.color_name || "selected color"
                    }`
                  : product?.name || "Product"
              }
              stageStyle={styles.gallerySlot}
            />

            {isShowingDesignGallery && (
              <div style={styles.designPreviewNotice}>
                <span>
                  Previewing {selectedDesign?.name} on{" "}
                  {selectedColor?.color_name}
                </span>
                <button
                  type="button"
                  onClick={handleClearDesignPreview}
                  style={styles.clearDesignPreviewBtn}
                >
                  View product without design
                </button>
              </div>
            )}

            <div style={styles.previewInfo}>
              <strong>{product?.name || "Custom Hoodie"}</strong>
              <span>
                {selectedColor?.color_name || "Color"} /{" "}
                {selectedSize?.size_label || "Size"} /{" "}
                {selectedOption?.option_label || "Design option"}
              </span>
            </div>
          </div>

          {config?.examples?.length > 0 && (
            <div style={styles.examplesSection}>
              <h3 style={styles.sectionTitle}>Inspiration</h3>
              <div style={styles.exampleGrid}>
                {config.examples.map((ex) => (
                  <div key={ex.id} style={styles.exampleCard}>
                    <img src={ex.image_url} alt={ex.caption} style={styles.exampleImg} />
                    <p>{ex.caption}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT CONTROLS */}
        <div style={styles.controlsPanel}>
          {loadingConfig ? (
            <div style={styles.centerSmall}>Loading options...</div>
          ) : (
            <>
              <div style={styles.controlBlock}>
                <label style={styles.label}>Choose Product</label>

                {isProductPickerOpen ? (
                  <div style={styles.productCardGrid}>
                    {products.map((p) => {
                      const displayImageUrl = p.main_image_url || p.image_url;
                      const isSelected = selectedProductId === p.id;
                      const outOfStock = isProductOutOfStock(p);

                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (outOfStock) return;
                            setSelectedProductId(p.id);
                            setIsProductPickerOpen(false);
                          }}
                          disabled={outOfStock}
                          style={{
                            ...styles.productCard,
                            border: isSelected
                              ? "2px solid #111"
                              : "1px solid #e5e0d8",
                            opacity: outOfStock ? 0.5 : 1,
                            cursor: outOfStock ? "not-allowed" : "pointer",
                          }}
                        >
                          <div style={styles.productCardImageWrap}>
                            {displayImageUrl ? (
                              <img
                                src={displayImageUrl}
                                alt={p.name}
                                style={styles.productCardImage}
                              />
                            ) : (
                              <span style={styles.productCardNoImage}>
                                No Image
                              </span>
                            )}
                          </div>
                          <span style={styles.productCardName}>{p.name}</span>
                          {p.base_price !== undefined && p.base_price !== null && (
                            <span style={styles.productCardPrice}>
                              ${Number(p.base_price).toFixed(2)}
                            </span>
                          )}
                          {p.category && (
                            <span style={styles.productCardCategory}>
                              {p.category}
                            </span>
                          )}
                          {outOfStock && (
                            <span style={styles.productCardOutOfStock}>
                              Out of Stock
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={styles.compactSummary}>
                    <div style={styles.compactSummaryLeft}>
                      <div style={styles.compactSummaryImageWrap}>
                        {product && (product.main_image_url || product.image_url) ? (
                          <img
                            src={product.main_image_url || product.image_url}
                            alt={product.name}
                            style={styles.compactSummaryImage}
                          />
                        ) : (
                          <span style={styles.productCardNoImage}>
                            No Image
                          </span>
                        )}
                      </div>
                      <div>
                        <strong>{product?.name}</strong>
                        {product?.base_price !== undefined &&
                          product?.base_price !== null && (
                            <p style={styles.compactSummaryPrice}>
                              ${Number(product.base_price).toFixed(2)}
                            </p>
                          )}
                        {isProductOutOfStock(product) && (
                          <span style={styles.productCardOutOfStock}>
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setIsProductPickerOpen(true)}
                      style={styles.changeBtn}
                    >
                      Change Product
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.productSummary}>
                <h2>{product?.name}</h2>
                <p>{product?.customization_note}</p>
                <strong>
                  Base ${Number(product?.base_price || 0).toFixed(2)}
                  {" + "}
                  Custom ${Number(product?.customization_extra_price || 0).toFixed(2)}
                </strong>
              </div>

              <div style={styles.controlBlock}>
                <label style={styles.label}>Color</label>
                <div style={styles.swatches}>
                  {config?.colors?.map((c) => {
                    const colorDisabled = !colorHasAnyAvailableSize(c.id);

                    // Never both at once: a disabled color is never rendered
                    // as "selected" even if selectedColor somehow still
                    // points at it.
                    const isSelected = !colorDisabled && selectedColor?.id === c.id;

                    return (
                      <button
                        key={c.id}
                        onClick={() => handleColorSelect(c)}
                        disabled={colorDisabled}
                        title={
                          colorDisabled
                            ? `${c.color_name} — Out of stock`
                            : c.color_name
                        }
                        style={{
                          ...styles.swatch,
                          background: c.color_hex || "#ccc",
                          border: isSelected ? "3px solid #111" : "1px solid #ddd",
                          opacity: colorDisabled ? 0.3 : 1,
                          cursor: colorDisabled ? "not-allowed" : "pointer",
                        }}
                      />
                    );
                  })}
                </div>
                <p style={styles.muted}>{selectedColor?.color_name}</p>
              </div>

              <div style={styles.controlBlock}>
                <label style={styles.label}>Size</label>
                <div style={styles.sizeGrid}>
                  {config?.sizes?.map((s) => {
                    const sizeDisabled =
                      isVariantInventory &&
                      selectedColor &&
                      !comboAvailable(selectedColor.id, s.id);

                    const isSelected = !sizeDisabled && selectedSize?.id === s.id;

                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSizeSelect(s)}
                        disabled={sizeDisabled}
                        title={sizeDisabled ? "Out of stock" : undefined}
                        style={{
                          ...styles.sizeBtn,
                          background: isSelected ? "#111" : "#fff",
                          color: isSelected ? "#fff" : "#111",
                          opacity: sizeDisabled ? 0.35 : 1,
                          cursor: sizeDisabled ? "not-allowed" : "pointer",
                        }}
                      >
                        {s.size_label}
                      </button>
                    );
                  })}
                </div>
                {isVariantInventory &&
                  selectedColor &&
                  selectedSize &&
                  comboAvailable(selectedColor.id, selectedSize.id) && (
                    <p style={styles.muted}>
                      {availabilityLabel(
                        getCombinationAvailability(
                          config.inventory.combinations,
                          selectedColor.id,
                          selectedSize.id
                        ).availability_status
                      )}
                    </p>
                  )}
              </div>

              {showDesignSection && (
                <div style={styles.controlBlock}>
                  <label style={styles.label}>Choose Your Design</label>

                  {compatibleCollections.length === 0 ? (
                    <p style={styles.muted}>
                      {hasSizes
                        ? "No designs are currently available for this color and size."
                        : "No designs are currently available for this color."}
                    </p>
                  ) : isDesignPickerOpen ? (
                    <>
                      <div style={styles.collectionTabs}>
                        {compatibleCollections.map((collection) => (
                          <button
                            key={collection.id}
                            onClick={() => selectCollection(collection.id)}
                            style={{
                              ...styles.collectionTab,
                              background:
                                selectedCollectionId === collection.id
                                  ? "#111"
                                  : "#fff",
                              color:
                                selectedCollectionId === collection.id
                                  ? "#fff"
                                  : "#111",
                            }}
                          >
                            {collection.name}
                          </button>
                        ))}
                      </div>

                      {activeCollection &&
                        (compatibleDesignsForActiveCollection.length === 0 ? (
                          <p style={styles.muted}>
                            No compatible designs are available in this
                            collection.
                          </p>
                        ) : (
                          <div style={styles.designCardGrid}>
                            {compatibleDesignsForActiveCollection.map((design) => (
                              <button
                                key={design.id}
                                onClick={() => {
                                  // Task I2: the design list shown here is
                                  // already filtered to placement-ready
                                  // designs (getCompatibleDesigns checks
                                  // getAssignedActiveOption too), so this
                                  // should always resolve. Still verified
                                  // defensively — a design is never selected
                                  // without both its variant AND its option
                                  // resolving, and no other option can ever
                                  // be substituted in.
                                  const variant = getCompatibleVariant(
                                    design,
                                    selectedColor,
                                    selectedSize,
                                    hasSizes
                                  );
                                  const option = getAssignedActiveOption(
                                    design,
                                    config?.options
                                  );

                                  if (!variant || !option) {
                                    alert(
                                      "Please choose an available design."
                                    );
                                    return;
                                  }

                                  setSelectedDesign(design);
                                  setSelectedDesignVariant(variant);
                                  setSelectedOption(option);
                                  setIsDesignPickerOpen(false);
                                }}
                                style={{
                                  ...styles.designCard,
                                  border:
                                    selectedDesign?.id === design.id
                                      ? "2px solid #111"
                                      : "1px solid #e5e0d8",
                                }}
                              >
                                <div style={styles.designCardImageWrap}>
                                  <img
                                    src={design.image_url}
                                    alt={design.name}
                                    style={styles.designCardImage}
                                  />
                                </div>
                                <span style={styles.designCardName}>
                                  {design.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                    </>
                  ) : (
                    <div style={styles.compactSummary}>
                      <div style={styles.compactSummaryLeft}>
                        {selectedDesign ? (
                          <>
                            <div style={styles.compactSummaryImageWrap}>
                              <img
                                src={selectedDesign.image_url}
                                alt={selectedDesign.name}
                                style={styles.compactSummaryImage}
                              />
                            </div>
                            <div>
                              <strong>{selectedDesign.name}</strong>
                              {/* Task I2: read-only — the owner assigns this
                                  placement per design; the customer can no
                                  longer change it here. */}
                              <p style={styles.placementLine}>
                                Placement:{" "}
                                {selectedDesign.customization_option_name ||
                                  selectedOption?.option_label ||
                                  ""}
                              </p>
                            </div>
                          </>
                        ) : (
                          <span style={styles.muted}>
                            No design selected yet
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setIsDesignPickerOpen(true)}
                        style={styles.changeBtn}
                      >
                        {selectedDesign ? "Change Design" : "Choose Design"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={styles.quantityRow}>
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  -
                </button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)}>+</button>
              </div>

              <div style={styles.totalBox}>
                <span>Total</span>
                <strong>${totalPrice.toFixed(2)}</strong>
              </div>

              {(() => {
                const generalOutOfStock =
                  !isVariantInventory && isProductOutOfStock(product);
                const comboOutOfStock =
                  isVariantInventory &&
                  !comboAvailable(selectedColor?.id ?? null, selectedSize?.id);
                const outOfStock = generalOutOfStock || comboOutOfStock;

                return (
                  <button
                    onClick={handleAddToCart}
                    disabled={adding || outOfStock}
                    style={{
                      ...styles.addBtn,
                      opacity: adding || outOfStock ? 0.6 : 1,
                      cursor: outOfStock ? "not-allowed" : "pointer",
                    }}
                  >
                    {outOfStock
                      ? "Out of Stock"
                      : adding
                      ? "Adding..."
                      : "Add Customized Hoodie"}
                  </button>
                );
              })()}

              <p style={styles.note}>
                This is a visual preview. Final placement may be adjusted by the
                Simplicity team before production.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: {
    background: "#faf8f4",
    minHeight: "100vh",
    paddingBottom: "80px",
    fontFamily: "Georgia, serif",
    color: "#111",
  },
  hero: {
    textAlign: "center",
    padding: "80px 20px 50px",
  },
  eyebrow: {
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    color: "#b59b5b",
    fontSize: "12px",
  },
  title: {
    fontSize: "clamp(2.1rem, 5.5vw, 3.5rem)",
    fontWeight: 400,
    lineHeight: 1.25,
    margin: "14px auto 20px",
    maxWidth: "760px",
    letterSpacing: "0.03em",
  },
  subtitle: {
    maxWidth: "680px",
    margin: "0 auto",
    color: "#777",
    lineHeight: 1.7,
  },
  mainGrid: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "32px",
    padding: "0 24px",
  },
  previewPanel: {
    background: "#fff",
    border: "1px solid #e8e0d4",
    padding: "28px",
    minHeight: "650px",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    fontSize: "12px",
    marginBottom: "24px",
  },
  previewBadge: {
    background: "#111",
    color: "#fff",
    padding: "5px 10px",
  },
  previewStage: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  gallerySlot: {
    maxWidth: "440px",
    margin: "0 auto",
  },
  designPreviewNotice: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
    textAlign: "center",
    fontSize: "12px",
    letterSpacing: "0.04em",
    color: "#9b8c73",
  },
  clearDesignPreviewBtn: {
    background: "none",
    border: "none",
    borderBottom: "1px solid #9b8c73",
    color: "#9b8c73",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "12px",
    padding: 0,
  },
  previewInfo: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    color: "#555",
    fontSize: "13px",
    paddingTop: "16px",
    borderTop: "1px solid #eee",
  },
  examplesSection: {
    marginTop: "28px",
  },
  sectionTitle: {
    fontSize: "14px",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontWeight: 400,
    color: "#999",
  },
  exampleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "14px",
  },
  exampleCard: {
    border: "1px solid #eee",
    background: "#fafafa",
    padding: "8px",
    fontSize: "12px",
    color: "#777",
  },
  exampleImg: {
    width: "100%",
    height: "120px",
    objectFit: "cover",
  },
  controlsPanel: {
    background: "#fff",
    border: "1px solid #e8e0d4",
    padding: "28px",
  },
  controlBlock: {
    marginBottom: "24px",
  },
  label: {
    display: "block",
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "#9b8c73",
    marginBottom: "10px",
  },
  select: {
    width: "100%",
    padding: "14px",
    border: "1px solid #ddd",
    background: "#fff",
    fontFamily: "Georgia, serif",
  },
  productCardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: "12px",
  },
  productCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "4px",
    padding: "10px",
    background: "#fff",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    textAlign: "left",
    transition: "border-color 0.15s ease",
  },
  productCardImageWrap: {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "#f2f0eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: "6px",
  },
  productCardImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  productCardNoImage: {
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#999",
  },
  productCardName: {
    fontSize: "13px",
    color: "#111",
  },
  productCardPrice: {
    fontSize: "12px",
    color: "#555",
  },
  productCardCategory: {
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#9b8c73",
  },
  productCardOutOfStock: {
    fontSize: "9px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#c0392b",
  },
  collectionTabs: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  collectionTab: {
    padding: "10px 16px",
    border: "1px solid #ddd",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "13px",
  },
  designCardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: "10px",
  },
  designCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "4px",
    padding: "8px",
    background: "#fff",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    textAlign: "left",
    transition: "border-color 0.15s ease",
  },
  designCardImageWrap: {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "#f2f0eb",
    overflow: "hidden",
  },
  designCardImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  designCardName: {
    fontSize: "12px",
    color: "#111",
  },
  compactSummary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    border: "1px solid #e5e0d8",
    padding: "12px 14px",
  },
  compactSummaryLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  compactSummaryImageWrap: {
    width: "48px",
    height: "48px",
    flexShrink: 0,
    background: "#f2f0eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  compactSummaryImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  compactSummaryPrice: {
    fontSize: "12px",
    color: "#555",
    margin: "2px 0 0",
  },
  changeBtn: {
    padding: "10px 16px",
    background: "#fff",
    color: "#111",
    border: "1px solid #111",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  productSummary: {
    borderTop: "1px solid #eee",
    borderBottom: "1px solid #eee",
    padding: "20px 0",
    marginBottom: "24px",
  },
  swatches: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  swatch: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    cursor: "pointer",
  },
  muted: {
    color: "#888",
    fontSize: "13px",
  },
  sizeGrid: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  sizeBtn: {
    minWidth: "52px",
    padding: "12px 14px",
    border: "1px solid #ddd",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
  },
  placementLine: {
    fontSize: "12px",
    color: "#9b8c73",
    margin: "2px 0 0",
  },
  quantityRow: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    marginBottom: "20px",
  },
  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid #eee",
    paddingTop: "18px",
    marginBottom: "18px",
    fontSize: "18px",
  },
  addBtn: {
    width: "100%",
    padding: "16px",
    background: "#111",
    color: "#fff",
    border: "none",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
  },
  note: {
    color: "#999",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  centerPage: {
    padding: "100px",
    textAlign: "center",
    fontFamily: "Georgia, serif",
  },
  centerSmall: {
    textAlign: "center",
    color: "#999",
    padding: "80px 0",
  },
};

export default CustomizePage;