import { useNavigate, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Products", path: "/admin/products" },
  { label: "Orders", path: "/admin/orders" },
  { label: "Customization", path: "/admin/customization" },
  { label: "Homepage", path: "/admin/homepage" },
  { label: "Storefront", path: "/products" },
];

export default function AdminNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <span style={styles.brand}>Simplicity Admin</span>

        <div style={styles.links}>
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.path;

            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  ...styles.link,
                  ...(isActive ? styles.linkActive : {}),
                }}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    background: "#fff",
    borderBottom: "1px solid #e0dbd4",
    fontFamily: "Georgia, serif",
  },
  container: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  brand: {
    fontSize: "12px",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#b59b5b",
    whiteSpace: "nowrap",
  },
  links: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  link: {
    padding: "9px 14px",
    border: "1px solid #e0dbd4",
    background: "#fff",
    color: "#555",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "11px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  linkActive: {
    background: "#111",
    color: "#fff",
    borderColor: "#111",
  },
  logoutBtn: {
    padding: "9px 16px",
    border: "1px solid #111",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "11px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
};
