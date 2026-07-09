import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import hoodieImg from "../assets/white-hoodie.png";
import API_BASE from "../config/api";

// /api/customization/products and /api/customization/products/:id do not
// currently select stock_quantity, so this only takes effect once that field
// is present on the product object (kept defensive so it doesn't flag every
// product as out of stock in the meantime).
function isProductOutOfStock(p) {
  return p?.stock_quantity !== undefined && Number(p.stock_quantity || 0) <= 0;
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
  const [customText, setCustomText] = useState("");
  const [customNote, setCustomNote] = useState("");
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

        setSelectedColor(data.colors?.[0] || null);
        setSelectedSize(data.sizes?.[0] || null);
        setSelectedOption(data.options?.[0] || null);
        setCustomText("");
        setCustomNote("");
        setQuantity(1);

        const firstCollectionWithDesigns = (data.collections || []).find(
          (c) => c.designs && c.designs.length > 0
        );
        setSelectedCollectionId(
          firstCollectionWithDesigns ? firstCollectionWithDesigns.id : null
        );
        setSelectedDesign(null);
        setIsDesignPickerOpen(false);

        setLoadingConfig(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingConfig(false);
      });
  }, [selectedProductId]);

  function selectCollection(collectionId) {
    setSelectedCollectionId(collectionId);
    setSelectedDesign((current) =>
      current && current.collection_id === collectionId ? current : null
    );
  }

  const product = config?.product;

  const collectionsWithDesigns = (config?.collections || []).filter(
    (c) => c.designs && c.designs.length > 0
  );
  const showDesignSection = collectionsWithDesigns.length > 0;
  const activeCollection = (config?.collections || []).find(
    (c) => c.id === selectedCollectionId
  );

  const totalPrice = useMemo(() => {
    if (!product) return 0;

    const base = Number(product.base_price || 0);
    const productExtra = Number(product.customization_extra_price || 0);
    const optionExtra = Number(selectedOption?.extra_price || 0);

    return (base + productExtra + optionExtra) * quantity;
  }, [product, selectedOption, quantity]);

  const selectedColorHex = selectedColor?.color_hex || "#111111";

  const textPreview = customText.trim()
    ? customText.trim().slice(0, 18)
    : "YOUR TEXT";

  const handleAddToCart = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!product || !selectedColor || !selectedSize || !selectedOption) {
      alert("Please choose product, color, size, and customization option.");
      return;
    }

    if (isProductOutOfStock(product)) {
      alert("This product is out of stock.");
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
          color: selectedColor.color_name,
          size: selectedSize.size_label,
          quantity,
          is_customized: true,
          customization_option_id: selectedOption.id,
          custom_text: customText,
          custom_note: customNote,
          design_id: selectedDesign?.id || null,
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
          Choose your base, color, size, and design placement. Preview the vibe
          before adding it to your cart.
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
            <div
              style={{
                ...styles.colorGlow,
                background: selectedColorHex,
              }}
            />

            <div
              style={{
                ...styles.hoodieFrame,
                background: `linear-gradient(145deg, ${selectedColorHex}, #f7f3ec)`,
              }}
            >
              <img src={hoodieImg} alt="Hoodie preview" style={styles.hoodieImg} />

              <div style={styles.textOverlay}>
                {textPreview}
              </div>
            </div>

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
                  {config?.colors?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedColor(c)}
                      title={c.color_name}
                      style={{
                        ...styles.swatch,
                        background: c.color_hex || "#ccc",
                        border:
                          selectedColor?.id === c.id
                            ? "3px solid #111"
                            : "1px solid #ddd",
                      }}
                    />
                  ))}
                </div>
                <p style={styles.muted}>{selectedColor?.color_name}</p>
              </div>

              <div style={styles.controlBlock}>
                <label style={styles.label}>Size</label>
                <div style={styles.sizeGrid}>
                  {config?.sizes?.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSize(s)}
                      style={{
                        ...styles.sizeBtn,
                        background: selectedSize?.id === s.id ? "#111" : "#fff",
                        color: selectedSize?.id === s.id ? "#fff" : "#111",
                      }}
                    >
                      {s.size_label}
                    </button>
                  ))}
                </div>
              </div>

              {showDesignSection && (
                <div style={styles.controlBlock}>
                  <label style={styles.label}>Choose Your Design</label>

                  {isDesignPickerOpen ? (
                    <>
                      <div style={styles.collectionTabs}>
                        {config.collections.map((collection) => (
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
                        (activeCollection.designs.length === 0 ? (
                          <p style={styles.muted}>
                            No designs available in this collection yet.
                          </p>
                        ) : (
                          <div style={styles.designCardGrid}>
                            {activeCollection.designs.map((design) => (
                              <button
                                key={design.id}
                                onClick={() => {
                                  setSelectedDesign(design);
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
                            <strong>{selectedDesign.name}</strong>
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

              <div style={styles.controlBlock}>
                <label style={styles.label}>Design Placement</label>
                <div style={styles.optionList}>
                  {config?.options?.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelectedOption(o)}
                      style={{
                        ...styles.optionCard,
                        border:
                          selectedOption?.id === o.id
                            ? "2px solid #111"
                            : "1px solid #e5e0d8",
                      }}
                    >
                      <span>{o.option_label}</span>
                      <small>{o.description}</small>
                      <strong>+${Number(o.extra_price || 0).toFixed(2)}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.controlBlock}>
                <label style={styles.label}>Custom Text</label>
                <input
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Example: SIMPLICITY"
                  maxLength={30}
                  style={styles.input}
                />
              </div>

              <div style={styles.controlBlock}>
                <label style={styles.label}>Design Notes</label>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Example: make the text small, centered, and clean..."
                  style={styles.textarea}
                />
              </div>

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

              <button
                onClick={handleAddToCart}
                disabled={adding || isProductOutOfStock(product)}
                style={{
                  ...styles.addBtn,
                  opacity: adding || isProductOutOfStock(product) ? 0.6 : 1,
                  cursor: isProductOutOfStock(product) ? "not-allowed" : "pointer",
                }}
              >
                {isProductOutOfStock(product)
                  ? "Out of Stock"
                  : adding
                  ? "Adding..."
                  : "Add Customized Hoodie"}
              </button>

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
    fontSize: "56px",
    fontWeight: 400,
    margin: "10px 0",
    letterSpacing: "0.05em",
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
    position: "relative",
    minHeight: "470px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background:
      "radial-gradient(circle at 20% 20%, #f0dfb7, transparent 28%), linear-gradient(135deg, #f8f4ed, #ffffff)",
  },
  colorGlow: {
    position: "absolute",
    width: "280px",
    height: "280px",
    borderRadius: "50%",
    opacity: 0.18,
    filter: "blur(20px)",
  },
  hoodieFrame: {
    position: "relative",
    width: "320px",
    height: "380px",
    borderRadius: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 30px 80px rgba(0,0,0,0.16)",
    overflow: "hidden",
  },
  hoodieImg: {
    width: "90%",
    objectFit: "contain",
    position: "relative",
    zIndex: 2,
  },
  textOverlay: {
    position: "absolute",
    top: "43%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 3,
    color: "#111",
    background: "rgba(255,255,255,0.74)",
    padding: "6px 12px",
    borderRadius: "2px",
    fontSize: "12px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    maxWidth: "150px",
    textAlign: "center",
  },
  previewInfo: {
    position: "absolute",
    bottom: "24px",
    left: "24px",
    right: "24px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    color: "#555",
    fontSize: "13px",
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
  optionList: {
    display: "grid",
    gap: "10px",
  },
  optionCard: {
    textAlign: "left",
    background: "#fff",
    padding: "14px",
    cursor: "pointer",
    display: "grid",
    gap: "5px",
    fontFamily: "Georgia, serif",
  },
  input: {
    width: "100%",
    padding: "14px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
  },
  textarea: {
    width: "100%",
    minHeight: "90px",
    padding: "14px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
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