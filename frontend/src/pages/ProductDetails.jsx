import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

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
  imageWrap: {
    width: "100%",
    aspectRatio: "3 / 4",
    background: "#f0eeeb",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#ece9e4",
    gap: "12px",
  },
  placeholderIcon: {
    width: "40px",
    height: "40px",
    opacity: 0.25,
  },
  placeholderText: {
    fontSize: "11px",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#aaa",
    fontFamily: FONT,
  },
  thumbRow: {
    display: "flex",
    gap: "8px",
    marginTop: "12px",
  },
  thumbBtn: (selected) => ({
    width: "64px",
    height: "80px",
    padding: 0,
    border: selected ? "1.5px solid #1a1a1a" : "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    overflow: "hidden",
  }),
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
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
    marginBottom: "28px",
    fontFamily: FONT,
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
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];

export default function ProductDetails({ fetchCart }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedSize, setSelectedSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("http://localhost:5000/api/products")
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
    setSelectedImageUrl(product?.main_image_url || product?.image_url || null);
    setImgError(false);
  }, [product]);

  const handleAddToCart = async () => {
    if (!selectedSize) {
      alert("Please select a size.");
      return;
    }
  
    try {
      const token = localStorage.getItem("token");
  
      if (!token) {
        alert("Please login first to add items to your cart.");
        navigate("/login");
        return;
      }
  
      const res = await fetch("http://localhost:5000/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: product.id,
          color: "Default",
          size: selectedSize,
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

  const showImage = selectedImageUrl && !imgError;
  const hasMultipleImages = product.images && product.images.length > 1;

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
          <div style={s.imageWrap}>
            {showImage ? (
              <img
                src={selectedImageUrl}
                alt={product.name}
                style={s.image}
                onError={() => setImgError(true)}
              />
            ) : (
              <div style={s.placeholder}>
                <svg
                  style={s.placeholderIcon}
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="4" y="4" width="32" height="32" rx="1" stroke="#1a1a1a" strokeWidth="1.5" />
                  <circle cx="14" cy="14" r="3" stroke="#1a1a1a" strokeWidth="1.5" />
                  <path d="M4 28l9-8 6 6 5-4 12 10" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <span style={s.placeholderText}>No Image</span>
              </div>
            )}
          </div>

          {hasMultipleImages && (
            <div style={s.thumbRow}>
              {product.images.map((image) => (
                <button
                  key={image.id}
                  style={s.thumbBtn(image.image_url === selectedImageUrl)}
                  onClick={() => {
                    setSelectedImageUrl(image.image_url);
                    setImgError(false);
                  }}
                >
                  <img src={image.image_url} alt={product.name} style={s.thumbImg} />
                </button>
              ))}
            </div>
          )}
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

          <hr style={s.divider} />

          {/* Description */}
          {product.description && (
            <p style={s.description}>{product.description}</p>
          )}

          <hr style={s.divider} />

          {/* Size selector */}
          <span style={s.label}>
            Select Size
            {selectedSize && (
              <span style={{ color: "#1a1a1a", marginLeft: "10px" }}>
                — {selectedSize}
              </span>
            )}
          </span>
          <div style={s.sizeRow}>
            {SIZES.map((size) => (
              <button
                key={size}
                style={s.sizeBtn(selectedSize === size)}
                onClick={() => setSelectedSize(size)}
                onMouseEnter={(e) => {
                  if (selectedSize !== size) {
                    e.currentTarget.style.borderColor = "#1a1a1a";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedSize !== size) {
                    e.currentTarget.style.borderColor = "#ddd";
                  }
                }}
              >
                {size}
              </button>
            ))}
          </div>

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
              style={s.addToCart}
              onClick={handleAddToCart}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
            >
              Add to Cart
            </button>

            {product.is_customizable && (
              <button
                style={s.customize}
                onClick={handleCustomize}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1a1a1a";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.color = "#1a1a1a";
                }}
              >
                Customize This Product
              </button>
            )}
          </div>

          {added && (
            <p style={s.addedMsg}>Added to cart — {selectedSize} × {qty}</p>
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