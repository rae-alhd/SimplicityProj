import { Link, useNavigate } from "react-router-dom";

const cardStyle = {
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  cursor: "pointer",
  transition: "transform 0.25s ease, box-shadow 0.25s ease",
};

const imageWrapStyle = {
  width: "100%",
  aspectRatio: "3 / 4",
  background: "#f0eeeb",
  overflow: "hidden",
  position: "relative",
};

const imgStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
  transition: "transform 0.4s ease",
};

const placeholderStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ece9e4",
  color: "#aaa9a5",
  fontSize: "12px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
};

const infoStyle = {
  padding: "16px 4px 20px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const categoryStyle = {
  fontSize: "10px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#999",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
};

const nameStyle = {
  fontSize: "15px",
  fontWeight: "500",
  color: "#1a1a1a",
  letterSpacing: "0.03em",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  lineHeight: 1.3,
};

const priceStyle = {
  fontSize: "14px",
  color: "#1a1a1a",
  letterSpacing: "0.05em",
  fontFamily: "Georgia, serif",
  marginTop: "2px",
};

const customizationLabelStyle = {
  fontSize: "10px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  marginTop: "2px",
};

const outOfStockBadgeStyle = {
  position: "absolute",
  top: "10px",
  left: "10px",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: "9px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  padding: "4px 8px",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  zIndex: 1,
  // Sits visually above the image but must never intercept the click —
  // the image area underneath stays fully clickable through it.
  pointerEvents: "none",
};

const imageLinkStyle = {
  display: "block",
  width: "100%",
  height: "100%",
  cursor: "pointer",
};

const btnStyle = {
  marginTop: "12px",
  padding: "10px 0",
  background: "#1a1a1a",
  color: "#fff",
  border: "none",
  fontSize: "10px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  transition: "background 0.2s ease",
  width: "100%",
};

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const displayImageUrl = product.main_image_url || product.image_url;
  const isOutOfStock = Number(product.stock_quantity || 0) <= 0;

  const handleClick = () => {
    navigate(`/products/${product.id}`);
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.07)";
        const img = e.currentTarget.querySelector("img");
        if (img) img.style.transform = "scale(1.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        const img = e.currentTarget.querySelector("img");
        if (img) img.style.transform = "scale(1)";
      }}
    >
      <div style={imageWrapStyle}>
        {isOutOfStock && (
          <span style={outOfStockBadgeStyle}>Out of Stock</span>
        )}
        {/* Same destination as the View Details button below — clicking
            the image opens the product page. Img + placeholder stay
            siblings inside the Link so the existing onError swap still
            works exactly as before. */}
        <Link
          to={`/products/${product.id}`}
          style={imageLinkStyle}
          aria-label={`View details for ${product.name}`}
        >
          {displayImageUrl ? (
            <img
              src={displayImageUrl}
              alt={product.name}
              style={imgStyle}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            style={{
              ...placeholderStyle,
              display: displayImageUrl ? "none" : "flex",
            }}
          >
            No Image
          </div>
        </Link>
      </div>

      <div style={infoStyle}>
        {product.category && (
          <span style={categoryStyle}>{product.category}</span>
        )}
        <span style={nameStyle}>{product.name}</span>
        <span style={priceStyle}>
          {product.base_price !== undefined && product.base_price !== null
            ? `$${Number(product.base_price).toFixed(2)}`
            : "—"}
        </span>
        <span
          style={{
            ...customizationLabelStyle,
            color: product.is_customizable ? "#1a1a1a" : "#999",
          }}
        >
          {product.is_customizable
            ? "Customization available"
            : "Ready-to-wear only"}
        </span>
        <button
          style={btnStyle}
          onClick={handleClick}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#444")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
        >
          View Details
        </button>
      </div>
    </div>
  );
}