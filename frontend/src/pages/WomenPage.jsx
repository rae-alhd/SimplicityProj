import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";

const pageStyle = {
  minHeight: "100vh",
  background: "#fff",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
};

const heroStyle = {
  borderBottom: "1px solid #e8e6e1",
  padding: "80px 60px 48px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const eyebrowStyle = {
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#999",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
};

const headingStyle = {
  fontSize: "clamp(36px, 5vw, 64px)",
  fontWeight: "300",
  color: "#1a1a1a",
  letterSpacing: "0.04em",
  lineHeight: 1.1,
  margin: 0,
  fontFamily: "'Cormorant Garamond', Georgia, serif",
};

const subheadStyle = {
  fontSize: "14px",
  color: "#888",
  letterSpacing: "0.06em",
  marginTop: "4px",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
};

const toolbarStyle = {
  padding: "24px 60px",
  borderBottom: "1px solid #f0eeeb",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const countStyle = {
  fontSize: "12px",
  letterSpacing: "0.1em",
  color: "#aaa",
  textTransform: "uppercase",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "40px 28px",
  padding: "48px 60px 80px",
};

const emptyStyle = {
  padding: "80px 60px",
  textAlign: "center",
  color: "#bbb",
  fontSize: "15px",
  letterSpacing: "0.08em",
};

const loaderStyle = {
  padding: "80px 60px",
  textAlign: "center",
  color: "#ccc",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
};

const errorStyle = {
  padding: "80px 60px",
  textAlign: "center",
  color: "#c0392b",
  fontSize: "13px",
  letterSpacing: "0.08em",
};

export default function WomenPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const filtered = data.filter((p) => {
            const activeOk =
              p.is_active === undefined || p.is_active === null || p.is_active === true;
          
            const target = String(p.target_group || "").toUpperCase();
          
            const groupOk =
              target === "WOMEN" || target === "UNISEX";
          
            return activeOk && groupOk;
          });
        setProducts(filtered);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={pageStyle}>
      {/* Google Font import */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap"
      />

      <div style={heroStyle}>
        <span style={eyebrowStyle}>Simplicity</span>
        <h1 style={headingStyle}>Women</h1>
        <p style={subheadStyle}>Enduring forms. Effortless presence.</p>
      </div>

      {!loading && !error && (
        <div style={toolbarStyle}>
          <span style={countStyle}>
            {products.length} {products.length === 1 ? "piece" : "pieces"}
          </span>
        </div>
      )}

      {loading && <div style={loaderStyle}>Loading collection…</div>}

      {error && (
        <div style={errorStyle}>
          Could not load products. {error}
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div style={emptyStyle}>No pieces available at this time.</div>
      )}

      {!loading && !error && products.length > 0 && (
        <div style={gridStyle}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}