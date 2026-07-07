import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const gold = "#C9A84C";
const offWhite = "#F7F5F0";
const black = "#0D0D0D";
const midGray = "#888";
const lightGray = "#E8E5DF";

const styles = {
  page: {
    backgroundColor: offWhite,
    color: black,
    fontFamily: "'Georgia', 'Times New Roman', serif",
    overflowX: "hidden",
  },

  // ─── ANNOUNCEMENT ───────────────────────────────────────
  announcementBar: {
    textAlign: "center",
    padding: "10px 8vw",
    backgroundColor: black,
    color: gold,
    fontSize: "0.72rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    fontStyle: "italic",
  },

  // ─── HERO ───────────────────────────────────────────────
  hero: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "0 8vw",
    overflow: "hidden",
  },
  heroImage: {
    position: "absolute",
    top: 0,
    right: 0,
    height: "100%",
    width: "45%",
    objectFit: "cover",
    opacity: 0.9,
    zIndex: 0,
  },
  heroAccentLine: {
    position: "absolute",
    top: 0,
    right: "12vw",
    width: "1px",
    height: "100%",
    background: `linear-gradient(to bottom, transparent, ${gold}44, transparent)`,
    pointerEvents: "none",
  },
  heroAccentLineLeft: {
    position: "absolute",
    top: 0,
    left: "4vw",
    width: "1px",
    height: "100%",
    background: `linear-gradient(to bottom, transparent, ${gold}22, transparent)`,
    pointerEvents: "none",
  },
  heroWatermark: {
    position: "absolute",
    right: "-2vw",
    top: "50%",
    transform: "translateY(-50%) rotate(90deg)",
    fontSize: "clamp(5rem, 15vw, 14rem)",
    fontFamily: "'Georgia', serif",
    fontStyle: "italic",
    color: "transparent",
    WebkitTextStroke: `1px ${gold}22`,
    letterSpacing: "0.15em",
    whiteSpace: "nowrap",
    userSelect: "none",
    pointerEvents: "none",
    zIndex: 0,
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    maxWidth: "680px",
  },
  heroEyebrow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "2rem",
  },
  heroEyebrowLine: {
    width: "40px",
    height: "1px",
    backgroundColor: gold,
  },
  heroEyebrowText: {
    fontSize: "0.7rem",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color: gold,
    fontFamily: "'Georgia', serif",
    fontStyle: "italic",
  },
  heroHeadline: {
    fontSize: "clamp(3.2rem, 7vw, 7rem)",
    fontWeight: 400,
    lineHeight: 1.0,
    letterSpacing: "-0.02em",
    marginBottom: "1.8rem",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    color: black,
  },
  heroHeadlineItalic: {
    fontStyle: "italic",
    color: gold,
  },
  heroSubtitle: {
    fontSize: "clamp(0.95rem, 1.4vw, 1.1rem)",
    lineHeight: 1.75,
    color: "#555",
    maxWidth: "460px",
    marginBottom: "3rem",
    fontFamily: "'Georgia', serif",
    fontStyle: "italic",
    letterSpacing: "0.01em",
  },
  heroCta: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  btnPrimary: {
    backgroundColor: black,
    color: offWhite,
    border: "none",
    padding: "16px 40px",
    fontSize: "0.72rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "background 0.25s, transform 0.2s",
    fontFamily: "'Georgia', serif",
  },
  btnSecondary: {
    backgroundColor: "transparent",
    color: black,
    border: `1px solid ${gold}`,
    padding: "15px 36px",
    fontSize: "0.72rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "background 0.25s, color 0.25s",
    fontFamily: "'Georgia', serif",
  },
  heroScroll: {
    position: "absolute",
    bottom: "3rem",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    zIndex: 1,
  },
  heroScrollText: {
    fontSize: "0.62rem",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color: midGray,
  },
  heroScrollBar: {
    width: "1px",
    height: "48px",
    background: `linear-gradient(to bottom, ${gold}, transparent)`,
    animation: "scrollPulse 2s ease-in-out infinite",
  },

  // ─── DIVIDER ────────────────────────────────────────────
  divider: {
    display: "flex",
    alignItems: "center",
    padding: "0 8vw",
    gap: "20px",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: lightGray,
  },
  dividerGem: {
    width: "6px",
    height: "6px",
    backgroundColor: gold,
    transform: "rotate(45deg)",
    flexShrink: 0,
  },

  // ─── CATEGORIES ─────────────────────────────────────────
  categories: {
    padding: "7rem 8vw",
  },
  sectionLabel: {
    fontSize: "0.65rem",
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color: gold,
    fontStyle: "italic",
    marginBottom: "0.6rem",
    display: "block",
  },
  sectionTitle: {
    fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
    fontWeight: 400,
    letterSpacing: "-0.01em",
    marginBottom: "3.5rem",
    fontFamily: "'Georgia', serif",
    color: black,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "2px",
  },
  card: {
    position: "relative",
    backgroundColor: black,
    overflow: "hidden",
    cursor: "pointer",
    aspectRatio: "3/4",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    padding: "2rem",
    transition: "transform 0.35s ease",
  },
  cardOverlay: {
    position: "absolute",
    inset: 0,
    background: `linear-gradient(to top, ${black}EE 0%, ${black}55 50%, transparent 100%)`,
    zIndex: 1,
    transition: "opacity 0.35s",
  },
  cardPatternMen: {
    position: "absolute",
    inset: 0,
    background: `
      repeating-linear-gradient(
        45deg,
        #1a1a1a 0px, #1a1a1a 1px,
        transparent 1px, transparent 18px
      ),
      repeating-linear-gradient(
        -45deg,
        #1a1a1a 0px, #1a1a1a 1px,
        transparent 1px, transparent 18px
      )
    `,
    backgroundColor: "#111",
  },
  cardPatternWomen: {
    position: "absolute",
    inset: 0,
    background: `
      radial-gradient(ellipse at 30% 40%, #2a2218 0%, #0d0d0d 60%),
      repeating-linear-gradient(
        90deg,
        transparent 0px, transparent 30px,
        #1a1710 30px, #1a1710 31px
      )
    `,
  },
  cardPatternStudio: {
    position: "absolute",
    inset: 0,
    background: `
      radial-gradient(circle at 70% 60%, #1c1508 0%, #0d0d0d 70%),
      repeating-linear-gradient(
        0deg,
        transparent 0px, transparent 20px,
        #1a1200 20px, #1a1200 21px
      )
    `,
  },
  cardContent: {
    position: "relative",
    zIndex: 2,
  },
  cardTag: {
    fontSize: "0.6rem",
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color: gold,
    marginBottom: "0.5rem",
    display: "block",
    fontStyle: "italic",
  },
  cardTitle: {
    fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
    fontWeight: 400,
    color: offWhite,
    fontFamily: "'Georgia', serif",
    marginBottom: "0.8rem",
    lineHeight: 1.1,
  },
  cardArrow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "0.65rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: gold,
    transition: "gap 0.25s",
  },
  cardArrowLine: {
    width: "24px",
    height: "1px",
    backgroundColor: gold,
    transition: "width 0.25s",
  },

  // ─── BEST SELLERS ───────────────────────────────────────
  bestSellers: {
    padding: "0 8vw 7rem",
  },
  bestSellerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "2rem",
  },
  bestSellerCard: {
    background: "#fff",
    border: `1px solid ${lightGray}`,
    display: "flex",
    flexDirection: "column",
    cursor: "pointer",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  bestSellerImageWrap: {
    width: "100%",
    aspectRatio: "3/4",
    background: lightGray,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bestSellerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  bestSellerImagePlaceholder: {
    fontSize: "0.65rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: midGray,
  },
  bestSellerBody: {
    padding: "1.4rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  bestSellerName: {
    fontSize: "1rem",
    fontWeight: 400,
    color: black,
    fontFamily: "'Georgia', serif",
    margin: 0,
  },
  bestSellerPrice: {
    fontSize: "0.85rem",
    color: gold,
    letterSpacing: "0.05em",
  },
  bestSellerBtn: {
    marginTop: "0.6rem",
    background: "transparent",
    border: `1px solid ${black}`,
    color: black,
    padding: "10px 0",
    fontSize: "0.65rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "background 0.25s, color 0.25s",
    fontFamily: "'Georgia', serif",
  },

  // ─── FEATURES ────────────────────────────────────────────
  features: {
    padding: "6rem 8vw 7rem",
    backgroundColor: black,
    color: offWhite,
    position: "relative",
    overflow: "hidden",
  },
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "5rem 6rem",
    marginTop: "4rem",
    position: "relative",
    zIndex: 1,
  },
  featuresAccent: {
    position: "absolute",
    top: "-40%",
    right: "-10%",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${gold}0D 0%, transparent 70%)`,
    pointerEvents: "none",
  },
  featureItem: {
    borderTop: `1px solid #ffffff15`,
    paddingTop: "2rem",
  },
  featureNum: {
    fontSize: "0.65rem",
    letterSpacing: "0.3em",
    color: gold,
    marginBottom: "1.2rem",
    display: "block",
    fontStyle: "italic",
  },
  featureTitle: {
    fontSize: "1.15rem",
    fontWeight: 400,
    fontFamily: "'Georgia', serif",
    marginBottom: "0.8rem",
    color: offWhite,
    letterSpacing: "-0.01em",
  },
  featureDesc: {
    fontSize: "0.88rem",
    lineHeight: 1.7,
    color: "#999",
    fontStyle: "italic",
    letterSpacing: "0.01em",
  },
  featuresLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },

  // ─── FOOTER CTA ──────────────────────────────────────────
  footerCta: {
    padding: "8rem 8vw",
    textAlign: "center",
    position: "relative",
  },
  footerCtaDecor: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "600px",
    height: "300px",
    background: `radial-gradient(ellipse, ${gold}08 0%, transparent 70%)`,
    pointerEvents: "none",
  },
  footerCtaLabel: {
    fontSize: "0.65rem",
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color: gold,
    fontStyle: "italic",
    marginBottom: "1.5rem",
    display: "block",
  },
  footerCtaHeadline: {
    fontSize: "clamp(2rem, 5vw, 4rem)",
    fontWeight: 400,
    fontFamily: "'Georgia', serif",
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    marginBottom: "2.5rem",
    color: black,
  },
  footerCtaItalic: {
    fontStyle: "italic",
    color: gold,
  },
  footerCtaButtons: {
    display: "flex",
    justifyContent: "center",
    gap: "16px",
    flexWrap: "wrap",
  },

  // ─── BOTTOM BAR ──────────────────────────────────────────
  bottomBar: {
    borderTop: `1px solid ${lightGray}`,
    padding: "1.5rem 8vw",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1rem",
  },
  bottomBarBrand: {
    fontSize: "0.65rem",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color: midGray,
    fontStyle: "italic",
  },
  bottomBarCopy: {
    fontSize: "0.65rem",
    color: midGray,
    letterSpacing: "0.05em",
  },
};

// Keyframes injected once
const keyframesCSS = `
  @keyframes scrollPulse {
    0%, 100% { opacity: 0.4; transform: scaleY(0.85); }
    50% { opacity: 1; transform: scaleY(1); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .simplicity-hero-content > * {
    animation: fadeUp 0.8s ease both;
  }
  .simplicity-hero-content > *:nth-child(1) { animation-delay: 0.1s; }
  .simplicity-hero-content > *:nth-child(2) { animation-delay: 0.25s; }
  .simplicity-hero-content > *:nth-child(3) { animation-delay: 0.4s; }
  .simplicity-hero-content > *:nth-child(4) { animation-delay: 0.55s; }

  .simplicity-card:hover { transform: scale(1.015); }
  .simplicity-card:hover .simplicity-card-overlay { opacity: 0.85; }
  .simplicity-card:hover .simplicity-card-arrow-line { width: 40px; }
  .simplicity-card:hover .simplicity-card-arrow { gap: 14px; }

  .simplicity-btn-primary:hover { background: #2a2a2a; }
  .simplicity-btn-secondary:hover { background: ${gold}15; }

  .simplicity-bestseller-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); }
  .simplicity-bestseller-btn:hover { background: ${black}; color: ${offWhite}; }

  @media (max-width: 640px) {
    .simplicity-features-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
    .simplicity-footer-cta-btns { flex-direction: column; align-items: center; }
    .simplicity-bottom-bar { justify-content: center; text-align: center; }
  }
`;

export default function Home() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetch("http://localhost:5000/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  useEffect(() => {
    fetch("http://localhost:5000/api/homepage-settings")
      .then((res) => res.json())
      .then((data) => setSettings(data || {}))
      .catch((err) => console.error("Error fetching homepage settings:", err));
  }, []);

  const activeProducts = products.filter((p) => p.is_active !== false);
  const withImages = activeProducts.filter(
    (p) => p.main_image_url || p.image_url
  );
  const withoutImages = activeProducts.filter(
    (p) => !(p.main_image_url || p.image_url)
  );
  const bestSellers = [...withImages, ...withoutImages].slice(0, 4);

  const heroTitle = settings.hero_title || "Wear Less.";
  const heroHighlight = settings.hero_highlight || "Mean More.";
  const heroSubtitle =
    settings.hero_subtitle ||
    "Simplicity is a premium minimal clothing brand. Every piece is crafted for quiet confidence — and if you want something truly yours, our Custom Studio lets you choose from curated options approved by the brand.";
  const heroImageUrl = settings.hero_image_url || "";
  const primaryButtonText = settings.primary_button_text || "Shop Collection";
  const primaryButtonLink = settings.primary_button_link || "/products";
  const secondaryButtonText = settings.secondary_button_text || "Open Studio";
  const secondaryButtonLink = settings.secondary_button_link || "/customize";
  const announcementText = settings.announcement_text || "";

  return (
    <>
      <style>{keyframesCSS}</style>
      <div style={styles.page}>

        {/* ── ANNOUNCEMENT ── */}
        {announcementText && (
          <div style={styles.announcementBar}>{announcementText}</div>
        )}

        {/* ── HERO ── */}
        <section style={styles.hero}>
          <div style={styles.heroAccentLineLeft} />
          <div style={styles.heroAccentLine} />
          <div style={styles.heroWatermark} aria-hidden="true">Simplicity</div>

          {heroImageUrl && (
            <img src={heroImageUrl} alt="" style={styles.heroImage} />
          )}

          <div style={styles.heroContent} className="simplicity-hero-content">
            <div style={styles.heroEyebrow}>
              <span style={styles.heroEyebrowLine} />
              <span style={styles.heroEyebrowText}>Est. Premium Essentials</span>
            </div>

            <h1 style={styles.heroHeadline}>
              {heroTitle}<br />
              <em style={styles.heroHeadlineItalic}>{heroHighlight}</em>
            </h1>

            <p style={styles.heroSubtitle}>
              {heroSubtitle}
            </p>

            <div style={styles.heroCta}>
              <button
                className="simplicity-btn-primary"
                style={styles.btnPrimary}
                onClick={() => navigate(primaryButtonLink)}
              >
                {primaryButtonText}
              </button>
              <button
                className="simplicity-btn-secondary"
                style={styles.btnSecondary}
                onClick={() => navigate(secondaryButtonLink)}
              >
                {secondaryButtonText}
              </button>
            </div>
          </div>

          <div style={styles.heroScroll}>
            <span style={styles.heroScrollText}>Scroll</span>
            <div style={styles.heroScrollBar} />
          </div>
        </section>

        {/* ── DIVIDER ── */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <div style={styles.dividerGem} />
          <div style={styles.dividerLine} />
        </div>

        {/* ── CATEGORY CARDS ── */}
        <section style={styles.categories}>
          <span style={styles.sectionLabel}>Collections</span>
          <h2 style={styles.sectionTitle}>Shop by Category</h2>

          <div style={styles.cardsGrid}>
            {/* Men */}
            <div
              className="simplicity-card"
              style={styles.card}
              onClick={() => navigate("/men")}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && navigate("/men")}
            >
              <div style={styles.cardPatternMen} />
              <div className="simplicity-card-overlay" style={styles.cardOverlay} />
              <div style={styles.cardContent}>
                <span style={styles.cardTag}>Category 01</span>
                <h3 style={styles.cardTitle}>Men</h3>
                <div className="simplicity-card-arrow" style={styles.cardArrow}>
                  <span className="simplicity-card-arrow-line" style={styles.cardArrowLine} />
                  Explore
                </div>
              </div>
            </div>

            {/* Women */}
            <div
              className="simplicity-card"
              style={styles.card}
              onClick={() => navigate("/women")}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && navigate("/women")}
            >
              <div style={styles.cardPatternWomen} />
              <div className="simplicity-card-overlay" style={styles.cardOverlay} />
              <div style={styles.cardContent}>
                <span style={styles.cardTag}>Category 02</span>
                <h3 style={styles.cardTitle}>Women</h3>
                <div className="simplicity-card-arrow" style={styles.cardArrow}>
                  <span className="simplicity-card-arrow-line" style={styles.cardArrowLine} />
                  Explore
                </div>
              </div>
            </div>

            {/* Custom Studio */}
            <div
              className="simplicity-card"
              style={{ ...styles.card, gridColumn: "span 1" }}
              onClick={() => navigate("/customize")}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && navigate("/customize")}
            >
              <div style={styles.cardPatternStudio} />
              <div className="simplicity-card-overlay" style={styles.cardOverlay} />
              <div style={styles.cardContent}>
                <span style={styles.cardTag}>Bespoke 03</span>
                <h3 style={styles.cardTitle}>Custom<br />Studio</h3>
                <div className="simplicity-card-arrow" style={styles.cardArrow}>
                  <span className="simplicity-card-arrow-line" style={styles.cardArrowLine} />
                  Design Yours
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── BEST SELLERS ── */}
        {bestSellers.length > 0 && (
          <section style={styles.bestSellers}>
            <span style={styles.sectionLabel}>Customer Favorites</span>
            <h2 style={styles.sectionTitle}>Best Sellers</h2>

            <div style={styles.bestSellerGrid}>
              {bestSellers.map((product) => {
                const displayImageUrl =
                  product.main_image_url || product.image_url;

                return (
                  <div
                    key={product.id}
                    className="simplicity-bestseller-card"
                    style={styles.bestSellerCard}
                  >
                    <div style={styles.bestSellerImageWrap}>
                      {displayImageUrl ? (
                        <img
                          src={displayImageUrl}
                          alt={product.name}
                          style={styles.bestSellerImage}
                        />
                      ) : (
                        <span style={styles.bestSellerImagePlaceholder}>
                          No Image
                        </span>
                      )}
                    </div>

                    <div style={styles.bestSellerBody}>
                      <h3 style={styles.bestSellerName}>{product.name}</h3>
                      <span style={styles.bestSellerPrice}>
                        {product.base_price !== undefined &&
                        product.base_price !== null
                          ? `$${Number(product.base_price).toFixed(2)}`
                          : "—"}
                      </span>
                      <button
                        className="simplicity-bestseller-btn"
                        style={styles.bestSellerBtn}
                        onClick={() => navigate(`/products/${product.id}`)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── FEATURES ── */}
        <section style={styles.features}>
          <div style={styles.featuresAccent} />
          <div style={styles.featuresLabelRow}>
            <span style={{ ...styles.heroEyebrowLine, backgroundColor: gold }} />
            <span style={{ ...styles.sectionLabel, margin: 0, color: gold }}>
              How It Works
            </span>
          </div>
          <h2 style={{ ...styles.sectionTitle, color: offWhite, marginTop: "0.6rem" }}>
            The Full Experience
          </h2>

          <div
            className="simplicity-features-grid"
            style={styles.featuresGrid}
          >
            {[
              {
                num: "01",
                title: "Browse & Discover",
                desc: "Explore our curated Men's and Women's collections — minimal essentials built for everyday elegance.",
              },
              {
                num: "02",
                title: "Customize Your Hoodie",
                desc: "Select a hoodie and head to the Custom Studio.Choose from available colors, sizes, and brand-approved design options — make it unmistakably yours.",
              },
              {
                num: "03",
                title: "Add to Cart & Checkout",
                desc: "Seamlessly add items — standard or custom — to your cart and complete your order in a few clean steps.",
              },
              {
                num: "04",
                title: "Track Your Order",
                desc: "Your Dashboard keeps every order in view. Admins manage products, orders, and studio settings from their own control panel.",
              },
            ].map(f => (
              <div key={f.num} style={styles.featureItem}>
                <span style={styles.featureNum}>{f.num}</span>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER CTA ── */}
        <section style={styles.footerCta}>
          <div style={styles.footerCtaDecor} />
          <span style={{ ...styles.footerCtaLabel, position: "relative", zIndex: 1 }}>
            Ready to Begin
          </span>
          <h2 style={{ ...styles.footerCtaHeadline, position: "relative", zIndex: 1 }}>
            Your wardrobe.<br />
            <em style={styles.footerCtaItalic}>Your rules.</em>
          </h2>
          <div
            className="simplicity-footer-cta-btns"
            style={{ ...styles.footerCtaButtons, position: "relative", zIndex: 1 }}
          >
            <button
              className="simplicity-btn-primary"
              style={styles.btnPrimary}
              onClick={() => navigate("/products")}
            >
              Shop Now
            </button>
            <button
              className="simplicity-btn-secondary"
              style={styles.btnSecondary}
              onClick={() => navigate("/customize")}
            >
              Open Studio
            </button>
          </div>
        </section>

        {/* ── BOTTOM BAR ── */}
        <div className="simplicity-bottom-bar" style={styles.bottomBar}>
          <span style={styles.bottomBarBrand}>Simplicity — Premium Essentials</span>
          <span style={styles.bottomBarCopy}>© {new Date().getFullYear()} Simplicity. All rights reserved.</span>
        </div>

      </div>
    </>
  );
}