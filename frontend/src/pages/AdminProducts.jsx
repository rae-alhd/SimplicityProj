import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminProducts() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);

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
  const [productColors, setProductColors] = useState([]);
  const [uploadColorId, setUploadColorId] = useState("");

  const [manageColors, setManageColors] = useState([]);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("");
  const [editingColorId, setEditingColorId] = useState(null);
  const [editColorName, setEditColorName] = useState("");
  const [editColorHex, setEditColorHex] = useState("");

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

  const fetchProductColors = async (productId) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/products/${productId}/colors`
      );
      const data = await res.json();
      setProductColors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching product colors:", err);
    }
  };

  const fetchManageColors = async (productId) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/customization/${productId}/colors`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      setManageColors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching manage colors:", err);
    }
  };

  const handleAddColor = async () => {
    if (!editingProduct || !newColorName.trim()) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/customization/${editingProduct.id}/colors`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            color_name: newColorName.trim(),
            color_hex: newColorHex.trim() || null,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not add color.");
        return;
      }

      setNewColorName("");
      setNewColorHex("");
      fetchManageColors(editingProduct.id);
      fetchProductColors(editingProduct.id);
    } catch (err) {
      console.error("Add color error:", err);
      alert("Something went wrong while adding the color.");
    }
  };

  const handleUpdateColor = async (color) => {
    if (!editColorName.trim()) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/customization/colors/${color.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            color_name: editColorName.trim(),
            color_hex: editColorHex.trim() || null,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not update color.");
        return;
      }

      setEditingColorId(null);
      fetchManageColors(editingProduct.id);
      fetchProductColors(editingProduct.id);
    } catch (err) {
      console.error("Update color error:", err);
      alert("Something went wrong while updating the color.");
    }
  };

  const handleToggleColorActive = async (color) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/customization/colors/${color.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_active: !color.is_active }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not update color status.");
        return;
      }

      fetchManageColors(editingProduct.id);
      fetchProductColors(editingProduct.id);
    } catch (err) {
      console.error("Toggle color active error:", err);
      alert("Something went wrong while updating the color status.");
    }
  };

  const handleImageUpload = async () => {
    if (!uploadFile || !editingProduct) return;

    try {
      const formData = new FormData();
      formData.append("image", uploadFile);
      if (uploadColorId) {
        formData.append("color_id", uploadColorId);
      }

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
      setUploadColorId("");
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

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchProducts();
  }, [token, navigate]);

  useEffect(() => {
    if (editingProduct?.id) {
      fetchProductImages(editingProduct.id);
      fetchProductColors(editingProduct.id);
      fetchManageColors(editingProduct.id);
    } else {
      setProductImages([]);
      setProductColors([]);
      setManageColors([]);
    }
    setUploadFile(null);
    setUploadColorId("");
    setNewColorName("");
    setNewColorHex("");
    setEditingColorId(null);
  }, [editingProduct?.id]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Simplicity Admin</p>
            <h1 style={styles.title}>Product Management</h1>
            <p style={styles.subtitle}>
              Manage products, images, colors, and catalog visibility.
            </p>
          </div>

          <button onClick={() => navigate("/dashboard")} style={styles.backBtn}>
            Back to Dashboard
          </button>
        </header>

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

        <section style={styles.panel}>
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
            {products.map((product) => (
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

            <div style={styles.colorsSection}>
              <p style={styles.smallEyebrow}>Product Colors</p>

              <div style={styles.colorAddRow}>
                <input
                  style={styles.input}
                  placeholder="Color name (e.g. Sand Beige)"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Hex (e.g. #d8c09a)"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                />
                <button onClick={handleAddColor} style={styles.editBtn}>
                  Add Color
                </button>
              </div>

              {manageColors.length === 0 ? (
                <p style={styles.muted}>
                  No colors yet. This product can use general images only.
                </p>
              ) : (
                <div style={styles.colorList}>
                  {manageColors.map((color) =>
                    editingColorId === color.id ? (
                      <div key={color.id} style={styles.colorItem}>
                        <input
                          style={styles.input}
                          value={editColorName}
                          onChange={(e) => setEditColorName(e.target.value)}
                        />
                        <input
                          style={styles.input}
                          value={editColorHex}
                          onChange={(e) => setEditColorHex(e.target.value)}
                        />
                        <button
                          onClick={() => handleUpdateColor(color)}
                          style={styles.editBtn}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingColorId(null)}
                          style={styles.textBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div key={color.id} style={styles.colorItem}>
                        <span
                          style={{
                            ...styles.colorSwatch,
                            background: color.color_hex || "#eee",
                          }}
                        />
                        <strong>{color.color_name}</strong>
                        <span style={styles.muted}>
                          {color.color_hex || "No hex"}
                        </span>
                        <span
                          style={
                            color.is_active
                              ? styles.mainBadge
                              : styles.imageColorTag
                          }
                        >
                          {color.is_active ? "Active" : "Inactive"}
                        </span>
                        <button
                          onClick={() => {
                            setEditingColorId(color.id);
                            setEditColorName(color.color_name);
                            setEditColorHex(color.color_hex || "");
                          }}
                          style={styles.editBtn}
                        >
                          Edit
                        </button>
                        {color.is_active ? (
                          <button
                            onClick={() => handleToggleColorActive(color)}
                            style={styles.imageDeleteBtn}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleColorActive(color)}
                            style={styles.imageActionBtn}
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
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
                        <span style={styles.imageColorTag}>
                          {image.color_id
                            ? `Color: ${
                                productColors.find(
                                  (c) => Number(c.id) === Number(image.color_id)
                                )?.color_name || `#${image.color_id}`
                              }`
                            : "General image"}
                        </span>
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
                <select
                  value={uploadColorId}
                  onChange={(e) => setUploadColorId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">General image / No specific color</option>
                  {productColors.map((color) => (
                    <option key={color.id} value={color.id}>
                      {color.color_name}
                    </option>
                  ))}
                </select>
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
  backBtn: {
    padding: "12px 18px",
    border: "1px solid #111",
    background: "#fff",
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
  panel: {
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
  colorsSection: {
    marginTop: "24px",
    paddingTop: "20px",
    borderTop: "1px solid #eee",
  },
  colorAddRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
  },
  colorList: {
    display: "grid",
    gap: "10px",
    marginTop: "14px",
  },
  colorItem: {
    border: "1px solid #eee",
    padding: "10px 12px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
  },
  colorSwatch: {
    width: "22px",
    height: "22px",
    borderRadius: "4px",
    border: "1px solid #ddd",
    display: "inline-block",
    flexShrink: 0,
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
  imageColorTag: {
    fontSize: "10px",
    letterSpacing: "0.05em",
    color: "#999",
    textAlign: "center",
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
