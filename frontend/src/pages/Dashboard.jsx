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

  const [productImages, setProductImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

  const [homepageSettings, setHomepageSettings] = useState({
    hero_title: "",
    hero_highlight: "",
    hero_subtitle: "",
    hero_image_url: "",
    primary_button_text: "",
    primary_button_link: "",
    secondary_button_text: "",
    secondary_button_link: "",
    announcement_text: "",
    men_card_image_url: "",
    men_card_title: "",
    women_card_image_url: "",
    women_card_title: "",
    studio_card_image_url: "",
    studio_card_title: "",
  });
  const [loadingHomepageSettings, setLoadingHomepageSettings] = useState(true);
  const [heroImageFile, setHeroImageFile] = useState(null);
  const [cardImageFiles, setCardImageFiles] = useState({
    men: null,
    women: null,
    studio: null,
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

  const fetchProductImages = async (productId) => {
    try {
      setLoadingImages(true);
      const res = await fetch(
        `http://localhost:5000/api/admin/products/${productId}/images`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      setProductImages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching product images:", err);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleImageUpload = async () => {
    if (!uploadFile || !editingProduct) return;

    try {
      const formData = new FormData();
      formData.append("image", uploadFile);

      const res = await fetch(
        `http://localhost:5000/api/admin/products/${editingProduct.id}/images`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not upload image.");
        return;
      }

      setUploadFile(null);
      fetchProductImages(editingProduct.id);
      fetchProducts();
    } catch (err) {
      console.error("Image upload error:", err);
      alert("Something went wrong while uploading the image.");
    }
  };

  const handleSetMainImage = async (imageId) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/products/${editingProduct.id}/images/${imageId}/main`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Could not set main image.");
        return;
      }

      fetchProductImages(editingProduct.id);
      fetchProducts();
    } catch (err) {
      console.error("Set main image error:", err);
      alert("Something went wrong while setting the main image.");
    }
  };

  const handleDeactivateImage = async (imageId) => {
    const ok = window.confirm(
      "Deactivate this image? It will no longer appear on public product pages. If it is the main image, another active image will be selected as main."
    );
    if (!ok) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/products/${editingProduct.id}/images/${imageId}/deactivate`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Could not deactivate image.");
        return;
      }

      fetchProductImages(editingProduct.id);
      fetchProducts();
    } catch (err) {
      console.error("Deactivate image error:", err);
      alert("Something went wrong while deactivating the image.");
    }
  };

  const fetchHomepageSettings = async () => {
    try {
      setLoadingHomepageSettings(true);
      const res = await fetch("http://localhost:5000/api/homepage-settings");
      const data = await res.json();
      setHomepageSettings({
        hero_title: data.hero_title || "",
        hero_highlight: data.hero_highlight || "",
        hero_subtitle: data.hero_subtitle || "",
        hero_image_url: data.hero_image_url || "",
        primary_button_text: data.primary_button_text || "",
        primary_button_link: data.primary_button_link || "",
        secondary_button_text: data.secondary_button_text || "",
        secondary_button_link: data.secondary_button_link || "",
        announcement_text: data.announcement_text || "",
        men_card_image_url: data.men_card_image_url || "",
        men_card_title: data.men_card_title || "",
        women_card_image_url: data.women_card_image_url || "",
        women_card_title: data.women_card_title || "",
        studio_card_image_url: data.studio_card_image_url || "",
        studio_card_title: data.studio_card_title || "",
      });
    } catch (err) {
      console.error("Error fetching homepage settings:", err);
    } finally {
      setLoadingHomepageSettings(false);
    }
  };

  const handleSaveHomepageSettings = async () => {
    try {
      const res = await fetch(
        "http://localhost:5000/api/admin/homepage-settings",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(homepageSettings),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not save homepage settings.");
        return;
      }

      alert("Homepage settings saved successfully.");
    } catch (err) {
      console.error("Save homepage settings error:", err);
      alert("Something went wrong while saving homepage settings.");
    }
  };

  const handleHeroImageUpload = async () => {
    if (!heroImageFile) return;

    try {
      const formData = new FormData();
      formData.append("image", heroImageFile);

      const res = await fetch(
        "http://localhost:5000/api/admin/homepage-settings/hero-image",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not upload hero image.");
        return;
      }

      setHomepageSettings({
        ...homepageSettings,
        hero_image_url: data.hero_image_url || "",
      });
      setHeroImageFile(null);
      alert("Hero image uploaded successfully.");
    } catch (err) {
      console.error("Hero image upload error:", err);
      alert("Something went wrong while uploading the hero image.");
    }
  };

  const handleCardImageUpload = async (cardKey) => {
    const file = cardImageFiles[cardKey];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        `http://localhost:5000/api/admin/homepage-settings/card-image/${cardKey}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not upload category card image.");
        return;
      }

      const imageUrlKey = `${cardKey}_card_image_url`;
      setHomepageSettings({
        ...homepageSettings,
        [imageUrlKey]: data[imageUrlKey] || "",
      });
      setCardImageFiles({ ...cardImageFiles, [cardKey]: null });
      alert("Category card image uploaded successfully.");
    } catch (err) {
      console.error("Category card image upload error:", err);
      alert("Something went wrong while uploading the category card image.");
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchHomepageSettings();
  }, []);

  useEffect(() => {
    if (editingProduct?.id) {
      fetchProductImages(editingProduct.id);
    } else {
      setProductImages([]);
    }
    setUploadFile(null);
  }, [editingProduct?.id]);

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

        <section style={styles.formPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.smallEyebrow}>Site Content</p>
              <h2 style={styles.sectionTitle}>Homepage Settings</h2>
            </div>
            <span style={styles.muted}>
              {loadingHomepageSettings ? "Loading..." : ""}
            </span>
          </div>

          <div style={styles.formGrid}>
            <input
              style={styles.input}
              placeholder="Hero Title"
              value={homepageSettings.hero_title}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  hero_title: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Hero Highlighted Line"
              value={homepageSettings.hero_highlight}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  hero_highlight: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Hero Image URL"
              value={homepageSettings.hero_image_url}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  hero_image_url: e.target.value,
                })
              }
            />

            <div
              style={{
                ...styles.uploadRow,
                gridColumn: "span 3",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setHeroImageFile(e.target.files[0] || null)
                }
              />
              <button onClick={handleHeroImageUpload} style={styles.editBtn}>
                Upload Hero Image
              </button>
            </div>

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Hero Subtitle"
              value={homepageSettings.hero_subtitle}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  hero_subtitle: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Primary Button Text"
              value={homepageSettings.primary_button_text}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  primary_button_text: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Primary Button Link"
              value={homepageSettings.primary_button_link}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  primary_button_link: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Secondary Button Text"
              value={homepageSettings.secondary_button_text}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  secondary_button_text: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Secondary Button Link"
              value={homepageSettings.secondary_button_link}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  secondary_button_link: e.target.value,
                })
              }
            />

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Announcement Text (optional)"
              value={homepageSettings.announcement_text}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  announcement_text: e.target.value,
                })
              }
            />

            <p style={{ ...styles.smallEyebrow, gridColumn: "span 3" }}>
              Men Card
            </p>

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Men Card Title"
              value={homepageSettings.men_card_title}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  men_card_title: e.target.value,
                })
              }
            />

            <div
              style={{
                ...styles.uploadRow,
                gridColumn: "span 3",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setCardImageFiles({
                    ...cardImageFiles,
                    men: e.target.files[0] || null,
                  })
                }
              />
              <button
                onClick={() => handleCardImageUpload("men")}
                style={styles.editBtn}
              >
                Upload Men Card Image
              </button>
            </div>

            <p style={{ ...styles.smallEyebrow, gridColumn: "span 3" }}>
              Women Card
            </p>

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Women Card Title"
              value={homepageSettings.women_card_title}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  women_card_title: e.target.value,
                })
              }
            />

            <div
              style={{
                ...styles.uploadRow,
                gridColumn: "span 3",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setCardImageFiles({
                    ...cardImageFiles,
                    women: e.target.files[0] || null,
                  })
                }
              />
              <button
                onClick={() => handleCardImageUpload("women")}
                style={styles.editBtn}
              >
                Upload Women Card Image
              </button>
            </div>

            <p style={{ ...styles.smallEyebrow, gridColumn: "span 3" }}>
              Custom Studio Card
            </p>

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Custom Studio Card Title"
              value={homepageSettings.studio_card_title}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  studio_card_title: e.target.value,
                })
              }
            />

            <div
              style={{
                ...styles.uploadRow,
                gridColumn: "span 3",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setCardImageFiles({
                    ...cardImageFiles,
                    studio: e.target.files[0] || null,
                  })
                }
              />
              <button
                onClick={() => handleCardImageUpload("studio")}
                style={styles.editBtn}
              >
                Upload Custom Studio Card Image
              </button>
            </div>

            <button onClick={handleSaveHomepageSettings} style={styles.addBtn}>
              Save Homepage Settings
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

            <div style={styles.imagesSection}>
              <p style={styles.smallEyebrow}>Product Images</p>

              {loadingImages ? (
                <p style={styles.muted}>Loading images...</p>
              ) : productImages.filter((image) => image.is_active === true)
                  .length === 0 ? (
                <p style={styles.muted}>No active images yet.</p>
              ) : (
                <div style={styles.imageThumbRow}>
                  {productImages
                    .filter((image) => image.is_active === true)
                    .map((image) => (
                      <div key={image.id} style={styles.imageThumbItem}>
                        <img
                          src={image.image_url}
                          alt=""
                          style={styles.imageThumb}
                        />
                        {image.is_main ? (
                          <span style={styles.mainBadge}>Main</span>
                        ) : (
                          <button
                            onClick={() => handleSetMainImage(image.id)}
                            style={styles.imageActionBtn}
                          >
                            Set as Main
                          </button>
                        )}
                        <button
                          onClick={() => handleDeactivateImage(image.id)}
                          style={styles.imageDeleteBtn}
                        >
                          Deactivate
                        </button>
                      </div>
                    ))}
                </div>
              )}

              <div style={styles.uploadRow}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                />
                <button onClick={handleImageUpload} style={styles.editBtn}>
                  Upload Image
                </button>
              </div>
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
  imagesSection: {
    marginTop: "24px",
    paddingTop: "20px",
    borderTop: "1px solid #eee",
  },
  imageThumbRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    margin: "12px 0",
  },
  imageThumbItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    width: "88px",
  },
  imageThumb: {
    width: "80px",
    height: "80px",
    objectFit: "cover",
    border: "1px solid #eee",
  },
  mainBadge: {
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#fff",
    background: "#111",
    padding: "3px 8px",
  },
  imageActionBtn: {
    fontSize: "11px",
    padding: "5px 8px",
    border: "1px solid #111",
    background: "#fff",
    cursor: "pointer",
  },
  imageDeleteBtn: {
    fontSize: "11px",
    padding: "5px 8px",
    border: "1px solid #d8b5b5",
    background: "#fff",
    color: "#b52a2a",
    cursor: "pointer",
  },
  uploadRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
  },
};

export default Dashboard;