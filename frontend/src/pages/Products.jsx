import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#e8d5a3";
const OFF_WHITE = "#F9F7F4";
const CHARCOAL = "#1a1a1a";
const MID_GRAY = "#888";
const BORDER = "#e8e4df";

const styles = {
  page: {
    backgroundColor: OFF_WHITE,
    minHeight: "100vh",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    color: CHARCOAL,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    padding: "96px 40px 72px",
    textAlign: "center",
    borderBottom: `1px solid ${BORDER}`,
    position: "relative",
    overflow: "hidden",
  },
  heroLabel: {
    display: "inline-block",
    fontSize: "10px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontWeight: 600,
    letterSpacing: "4px",
    textTransform: "uppercase",
    color: GOLD,
    marginBottom: "24px",
    padding: "6px 14px",
    border: `1px solid ${GOLD_LIGHT}`,
  },
  heroTitle: {
    fontSize: "clamp(42px, 7vw, 88px)",
    fontWeight: 400,
    letterSpacing: "-1px",
    lineHeight: 1.05,
    margin: "0 0 20px",
    color: CHARCOAL,
  },
  heroTitleItalic: {
    fontStyle: "italic",
    color: GOLD,
  },
  heroSubtitle: {
    fontSize: "15px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontWeight: 300,
    color: MID_GRAY,
    letterSpacing: "0.5px",
    maxWidth: "480px",
    margin: "0 auto",
    lineHeight: 1.7,
  },
  heroDivider: {
    width: "40px",
    height: "1px",
    background: GOLD,
    margin: "32px auto 0",
  },

  // ── Filters / Count bar ────────────────────────────────────────────────────
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 40px",
    borderBottom: `1px solid ${BORDER}`,
    flexWrap: "wrap",
    gap: "12px",
  },
  barCount: {
    fontSize: "11px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: MID_GRAY,
  },
  barGold: { color: GOLD, fontWeight: 600 },

  // ── Grid ──────────────────────────────────────────────────────────────────
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "0",
    padding: "0",
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    cursor: "pointer",
    position: "relative",
    borderRight: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
    backgroundColor: "#fff",
    transition: "background-color 0.25s ease",
    display: "flex",
    flexDirection: "column",
  },

  imageWrap: {
    position: "relative",
    width: "100%",
    paddingBottom: "125%", // 4:5 portrait ratio
    overflow: "hidden",
    backgroundColor: "#f0ede8",
  },
  image: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transition: "transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  },

  // Placeholder SVG container
  placeholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ece9e3",
    gap: "8px",
  },
  placeholderText: {
    fontSize: "9px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    letterSpacing: "3px",
    textTransform: "uppercase",
    color: "#bbb",
    marginTop: "6px",
  },

  customBadge: {
    position: "absolute",
    top: "12px",
    left: "12px",
    backgroundColor: GOLD,
    color: "#fff",
    fontSize: "8px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontWeight: 700,
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    padding: "4px 8px",
    zIndex: 2,
  },
  outOfStockBadge: {
    position: "absolute",
    top: "12px",
    right: "12px",
    backgroundColor: CHARCOAL,
    color: "#fff",
    fontSize: "8px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontWeight: 700,
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    padding: "4px 8px",
    zIndex: 2,
  },
  btnDisabled: {
    backgroundColor: "#ccc",
    color: "#fff",
    cursor: "not-allowed",
  },

  cardBody: {
    padding: "20px 22px 24px",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },
  cardMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  cardCategory: {
    fontSize: "9px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    color: MID_GRAY,
  },
  cardTarget: {
    fontSize: "9px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: GOLD,
    border: `1px solid ${GOLD_LIGHT}`,
    padding: "2px 6px",
  },
  cardName: {
    fontSize: "17px",
    fontWeight: 400,
    margin: "0 0 6px",
    lineHeight: 1.3,
    letterSpacing: "-0.2px",
    color: CHARCOAL,
  },
  cardPrice: {
    fontSize: "13px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontWeight: 300,
    color: MID_GRAY,
    marginBottom: "18px",
    letterSpacing: "0.5px",
  },
  cardCustomizationLabel: {
    fontSize: "10px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontWeight: 400,
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "14px",
  },

  btnBase: {
    display: "block",
    width: "100%",
    padding: "11px 0",
    fontSize: "9px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontWeight: 700,
    letterSpacing: "3px",
    textTransform: "uppercase",
    textAlign: "center",
    cursor: "pointer",
    border: "none",
    transition: "background-color 0.2s ease, color 0.2s ease",
    marginTop: "auto",
  },
  btnDetails: {
    backgroundColor: CHARCOAL,
    color: "#fff",
  },
  btnCustomize: {
    backgroundColor: GOLD,
    color: "#fff",
  },

  // ── States ─────────────────────────────────────────────────────────────────
  loading: {
    textAlign: "center",
    padding: "120px 40px",
  },
  loadingDot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: GOLD,
    margin: "0 4px",
    animation: "pulse 1.2s ease-in-out infinite",
  },
  error: {
    textAlign: "center",
    padding: "80px 40px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontSize: "13px",
    color: "#c0392b",
    letterSpacing: "0.5px",
  },
  empty: {
    textAlign: "center",
    padding: "80px 40px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    fontSize: "13px",
    color: MID_GRAY,
    letterSpacing: "1px",
  },

  footer: {
    textAlign: "center",
    padding: "48px 40px",
    borderTop: `1px solid ${BORDER}`,
    fontSize: "10px",
    fontFamily: "'Helvetica Neue', Helvetica, sans-serif",
    letterSpacing: "3px",
    textTransform: "uppercase",
    color: "#ccc",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PlaceholderImage() {
  return (
    <div style={styles.placeholder}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="6" y="4" width="24" height="28" rx="1" stroke="#ccc" strokeWidth="1" fill="none" />
        <path d="M13 4 C13 4 13 10 18 12 C23 10 23 4 23 4" stroke="#ccc" strokeWidth="1" fill="none" />
        <line x1="11" y1="18" x2="25" y2="18" stroke="#ddd" strokeWidth="0.8" />
        <line x1="11" y1="22" x2="22" y2="22" stroke="#ddd" strokeWidth="0.8" />
      </svg>
      <span style={styles.placeholderText}>Simplicity</span>
    </div>
  );
}

function ProductCard({ product, navigate }) {
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  const handleCardClick = () => {
    navigate(`/products/${product.id}`);
  };

  const handleCustomize = (e) => {
    e.stopPropagation();
    navigate(`/customize?id=${product.id}`);
  };

  const formatPrice = (price) => {
    if (price == null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const isCustomizable = !!product.is_customizable;
  const isOutOfStock = Number(product.stock_quantity || 0) <= 0;
  const displayImageUrl = product.main_image_url || product.image_url;

  return (
    <div
      style={{
        ...styles.card,
        backgroundColor: hovered ? "#fdfcfa" : "#fff",
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div style={styles.imageWrap}>
        {isCustomizable && <span style={styles.customBadge}>Custom</span>}
        {isOutOfStock && (
          <span style={styles.outOfStockBadge}>Out of Stock</span>
        )}

        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={product.name}
            style={{
              ...styles.image,
              transform: hovered ? "scale(1.06)" : "scale(1)",
            }}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling && (e.target.nextSibling.style.display = "flex");
            }}
          />
        ) : (
          <PlaceholderImage />
        )}
      </div>

      {/* Body */}
      <div style={styles.cardBody}>
        <div style={styles.cardMeta}>
          <span style={styles.cardCategory}>{product.category || "Uncategorized"}</span>
          {product.target_group && (
            <span style={styles.cardTarget}>{product.target_group}</span>
          )}
        </div>

        <h3 style={styles.cardName}>{product.name}</h3>
        <p style={styles.cardPrice}>{formatPrice(product.base_price)}</p>
        <p
          style={{
            ...styles.cardCustomizationLabel,
            color: isCustomizable ? GOLD : MID_GRAY,
          }}
        >
          {isCustomizable ? "Customization available" : "Ready-to-wear only"}
        </p>

        {isCustomizable ? (
          isOutOfStock ? (
            <button
              style={{ ...styles.btnBase, ...styles.btnDisabled }}
              onClick={(e) => e.stopPropagation()}
              disabled
            >
              Out of Stock
            </button>
          ) : (
            <button
              style={{
                ...styles.btnBase,
                ...styles.btnCustomize,
                opacity: btnHovered ? 0.85 : 1,
              }}
              onClick={handleCustomize}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
            >
              Customize
            </button>
          )
        ) : (
          <button
            style={{
              ...styles.btnBase,
              ...styles.btnDetails,
              opacity: btnHovered ? 0.82 : 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data.products ?? [];
        const active = list.filter(
          (p) => p.is_active === undefined || p.is_active === true || p.is_active === 1
        );
        setProducts(active);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
        @media (max-width: 600px) {
          .simplicity-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 400px) {
          .simplicity-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={styles.page}>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section style={styles.hero}>
          <div style={styles.heroLabel}>The Collection</div>
          <h1 style={styles.heroTitle}>
            Dressed in&nbsp;
            <span style={styles.heroTitleItalic}>Simplicity</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Thoughtfully made pieces for everyday moments — where craft meets quiet confidence.
          </p>
          <div style={styles.heroDivider} />
        </section>

        {/* ── Count bar ────────────────────────────────────────────────── */}
        {!loading && !error && (
          <div style={styles.bar}>
            <span style={styles.barCount}>
              <span style={styles.barGold}>{products.length}</span>&nbsp; pieces available
            </span>
            <span style={styles.barCount} aria-hidden="true">
              ✦&nbsp; New arrivals weekly
            </span>
          </div>
        )}

        {/* ── States ───────────────────────────────────────────────────── */}
        {loading && (
          <div style={styles.loading}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  ...styles.loadingDot,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={styles.error}>
            Unable to load products — {error}
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div style={styles.empty}>No products available at this time.</div>
        )}

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        {!loading && !error && products.length > 0 && (
          <main
            className="simplicity-grid"
            style={{
              ...styles.grid,
              borderTop: `1px solid ${BORDER}`,
              borderLeft: `1px solid ${BORDER}`,
            }}
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product} navigate={navigate} />
            ))}
          </main>
        )}

        {/* ── Footer mark ──────────────────────────────────────────────── */}
        <footer style={styles.footer}>
          Simplicity &nbsp;·&nbsp; Est. 2024
        </footer>
      </div>
    </>
  );
}