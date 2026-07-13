import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API_BASE from "../config/api";
import ImageGallery from "../components/ImageGallery";
import { getActiveGallery } from "../utils/productGallery";
import {
  availabilityLabel,
  getCombinationAvailability,
} from "../utils/inventoryAvailability";

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const FONT = "'Cormorant Garamond', Georgia, serif";

const s = {
  page: {
    minHeight: "100vh",
    background: "#fff",
    fontFamily: FONT,
    color: "#1a1a1a",
  },

  /* breadcrumb */
  breadcrumb: {
    padding: "28px 60px 0",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "11px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#aaa",
  },
  breadcrumbLink: {
    background: "none",
    border: "none",
    fontFamily: FONT,
    fontSize: "11px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#aaa",
    cursor: "pointer",
    padding: 0,
    textDecoration: "none",
  },
  breadcrumbSep: {
    color: "#ddd",
    fontSize: "10px",
  },
  breadcrumbCurrent: {
    color: "#1a1a1a",
  },

  /* two-column layout */
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0",
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "40px 60px 80px",
    alignItems: "start",
  },

  /* image column */
  imageCol: {
    position: "sticky",
    top: "100px",
  },

  /* info column */
  infoCol: {
    paddingLeft: "64px",
    paddingTop: "8px",
  },
  eyebrow: {
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "#aaa",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  eyebrowDot: {
    width: "3px",
    height: "3px",
    borderRadius: "50%",
    background: "#ccc",
    display: "inline-block",
  },
  productName: {
    fontSize: "clamp(28px, 3.5vw, 48px)",
    fontWeight: "300",
    letterSpacing: "0.03em",
    lineHeight: 1.1,
    margin: "0 0 20px",
    fontFamily: FONT,
  },
  price: {
    fontSize: "22px",
    fontWeight: "400",
    letterSpacing: "0.06em",
    color: "#1a1a1a",
    marginBottom: "8px",
    fontFamily: FONT,
  },
  stockStatus: {
    display: "block",
    fontSize: "11px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: FONT,
    marginBottom: "20px",
  },

  divider: {
    border: "none",
    borderTop: "1px solid #ece9e4",
    margin: "28px 0",
  },

  description: {
    fontSize: "15px",
    lineHeight: "1.8",
    color: "#555",
    letterSpacing: "0.02em",
    fontFamily: FONT,
    marginBottom: "0",
  },

  /* size */
  label: {
    fontSize: "11px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#999",
    fontFamily: FONT,
    marginBottom: "12px",
    display: "block",
  },
  customizationLabel: {
    fontSize: "12px",
    letterSpacing: "0.08em",
    fontFamily: FONT,
    marginBottom: "28px",
    display: "block",
  },
  sizeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "28px",
  },
  sizesLoadingText: {
    fontSize: "12px",
    color: "#999",
    fontFamily: FONT,
    letterSpacing: "0.04em",
    marginBottom: "28px",
  },
  standardSizeLine: {
    fontSize: "11px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#999",
    fontFamily: FONT,
    marginBottom: "28px",
  },
  sizesStatusRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "28px",
  },
  sizesErrorText: {
    fontSize: "12px",
    color: "#c0392b",
    fontFamily: FONT,
    letterSpacing: "0.04em",
  },
  retryBtn: {
    background: "none",
    border: "none",
    borderBottom: "1px solid #1a1a1a",
    color: "#1a1a1a",
    fontFamily: FONT,
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "pointer",
    padding: 0,
  },
  sizeBtn: (selected) => ({
    width: "48px",
    height: "48px",
    border: selected ? "1.5px solid #1a1a1a" : "1px solid #ddd",
    background: selected ? "#1a1a1a" : "#fff",
    color: selected ? "#fff" : "#1a1a1a",
    fontFamily: FONT,
    fontSize: "12px",
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.18s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),

  colorRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "28px",
  },
  colorSwatchBtn: (selected) => ({
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: selected ? "2px solid #1a1a1a" : "1px solid #ddd",
    boxShadow: selected ? "0 0 0 2px #fff inset" : "none",
    cursor: "pointer",
    padding: 0,
    transition: "all 0.18s ease",
  }),

  /* quantity */
  qtyRow: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    marginBottom: "32px",
    border: "1px solid #ddd",
    width: "fit-content",
  },
  qtyBtn: {
    width: "44px",
    height: "44px",
    border: "none",
    background: "#fff",
    fontFamily: FONT,
    fontSize: "18px",
    color: "#1a1a1a",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
  },
  qtyNum: {
    width: "56px",
    height: "44px",
    borderLeft: "1px solid #ddd",
    borderRight: "1px solid #ddd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    letterSpacing: "0.08em",
    fontFamily: FONT,
    userSelect: "none",
  },

  /* actions */
  actionStack: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  addToCart: {
    width: "100%",
    padding: "16px",
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    fontFamily: FONT,
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  customize: {
    width: "100%",
    padding: "15px",
    background: "#fff",
    color: "#1a1a1a",
    border: "1.5px solid #1a1a1a",
    fontFamily: FONT,
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  disabledBtn: {
    background: "#ccc",
    cursor: "not-allowed",
  },
  disabledBtnOutline: {
    color: "#bbb",
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "not-allowed",
  },

  /* added feedback */
  addedMsg: {
    fontSize: "11px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#888",
    textAlign: "center",
    fontFamily: FONT,
    marginTop: "4px",
  },

  /* meta tags */
  metaRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "20px",
  },
  metaTag: {
    fontSize: "10px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#999",
    border: "1px solid #e8e6e1",
    padding: "5px 12px",
    fontFamily: FONT,
  },

  /* states */
  center: {
    minHeight: "60vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: FONT,
    fontSize: "13px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#bbb",
  },
  errorText: {
    color: "#c0392b",
  },
};

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function ProductDetails({ fetchCart }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sizes, setSizes] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);
  const [sizesLoading, setSizesLoading] = useState(true);
  const [sizesError, setSizesError] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [colors, setColors] = useState([]);
  const [selectedColor, setSelectedColor] = useState(null);

  // Task K3: General vs Variant inventory. `availability` is the raw
  // response — { inventory_mode: "GENERAL", availability_status } or
  // { inventory_mode: "VARIANT", combinations: [...] }. Never contains an
  // exact quantity.
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/products`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Match by id — handles string and numeric ids
        const found = data.find(
          (p) => String(p.id) === String(id)
        );
        if (!found) throw new Error("Product not found.");
        setProduct(found);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    setColors([]);
    setSelectedColor(null);

    fetch(`${API_BASE}/products/${id}/colors`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const activeColors = Array.isArray(data) ? data : [];
        setColors(activeColors);
        if (activeColors.length > 0) {
          setSelectedColor(activeColors[0]);
        }
      })
      .catch((err) => {
        console.error("Error fetching product colors:", err);
      });
  }, [id]);

  function loadSizes() {
    setSizes([]);
    setSelectedSize(null);
    setSizesError(null);
    setSizesLoading(true);

    fetch(`${API_BASE}/products/${id}/sizes`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const activeSizes = Array.isArray(data) ? data : [];
        setSizes(activeSizes);
        if (activeSizes.length > 0) {
          setSelectedSize(activeSizes[0]);
        }
        setSizesLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching product sizes:", err);
        // A failed request is NOT the same as "this product has no sizes" —
        // leave sizesError set so Add to Cart stays blocked until this
        // resolves (successfully or via Retry), instead of silently
        // treating an unknown state as "no size required."
        setSizesError("Sizes could not be loaded. Please try again.");
        setSizesLoading(false);
      });
  }

  useEffect(() => {
    loadSizes();
  }, [id]);

  useEffect(() => {
    setAvailability(null);

    fetch(`${API_BASE}/products/${id}/availability`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => setAvailability(data))
      .catch((err) => {
        console.error("Error fetching product availability:", err);
      });
  }, [id]);

  const isVariantInventory = availability?.inventory_mode === "VARIANT";

  // Task L1: STANDARD products never show a size selector and never
  // require selectedSize — the product object already carries this
  // (GET /api/products uses SELECT *, so sizing_mode/standard_size_label
  // are already present, no extra fetch needed).
  const isStandardSizing = product?.sizing_mode === "STANDARD";

  // Task K3: exact color+size combination availability — only meaningful in
  // Variant mode. In General mode every size/color combination is always
  // selectable (whole-product stock controls availability, unchanged).
  function comboAvailable(colorId, sizeId) {
    if (!isVariantInventory) return true;
    return getCombinationAvailability(availability.combinations, colorId, sizeId)
      .is_available;
  }

  // A color is only fully disabled when NONE of its active sizes are in
  // stock — never merely because the CURRENTLY selected size happens to be
  // unavailable for it. Selecting such a color is exactly what should let
  // the customer discover its other available sizes, so it must stay
  // clickable as long as at least one size works for it.
  function colorHasAnyAvailableSize(colorId) {
    if (!isVariantInventory) return true;
    if (sizes.length === 0) return true;
    return sizes.some((size) => comboAvailable(colorId, size.id));
  }

  // The new color always becomes selected — the previously selected size is
  // only kept if it's still in stock for that exact new color; otherwise it
  // clears immediately rather than lingering as a visually-selected but
  // now-invalid combination. Computed against the NEXT color before either
  // setState call, never against post-update state.
  function handleSelectColor(nextColor) {
    const sizeStillValid =
      !isVariantInventory ||
      !selectedSize ||
      comboAvailable(nextColor?.id ?? null, selectedSize.id);

    setSelectedColor(nextColor);
    setSelectedSize(sizeStillValid ? selectedSize : null);
  }

  // Equivalent inverse: the new size always becomes selected; the
  // previously selected color is only kept if it's still in stock for that
  // exact new size.
  function handleSelectSize(nextSize) {
    const colorStillValid =
      !isVariantInventory ||
      colors.length === 0 ||
      !selectedColor ||
      comboAvailable(selectedColor.id, nextSize.id);

    setSelectedSize(nextSize);
    setSelectedColor(colorStillValid ? selectedColor : null);
  }

  const handleAddToCart = async () => {
    if (!isVariantInventory && Number(product?.stock_quantity || 0) <= 0) {
      alert("This product is out of stock.");
      return;
    }

    // Task L1: STANDARD never requires a size at all — skip every size
    // check below entirely (selectedSize stays null forever for this
    // product, so the Cart payload's size field is always null).
    if (!isStandardSizing) {
      if (sizesLoading) {
        alert("Sizes are still loading. Please wait a moment and try again.");
        return;
      }

      if (sizesError) {
        alert("Sizes could not be loaded. Please try again.");
        return;
      }

      if (sizes.length === 0) {
        alert("Sizes are not configured yet.");
        return;
      }

      if (!selectedSize) {
        alert("Please select a size.");
        return;
      }
    }

    if (colors.length > 0 && !selectedColor) {
      alert("Please select a color.");
      return;
    }

    // Task K3: exact combination must be in stock before Add to Cart is
    // ever attempted — the backend re-validates this independently, but
    // the customer should never even reach a rejected request here.
    if (
      isVariantInventory &&
      !comboAvailable(selectedColor?.id ?? null, selectedSize?.id)
    ) {
      alert("This color and size combination is out of stock.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
  
      if (!token) {
        alert("Please login first to add items to your cart.");
        navigate("/login");
        return;
      }
  
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
          quantity: qty,
        }),
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        console.error("Add to cart failed:", data);
        alert(data.error || "Could not add item to cart.");
        return;
      }
  
      console.log("Added to cart:", data);
  
      if (fetchCart) {
        fetchCart();
      }
  
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (err) {
      console.error("Add to cart error:", err);
      alert("Something went wrong while adding to cart.");
    }
  };

  const handleCustomize = () => {
    if (Number(product?.stock_quantity || 0) <= 0) {
      alert("This product is out of stock.");
      return;
    }
    navigate(`/customize?id=${product.id}`);
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.center}>Loading…</div>
      </div>
    );
  }

  /* ── Error / Not Found ── */
  if (error) {
    return (
      <div style={s.page}>
        <div style={{ ...s.center, ...s.errorText }}>{error}</div>
      </div>
    );
  }

  const activeGallery = getActiveGallery(product, selectedColor);

  // Task K3: in Variant mode, the whole-product badge only says "out of
  // stock" when truly nothing is purchasable (every combination is) —
  // per-combination availability is shown on the size/color buttons
  // themselves instead of one blanket number-derived flag.
  const isOutOfStock = isVariantInventory
    ? Boolean(availability?.combinations?.length) &&
      availability.combinations.every((c) => !c.is_available)
    : Number(product.stock_quantity || 0) <= 0;

  const selectedComboAvailability =
    isVariantInventory &&
    (colors.length === 0 || selectedColor) &&
    (sizes.length === 0 || selectedSize)
      ? getCombinationAvailability(
          availability.combinations,
          selectedColor?.id ?? null,
          selectedSize?.id
        )
      : null;

  const isAddToCartBlocked =
    isOutOfStock ||
    (!isStandardSizing && sizesLoading) ||
    (!isStandardSizing && Boolean(sizesError)) ||
    (!isStandardSizing && sizes.length === 0) ||
    (isVariantInventory && selectedComboAvailability
      ? !selectedComboAvailability.is_available
      : false);

  return (
    <div style={s.page}>
      {/* Google Font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap"
      />

      {/* Breadcrumb */}
      <nav style={s.breadcrumb}>
        <button style={s.breadcrumbLink} onClick={() => navigate("/")}>
          Home
        </button>
        <span style={s.breadcrumbSep}>›</span>
        <button
          style={s.breadcrumbLink}
          onClick={() =>
            navigate(
              product.target_group === "WOMEN" ? "/women" : "/men"
            )
          }
        >
          {product.target_group === "WOMEN" ? "Women" : "Men"}
        </button>
        <span style={s.breadcrumbSep}>›</span>
        <span style={s.breadcrumbCurrent}>{product.name}</span>
      </nav>

      {/* Main layout */}
      <div style={s.layout}>

        {/* ── Image column ── */}
        <div style={s.imageCol}>
          <ImageGallery
            key={`${product.id}-${selectedColor?.id ?? "none"}`}
            images={activeGallery}
            altText={product.name}
          />
        </div>

        {/* ── Info column ── */}
        <div style={s.infoCol}>

          {/* Eyebrow: category · target group */}
          <div style={s.eyebrow}>
            {product.category && <span>{product.category}</span>}
            {product.category && product.target_group && (
              <span style={s.eyebrowDot} />
            )}
            {product.target_group && <span>{product.target_group}</span>}
          </div>

          {/* Name */}
          <h1 style={s.productName}>{product.name}</h1>

          {/* Price */}
          <div style={s.price}>
            {product.base_price !== undefined && product.base_price !== null
              ? `$${Number(product.base_price).toFixed(2)}`
              : "—"}
          </div>

          {/* Stock status */}
          <span
            style={{
              ...s.stockStatus,
              color: isOutOfStock ? "#c0392b" : "#4a7c59",
            }}
          >
            {selectedComboAvailability
              ? availabilityLabel(selectedComboAvailability.availability_status)
              : isOutOfStock
              ? "Out of Stock"
              : "In Stock"}
          </span>

          <hr style={s.divider} />

          {/* Description */}
          {product.description && (
            <p style={s.description}>{product.description}</p>
          )}

          <hr style={s.divider} />

          {isStandardSizing ? (
            // Task L1: STANDARD — no size buttons, no size requirement at
            // all. Read-only line only; selectedSize stays null forever so
            // the Cart payload's size field is always null for this
            // product, exactly like it always was for a sizeless product.
            <p style={s.standardSizeLine}>
              SIZE — {product.standard_size_label || "One Size"}
            </p>
          ) : (
            <>
              {sizesLoading && (
                <p style={s.sizesLoadingText}>Loading sizes…</p>
              )}

              {!sizesLoading && sizesError && (
                <div style={s.sizesStatusRow}>
                  <span style={s.sizesErrorText}>{sizesError}</span>
                  <button type="button" onClick={loadSizes} style={s.retryBtn}>
                    Retry
                  </button>
                </div>
              )}

              {!sizesLoading && !sizesError && sizes.length === 0 && (
                <p style={s.sizesLoadingText}>Sizes are not configured yet.</p>
              )}

              {!sizesLoading && !sizesError && sizes.length > 0 && (
                <>
                  {/* Size selector */}
                  <span style={s.label}>
                    Select Size
                    {selectedSize && (
                      <span style={{ color: "#1a1a1a", marginLeft: "10px" }}>
                        — {selectedSize.size_label}
                      </span>
                    )}
                  </span>
                  <div style={s.sizeRow}>
                    {sizes.map((size) => {
                      const sizeDisabled =
                        isVariantInventory &&
                        selectedColor &&
                        !comboAvailable(selectedColor.id, size.id);

                      // Never both at once: a disabled button is never
                      // rendered as "selected" even if selectedSize somehow
                      // still points at it.
                      const isSelected =
                        !sizeDisabled && selectedSize?.id === size.id;

                      return (
                        <button
                          key={size.id}
                          title={sizeDisabled ? "Out of stock" : undefined}
                          style={{
                            ...s.sizeBtn(isSelected),
                            ...(sizeDisabled ? s.disabledBtnOutline : {}),
                          }}
                          disabled={sizeDisabled}
                          onClick={() => handleSelectSize(size)}
                          onMouseEnter={(e) => {
                            if (!sizeDisabled && !isSelected) {
                              e.currentTarget.style.borderColor = "#1a1a1a";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!sizeDisabled && !isSelected) {
                              e.currentTarget.style.borderColor = "#ddd";
                            }
                          }}
                        >
                          {size.size_label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {colors.length > 0 && (
            <>
              {/* Color selector */}
              <span style={s.label}>
                Select Color
                {selectedColor && (
                  <span style={{ color: "#1a1a1a", marginLeft: "10px" }}>
                    — {selectedColor.color_name}
                  </span>
                )}
              </span>
              <div style={s.colorRow}>
                {colors.map((color) => {
                  const colorDisabled = !colorHasAnyAvailableSize(color.id);

                  const isSelected = !colorDisabled && selectedColor?.id === color.id;

                  return (
                    <button
                      key={color.id}
                      title={
                        colorDisabled
                          ? `${color.color_name} — Out of stock`
                          : color.color_name
                      }
                      aria-label={color.color_name}
                      disabled={colorDisabled}
                      onClick={() => handleSelectColor(color)}
                      style={{
                        ...s.colorSwatchBtn(isSelected),
                        backgroundColor: color.color_hex || "#eee",
                        opacity: colorDisabled ? 0.3 : 1,
                        cursor: colorDisabled ? "not-allowed" : "pointer",
                      }}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Quantity */}
          <span style={s.label}>Quantity</span>
          <div style={s.qtyRow}>
            <button
              style={s.qtyBtn}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f4f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              −
            </button>
            <span style={s.qtyNum}>{qty}</span>
            <button
              style={s.qtyBtn}
              onClick={() => setQty((q) => q + 1)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f4f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              +
            </button>
          </div>

          <span
            style={{
              ...s.customizationLabel,
              color: product.is_customizable ? "#1a1a1a" : "#999",
            }}
          >
            {product.is_customizable
              ? "Customization available"
              : "Ready-to-wear only"}
          </span>

          {/* Actions */}
          <div style={s.actionStack}>
            <button
              style={{
                ...s.addToCart,
                ...(isAddToCartBlocked ? s.disabledBtn : {}),
              }}
              onClick={handleAddToCart}
              disabled={isAddToCartBlocked}
              onMouseEnter={(e) => {
                if (!isAddToCartBlocked) e.currentTarget.style.background = "#333";
              }}
              onMouseLeave={(e) => {
                if (!isAddToCartBlocked) e.currentTarget.style.background = "#1a1a1a";
              }}
            >
              {isOutOfStock
                ? "Out of Stock"
                : isStandardSizing
                ? "Add to Cart"
                : sizesLoading
                ? "Loading Sizes…"
                : sizesError
                ? "Sizes Unavailable"
                : sizes.length === 0
                ? "Sizes Not Configured"
                : "Add to Cart"}
            </button>

            {product.is_customizable && (
              <button
                style={{
                  ...s.customize,
                  ...(isOutOfStock ? s.disabledBtnOutline : {}),
                }}
                onClick={handleCustomize}
                disabled={isOutOfStock}
                onMouseEnter={(e) => {
                  if (isOutOfStock) return;
                  e.currentTarget.style.background = "#1a1a1a";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  if (isOutOfStock) return;
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.color = "#1a1a1a";
                }}
              >
                {isOutOfStock ? "Out of Stock" : "Customize This Product"}
              </button>
            )}
          </div>

          {added && (
            <p style={s.addedMsg}>
              Added to cart{selectedSize ? ` — ${selectedSize.size_label}` : ""} × {qty}
            </p>
          )}

          {/* Meta tags */}
          <div style={s.metaRow}>
            {product.target_group && (
              <span style={s.metaTag}>{product.target_group}</span>
            )}
            {product.category && (
              <span style={s.metaTag}>{product.category}</span>
            )}
            {product.is_customizable && (
              <span style={s.metaTag}>Customizable</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}