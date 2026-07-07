import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard({ user, setUser }) {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const token = localStorage.getItem("token");

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch("http://localhost:5000/api/products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);

      if (!token) return;

      const res = await fetch("http://localhost:5000/api/orders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.log("Orders fetch skipped/failed:", res.status);
        return;
      }

      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, []);

  const stats = useMemo(() => {
    const activeProducts = products.filter((p) => p.is_active !== false).length;
    const customizableProducts = products.filter((p) => p.is_customizable).length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;

    return {
      totalProducts: products.length,
      activeProducts,
      customizableProducts,
      totalOrders: orders.length,
      pendingOrders,
    };
  }, [products, orders]);

  const earnings = useMemo(() => {
    const nonCancelledOrders = orders.filter((o) => o.status !== "cancelled");

    const totalRevenue = nonCancelledOrders.reduce(
      (sum, o) => sum + Number(o.total_price || 0),
      0
    );

    const productSales = {};

    nonCancelledOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key =
          item.product_id != null
            ? `id-${item.product_id}`
            : `name-${item.product_name}`;

        if (!productSales[key]) {
          productSales[key] = {
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: 0,
            revenue: 0,
          };
        }

        productSales[key].quantity += Number(item.quantity || 0);
        productSales[key].revenue +=
          Number(item.quantity || 0) * Number(item.unit_price || 0);
      });
    });

    const totalItemsSold = Object.values(productSales).reduce(
      (sum, p) => sum + p.quantity,
      0
    );

    const bestSellingProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map((entry) => {
        const currentProduct =
          entry.product_id != null
            ? products.find((p) => p.id === entry.product_id)
            : null;

        return {
          ...entry,
          displayName:
            currentProduct?.name || entry.product_name || "Unknown product",
        };
      });

    return {
      totalRevenue,
      totalItemsSold,
      bestSellingProducts,
    };
  }, [orders, products]);

  const recentProducts = products.slice(0, 5);
  const recentOrders = orders.slice(0, 4);

  if (!user) {
    return (
      <div style={styles.centerPage}>
        <h2>Please login first</h2>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div style={styles.centerPage}>
        <h2>User Dashboard</h2>
        <p>This page is only for admins.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Simplicity Admin</p>
            <h1 style={styles.title}>Dashboard</h1>
            <p style={styles.subtitle}>Welcome back, {user.email}</p>
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </header>

        <section style={styles.quickActions}>
          <button onClick={() => navigate("/admin/orders")} style={styles.actionBtn}>
            Manage Orders
          </button>
          <button onClick={() => navigate("/admin/customization")} style={styles.actionBtn}>
            Manage Customization
          </button>
          <button onClick={() => navigate("/admin/homepage")} style={styles.actionBtn}>
            Manage Homepage
          </button>
          <button onClick={() => navigate("/admin/products")} style={styles.actionBtn}>
            Manage Products
          </button>
          <button onClick={() => navigate("/products")} style={styles.actionBtnLight}>
            View Storefront
          </button>
          <button onClick={() => navigate("/customize")} style={styles.actionBtnLight}>
            Preview Customer Studio
          </button>
        </section>

        <section style={styles.statsGrid}>
          <StatCard label="Total Products" value={stats.totalProducts} />
          <StatCard label="Active Products" value={stats.activeProducts} />
          <StatCard label="Customizable" value={stats.customizableProducts} />
          <StatCard label="Pending Orders" value={stats.pendingOrders} />
        </section>

        <section style={styles.formPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.smallEyebrow}>Business Insights</p>
              <h2 style={styles.sectionTitle}>Profit / Earnings</h2>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <StatCard
              label="Total Revenue"
              value={`$${earnings.totalRevenue.toFixed(2)}`}
            />
            <StatCard label="Total Orders" value={stats.totalOrders} />
            <StatCard
              label="Total Items Sold"
              value={earnings.totalItemsSold}
            />
            <StatCard label="Pending Orders" value={stats.pendingOrders} />
          </div>

          <div style={{ marginTop: "22px" }}>
            <p style={styles.smallEyebrow}>Best-Selling Products (Top 5)</p>

            {earnings.bestSellingProducts.length === 0 ? (
              <p style={styles.muted}>No sales data yet.</p>
            ) : (
              <div style={styles.orderList}>
                {earnings.bestSellingProducts.map((product, index) => (
                  <div
                    key={product.product_id ?? product.product_name ?? index}
                    style={styles.orderItem}
                  >
                    <div>
                      <strong>{product.displayName}</strong>
                      <p style={styles.productMeta}>
                        {product.quantity} sold
                      </p>
                    </div>
                    <strong>${product.revenue.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p style={{ ...styles.muted, marginTop: "18px" }}>
            Estimated Profit: Add product cost price to calculate profit.
          </p>
        </section>

        <section style={styles.bottomGrid}>
          <div style={styles.panel}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.smallEyebrow}>Catalog</p>
                <h2 style={styles.sectionTitle}>Products</h2>
              </div>
              <button onClick={() => navigate("/admin/products")} style={styles.textBtn}>
                Manage Products
              </button>
            </div>

            {loadingProducts ? (
              <p style={styles.muted}>Loading products...</p>
            ) : recentProducts.length === 0 ? (
              <p style={styles.muted}>No products yet.</p>
            ) : (
              <div style={styles.productList}>
                {recentProducts.map((product) => (
                  <div key={product.id} style={styles.productItem}>
                    <div style={styles.productLeft}>
                      <div style={styles.productThumb}>
                        {product.main_image_url || product.image_url ? (
                          <img
                            src={product.main_image_url || product.image_url}
                            alt={product.name}
                            style={styles.productImg}
                          />
                        ) : (
                          <span>No image</span>
                        )}
                      </div>

                      <div>
                        <strong>{product.name}</strong>
                        <p style={styles.productMeta}>
                          #{product.id} · {product.category || "No category"} ·{" "}
                          {product.target_group || "No target"}
                        </p>
                        {product.is_customizable && (
                          <span style={styles.customBadge}>Customizable</span>
                        )}
                      </div>
                    </div>

                    <strong>${Number(product.base_price || 0).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.smallEyebrow}>Orders</p>
                <h2 style={styles.sectionTitle}>Recent Orders</h2>
              </div>
              <button onClick={() => navigate("/admin/orders")} style={styles.textBtn}>
                View All
              </button>
            </div>

            {loadingOrders ? (
              <p style={styles.muted}>Loading orders...</p>
            ) : recentOrders.length === 0 ? (
              <p style={styles.muted}>No orders yet.</p>
            ) : (
              <div style={styles.orderList}>
                {recentOrders.map((order) => (
                  <div key={order.id} style={styles.orderItem}>
                    <div>
                      <strong>Order #{String(order.id).padStart(5, "0")}</strong>
                      <p style={styles.productMeta}>
                        {order.customer_name || "Customer"} · {order.status}
                      </p>
                    </div>
                    <strong>
                      ₺
                      {Number(order.total_price || 0).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f4f2",
    padding: "45px 20px 70px",
    fontFamily: "Georgia, serif",
    color: "#111",
  },
  container: {
    maxWidth: "1180px",
    margin: "0 auto",
  },
  centerPage: {
    padding: "100px",
    textAlign: "center",
    fontFamily: "Georgia, serif",
  },
  header: {
    marginBottom: "28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eyebrow: {
    color: "#b59b5b",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    fontSize: "12px",
    margin: 0,
  },
  title: {
    fontSize: "42px",
    fontWeight: 400,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    margin: "8px 0",
  },
  subtitle: {
    color: "#888",
    margin: 0,
  },
  logoutBtn: {
    padding: "12px 18px",
    border: "1px solid #111",
    background: "#fff",
    cursor: "pointer",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "Georgia, serif",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "20px",
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "20px 22px",
    display: "grid",
    gap: "10px",
    minHeight: "96px",
    alignItems: "center",
  },
  quickActions: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "14px",
    marginBottom: "22px",
  },
  actionBtn: {
    background: "#111",
    color: "#fff",
    border: "none",
    padding: "15px",
    cursor: "pointer",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "Georgia, serif",
  },
  actionBtnLight: {
    background: "#fff",
    color: "#111",
    border: "1px solid #111",
    padding: "15px",
    cursor: "pointer",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "Georgia, serif",
  },
  formPanel: {
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "24px",
    marginBottom: "22px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },
  smallEyebrow: {
    color: "#b59b5b",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontSize: "11px",
    margin: 0,
  },
  sectionTitle: {
    fontSize: "24px",
    fontWeight: 400,
    margin: "5px 0 0",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1.3fr 0.7fr",
    gap: "22px",
  },
  panel: {
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "24px",
  },
  productList: {
    display: "grid",
    gap: "12px",
  },
  productItem: {
    border: "1px solid #eee",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "center",
  },
  productLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  productThumb: {
    width: "72px",
    height: "72px",
    background: "#f2f0eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    color: "#999",
    overflow: "hidden",
  },
  productImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  productMeta: {
    color: "#999",
    margin: "5px 0",
    fontSize: "12px",
  },
  customBadge: {
    display: "inline-block",
    background: "#111",
    color: "#fff",
    padding: "3px 7px",
    fontSize: "9px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  orderList: {
    display: "grid",
    gap: "12px",
  },
  orderItem: {
    border: "1px solid #eee",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
  textBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#777",
    textDecoration: "underline",
  },
  muted: {
    color: "#999",
    fontSize: "13px",
  },
};

export default Dashboard;