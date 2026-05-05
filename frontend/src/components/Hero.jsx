import { Link } from "react-router-dom";

const GOLD = "#C9A84C";

const styles = {
  section: {
    backgroundColor: "#fff",
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    alignItems: "center",
    padding: "0 2rem",
    fontFamily: "'DM Sans', sans-serif",
  },
  inner: {
    maxWidth: "1280px",
    margin: "0 auto",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "4rem",
    padding: "6rem 0",
  },
  left: {
    flex: "1 1 45%",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: "0.7rem",
    fontWeight: 500,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: GOLD,
    marginBottom: "1.25rem",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  eyebrowLine: {
    width: "28px",
    height: "1px",
    backgroundColor: GOLD,
  },
  title: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "clamp(3rem, 5.5vw, 5rem)",
    fontWeight: 600,
    lineHeight: 1.05,
    color: "#111",
    marginBottom: "1.5rem",
  },
  titleAccent: {
    color: GOLD,
    fontStyle: "italic",
  },
  subtitle: {
    fontSize: "1rem",
    color: "#666",
    lineHeight: 1.7,
    marginBottom: "2.75rem",
    maxWidth: "380px",
  },
  buttonGroup: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  btn: {
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    padding: "13px 28px",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
    transition: "0.2s",
  },
  btnOutline: {
    border: "1px solid #ccc",
    color: "#111",
  },
  btnPrimary: {
    backgroundColor: "#111",
    color: "#fff",
    border: "1px solid #111",
  },
  btnGold: {
    backgroundColor: GOLD,
    color: "#fff",
    border: `1px solid ${GOLD}`,
  },
  right: {
    flex: "1 1 50%",
    display: "flex",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    maxWidth: "500px",
    objectFit: "cover",
  },
};

export default function Hero() {
  return (
    <section style={styles.section}>
      <div style={styles.inner} className="hero">
        
        {/* LEFT */}
        <div style={styles.left}>
          <span style={styles.eyebrow}>
            <span style={styles.eyebrowLine}></span>
            New Collection
          </span>

          <h1 style={styles.title}>
            Design Your <span style={styles.titleAccent}>Hoodie</span>
          </h1>

          <p style={styles.subtitle}>
            Built for you. Worn your way.
          </p>

          <div style={styles.buttonGroup}>
            <Link to="/men" style={{ ...styles.btn, ...styles.btnOutline }}>
              Shop Men
            </Link>

            <Link to="/women" style={{ ...styles.btn, ...styles.btnPrimary }}>
              Shop Women
            </Link>

            <Link to="/customize" style={{ ...styles.btn, ...styles.btnGold }}>
              Customize Hoodie
            </Link>
          </div>
        </div>

        {/* RIGHT */}
        <div style={styles.right}>
          <img
            src="https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=80"
            alt="Hoodie"
            style={styles.image}
          />
        </div>
      </div>
    </section>
  );
}