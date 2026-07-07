import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import hoodieImg from "../assets/white-hoodie.png";

const API_BASE = "http://localhost:5000/api";

function CustomizePage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [config, setConfig] = useState(null);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [customText, setCustomText] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

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

        setLoadingConfig(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingConfig(false);
      });
  }, [selectedProductId]);

  const product = config?.product;

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
                <div style={styles.productCardGrid}>
                  {products.map((p) => {
                    const displayImageUrl = p.main_image_url || p.image_url;
                    const isSelected = selectedProductId === p.id;

                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProductId(p.id)}
                        style={{
                          ...styles.productCard,
                          border: isSelected
                            ? "2px solid #111"
                            : "1px solid #e5e0d8",
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
                      </button>
                    );
                  })}
                </div>
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
                disabled={adding}
                style={{
                  ...styles.addBtn,
                  opacity: adding ? 0.6 : 1,
                }}
              >
                {adding ? "Adding..." : "Add Customized Hoodie"}
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