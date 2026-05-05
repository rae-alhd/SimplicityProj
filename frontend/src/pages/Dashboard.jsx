import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard({ user, setUser }) {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    target_group: "",
    base_price: "",
    image_url: "",
  });

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

  const handleDelete = async (id) => {
    const ok = confirm("Delete this product?");
    if (!ok) return;

    try {
      const res = await fetch(`http://localhost:5000/api/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      console.log("Deleted:", data);

      fetchProducts();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleUpdate = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/products/${editingProduct.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...editingProduct,
            base_price: Number(editingProduct.base_price),
          }),
        }
      );

      const data = await res.json();
      console.log("Updated:", data);

      setEditingProduct(null);
      fetchProducts();
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleCreate = async () => {
    try {
      if (!newProduct.name || !newProduct.category || !newProduct.target_group || !newProduct.base_price) {
        alert("Please fill name, category, target group, and price.");
        return;
      }

      const res = await fetch("http://localhost:5000/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newProduct,
          base_price: Number(newProduct.base_price),
        }),
      });

      const data = await res.json();
      console.log("Created:", data);

      fetchProducts();

      setNewProduct({
        name: "",
        category: "",
        target_group: "",
        base_price: "",
        image_url: "",
      });
    } catch (err) {
      console.error("Create error:", err);
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

          
        </header>

        <section style={styles.statsGrid}>
          <StatCard label="Total Products" value={stats.totalProducts} />
          <StatCard label="Active Products" value={stats.activeProducts} />
          <StatCard label="Customizable" value={stats.customizableProducts} />
          <StatCard label="Pending Orders" value={stats.pendingOrders} />
        </section>

        <section style={styles.quickActions}>
          <button onClick={() => navigate("/admin/orders")} style={styles.actionBtn}>
            Manage Orders
          </button>
          <button onClick={() => navigate("/admin/customization")} style={styles.actionBtn}>
            Open Studio
          </button>
          <button onClick={() => navigate("/products")} style={styles.actionBtnLight}>
            View Store
          </button>
          <button onClick={() => navigate("/customize")} style={styles.actionBtnLight}>
            Preview Customize Page
          </button>
        </section>

        <section style={styles.formPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.smallEyebrow}>Product Management</p>
              <h2 style={styles.sectionTitle}>Add Product</h2>
            </div>
          </div>

          <div style={styles.formGrid}>
            <input
              style={styles.input}
              placeholder="Name"
              value={newProduct.name}
              onChange={(e) =>
                setNewProduct({ ...newProduct, name: e.target.value })
              }
            />

            <input
              style={styles.input}
              placeholder="Category (HOODIE / TSHIRT)"
              value={newProduct.category}
              onChange={(e) =>
                setNewProduct({ ...newProduct, category: e.target.value })
              }
            />

            <input
              style={styles.input}
              placeholder="Target (MEN / WOMEN / UNISEX)"
              value={newProduct.target_group}
              onChange={(e) =>
                setNewProduct({ ...newProduct, target_group: e.target.value })
              }
            />

            <input
              style={styles.input}
              placeholder="Price"
              type="number"
              value={newProduct.base_price}
              onChange={(e) =>
                setNewProduct({ ...newProduct, base_price: e.target.value })
              }
            />

            <input
              style={{ ...styles.input, gridColumn: "span 2" }}
              placeholder="Image URL"
              value={newProduct.image_url}
              onChange={(e) =>
                setNewProduct({ ...newProduct, image_url: e.target.value })
              }
            />

            <button onClick={handleCreate} style={styles.addBtn}>
              Add Product
            </button>
          </div>
        </section>

        <section style={styles.bottomGrid}>
          <div style={styles.panel}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.smallEyebrow}>Catalog</p>
                <h2 style={styles.sectionTitle}>Products</h2>
              </div>
              <span style={styles.muted}>
                {loadingProducts ? "Loading..." : `${products.length} products`}
              </span>
            </div>

            <div style={styles.productList}>
              {recentProducts.map((product) => (
                <div key={product.id} style={styles.productItem}>
                  <div style={styles.productLeft}>
                    <div style={styles.productThumb}>
                      {product.image_url ? (
                        <img
                          src={product.image_url}
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

                  <div style={styles.productActions}>
                    <strong>${Number(product.base_price || 0).toFixed(2)}</strong>
                    <div>
                      <button
                        onClick={() => setEditingProduct(product)}
                        style={styles.editBtn}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        style={styles.deleteBtn}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

        {editingProduct && (
          <section style={styles.editPanel}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.smallEyebrow}>Editing</p>
                <h2 style={styles.sectionTitle}>{editingProduct.name}</h2>
              </div>
              <button onClick={() => setEditingProduct(null)} style={styles.textBtn}>
                Cancel
              </button>
            </div>

            <div style={styles.formGrid}>
              <input
                style={styles.input}
                value={editingProduct.name}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
              />

              <input
                style={styles.input}
                value={editingProduct.category || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, category: e.target.value })
                }
              />

              <input
                style={styles.input}
                value={editingProduct.target_group || ""}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    target_group: e.target.value,
                  })
                }
              />

              <input
                style={styles.input}
                type="number"
                value={editingProduct.base_price}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    base_price: e.target.value,
                  })
                }
              />

              <input
                style={{ ...styles.input, gridColumn: "span 2" }}
                value={editingProduct.image_url || ""}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    image_url: e.target.value,
                  })
                }
              />

              <button onClick={handleUpdate} style={styles.addBtn}>
                Save Changes
              </button>
            </div>
          </section>
        )}
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
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },
  input: {
    padding: "13px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
    fontSize: "14px",
    background: "#fff",
  },
  addBtn: {
    background: "#111",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "Georgia, serif",
    minHeight: "52px",
    fontWeight: "700",
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
  productActions: {
    textAlign: "right",
    display: "grid",
    gap: "10px",
  },
  editBtn: {
    padding: "8px 10px",
    border: "1px solid #111",
    background: "#fff",
    cursor: "pointer",
    marginRight: "8px",
  },
  deleteBtn: {
    padding: "8px 10px",
    border: "1px solid #d8b5b5",
    background: "#fff",
    color: "#b52a2a",
    cursor: "pointer",
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
  editPanel: {
    background: "#fff",
    border: "1px solid #111",
    padding: "24px",
    marginTop: "22px",
  },
};

export default Dashboard;