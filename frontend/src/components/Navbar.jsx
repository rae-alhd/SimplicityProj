import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
 
const GOLD = "#C9A84C";
 
const styles = {
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    backgroundColor: "#fff",
    borderBottom: "1px solid #f0f0f0",
    transition: "box-shadow 0.3s ease",
  },
  navScrolled: {
    boxShadow: "0 1px 12px rgba(0,0,0,0.07)",
  },
  inner: {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "0 2rem",
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: "1.5rem",
    fontWeight: 600,
    letterSpacing: "0.18em",
    color: "#111",
    textDecoration: "none",
    marginRight: "50px",
    textTransform: "uppercase",
  },
  logoAccent: {
    color: GOLD,
  },
  desktopLinks: {
    display: "flex",
    alignItems: "center",
    gap: "2.5rem",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  link: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#111",
    textDecoration: "none",
    position: "relative",
    paddingBottom: "3px",
    transition: "color 0.2s",
  },
  linkUnderline: {
    content: '""',
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: "1.5px",
    backgroundColor: GOLD,
    transform: "scaleX(0)",
    transformOrigin: "left",
    transition: "transform 0.25s ease",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "1.2rem",
  },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px",
    color: "#111",
    display: "flex",
    alignItems: "center",
    transition: "color 0.2s",
  },
  customizeBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#fff",
    backgroundColor: "#111",
    border: "1px solid #111",
    padding: "8px 20px",
    cursor: "pointer",
    transition: "background 0.2s, color 0.2s",
    textDecoration: "none",
  },
  hamburger: {
    display: "none",
    flexDirection: "column",
    gap: "5px",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px",
  },
  bar: {
    width: "22px",
    height: "1.5px",
    backgroundColor: "#111",
    transition: "transform 0.3s, opacity 0.3s",
    display: "block",
  },
  mobileMenu: {
    backgroundColor: "#fff",
    borderTop: `2px solid ${GOLD}`,
    padding: "1.5rem 2rem 2rem",
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  mobileLink: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.8rem",
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#111",
    textDecoration: "none",
    padding: "1rem 0",
    borderBottom: "1px solid #f0f0f0",
    display: "block",
  },
  mobileCta: {
    marginTop: "1.5rem",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#fff",
    backgroundColor: "#111",
    border: "none",
    padding: "12px 24px",
    cursor: "pointer",
    alignSelf: "flex-start",
    textDecoration: "none",
    display: "inline-block",
  },
};
 
const getNavLinks = (user) => {
  const links = [
    { label: "Home", href: "/" },
    { label: "Men", href: "/men" },
    { label: "Women", href: "/women" },
  ];
  if (!user) {
    links.push({ label: "Login", href: "/login" });
  } else if (user.role === "admin") {
    // Design Studio and the admin Orders view live in AdminNav, reached
    // via Dashboard — not mixed into the customer-facing nav directly.
    links.push({ label: "Dashboard", href: "/dashboard" });
  } else {
    links.push({ label: "My Orders", href: "/my-orders" });
  }
  return links;
};
 
function NavLink({ href, children }) {
  const [hovered, setHovered] = useState(false);

  return (
    <li>
      <Link
        to={href}
        style={{ ...styles.link, color: hovered ? GOLD : "#111" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
        <span
          style={{
            ...styles.linkUnderline,
            transform: hovered ? "scaleX(1)" : "scaleX(0)",
          }}
        />
      </Link>
    </li>
  );
}
 
export default function Navbar({ cartCount, user, setUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartHovered, setCartHovered] = useState(false);
  const [ctaHovered, setCtaHovered] = useState(false);
  const navigate = useNavigate();
  const navLinks = getNavLinks(user);

const handleLogout = () => {
  localStorage.removeItem("token");
  setUser(null);
  navigate("/login");
};
 
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
 
  return (
    <header>
      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=DM+Sans:wght@400;500&display=swap"
        rel="stylesheet"
      />
 
      <nav style={{ ...styles.nav, ...(scrolled ? styles.navScrolled : {}) }}>
        <div style={styles.inner}>
          {/* Logo */}
          <Link to="/" style={styles.logo}>
  Simplic<span style={styles.logoAccent}>i</span>ty
</Link>
 
          {/* Desktop Links */}
          <ul style={styles.desktopLinks} className="simplicity-desktop-nav">
          {navLinks.map((l) => (
  <NavLink key={l.href} href={l.href}>
    {l.label}
  </NavLink>
))}

{user && (
  <li>
    <button
      onClick={handleLogout}
      style={{
        ...styles.link,
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  </li>
)}
          </ul>
 
          {/* Actions */}
          <div style={styles.actions} className="simplicity-desktop-nav">

{/* 🔥 NEW CART WITH BADGE */}
<div style={{ position: "relative" }}>
<button
  style={{ ...styles.iconBtn, color: cartHovered ? GOLD : "#111" }}
  aria-label="Cart"
  onMouseEnter={() => setCartHovered(true)}
  onMouseLeave={() => setCartHovered(false)}
  onClick={() => navigate("/cart")}
>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  </button>

  {cartCount > 0 && (
    <span
      style={{
        position: "absolute",
        top: "-5px",
        right: "-8px",
        backgroundColor: GOLD,
        color: "#fff",
        fontSize: "10px",
        padding: "2px 6px",
        borderRadius: "50%",
        fontWeight: "bold",
      }}
    >
      {cartCount}
    </span>
  )}
</div>
 
            {/* Customize CTA */}
            <Link
  to="/customize"
  style={{
    ...styles.customizeBtn,
    backgroundColor: ctaHovered ? GOLD : "#111",
    borderColor: ctaHovered ? GOLD : "#111",
  }}
  onMouseEnter={() => setCtaHovered(true)}
  onMouseLeave={() => setCtaHovered(false)}
>
  Customize
</Link>
          </div>
 
          {/* Hamburger (mobile) */}
          <button
            style={styles.hamburger}
            className="simplicity-hamburger"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span style={{
              ...styles.bar,
              transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none",
            }} />
            <span style={{
              ...styles.bar,
              opacity: menuOpen ? 0 : 1,
            }} />
            <span style={{
              ...styles.bar,
              transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none",
            }} />
          </button>
        </div>
 
        {/* Mobile Menu */}
        {menuOpen && (
          <div style={styles.mobileMenu} className="simplicity-mobile-menu">
            {navLinks.map((l) => (
  <Link
    key={l.href}
    to={l.href}
    style={styles.mobileLink}
    onClick={() => setMenuOpen(false)}
  >
    {l.label}
  </Link>
))}

{user && (
  <button
    onClick={() => {
      setMenuOpen(false);
      handleLogout();
    }}
    style={{
      ...styles.mobileLink,
      background: "none",
      border: "none",
      textAlign: "left",
      cursor: "pointer",
    }}
  >
    Logout
  </button>
)}
           <Link 
  to="/customize" 
  style={styles.mobileCta}
  onClick={() => setMenuOpen(false)}
>
            Customize a Hoodie
           </Link>
          </div>
        )}
      </nav>
 
      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .simplicity-desktop-nav { display: none !important; }
          .simplicity-hamburger { display: flex !important; }
        }
        @media (min-width: 769px) {
          .simplicity-hamburger { display: none !important; }
          .simplicity-mobile-menu { display: none !important; }
        }
      `}</style>
    </header>
  );
}