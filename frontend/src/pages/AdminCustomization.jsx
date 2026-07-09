import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:5000/api";

export default function AdminCustomization() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [options, setOptions] = useState([]);
  const [examples, setExamples] = useState([]);

  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState("");

  const [newColor, setNewColor] = useState({
    color_name: "",
    color_hex: "#000000",
  });

  const [newSize, setNewSize] = useState({
    size_label: "",
  });

  const [newOption, setNewOption] = useState({
    option_label: "",
    option_type: "text",
    description: "",
    extra_price: 0,
  });

  const [newExample, setNewExample] = useState({
    image_url: "",
    caption: "",
  });

  const [collections, setCollections] = useState([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);

  const [designs, setDesigns] = useState([]);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [newDesignName, setNewDesignName] = useState("");
  const [newDesignFile, setNewDesignFile] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadCustomizationData(selectedProductId);
    }
  }, [selectedProductId]);

  async function authFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Request failed");
    }

    return data;
  }

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const data = await fetch(`${API_BASE}/products`).then((res) => res.json());
      const list = Array.isArray(data) ? data : [];

      setProducts(list);

      const firstCustom = list.find((p) => p.is_customizable) || list[0];

      if (firstCustom) {
        setSelectedProductId(firstCustom.id);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadCustomizationData(productId) {
    try {
      setSectionLoading(true);
      setError("");

      const [colorsData, sizesData, optionsData, examplesData, collectionsData] =
        await Promise.all([
          authFetch(`${API_BASE}/admin/customization/${productId}/colors`),
          authFetch(`${API_BASE}/admin/customization/${productId}/sizes`),
          authFetch(`${API_BASE}/admin/customization/${productId}/options`),
          authFetch(`${API_BASE}/admin/customization/${productId}/examples`),
          authFetch(`${API_BASE}/admin/customization/collections`),
        ]);

      setColors(Array.isArray(colorsData) ? colorsData : []);
      setSizes(Array.isArray(sizesData) ? sizesData : []);
      setOptions(Array.isArray(optionsData) ? optionsData : []);
      setExamples(Array.isArray(examplesData) ? examplesData : []);
      setCollections(Array.isArray(collectionsData) ? collectionsData : []);

      setSectionLoading(false);
    } catch (err) {
      setError(err.message);
      setSectionLoading(false);
    }
  }

  async function toggleProductCustomization(is_customizable) {
    try {
      await authFetch(`${API_BASE}/admin/customization/product/${selectedProductId}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({
          is_customizable,
        }),
      });

      setProducts((prev) =>
        prev.map((p) =>
          Number(p.id) === Number(selectedProductId)
            ? { ...p, is_customizable }
            : p
        )
      );
    } catch (err) {
      alert(err.message);
    }
  }

  async function addColor() {
    if (!newColor.color_name.trim()) {
      alert("Color name is required");
      return;
    }

    try {
      await authFetch(`${API_BASE}/admin/customization/${selectedProductId}/colors`, {
        method: "POST",
        body: JSON.stringify(newColor),
      });

      setNewColor({ color_name: "", color_hex: "#000000" });
      loadCustomizationData(selectedProductId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function addSize() {
    if (!newSize.size_label.trim()) {
      alert("Size label is required");
      return;
    }

    try {
      await authFetch(`${API_BASE}/admin/customization/${selectedProductId}/sizes`, {
        method: "POST",
        body: JSON.stringify(newSize),
      });

      setNewSize({ size_label: "" });
      loadCustomizationData(selectedProductId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function addOption() {
    if (!newOption.option_label.trim()) {
      alert("Option label is required");
      return;
    }

    try {
      await authFetch(`${API_BASE}/admin/customization/${selectedProductId}/options`, {
        method: "POST",
        body: JSON.stringify({
          ...newOption,
          extra_price: Number(newOption.extra_price || 0),
        }),
      });

      setNewOption({
        option_label: "",
        option_type: "text",
        description: "",
        extra_price: 0,
      });

      loadCustomizationData(selectedProductId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function addExample() {
    if (!newExample.image_url.trim()) {
      alert("Image URL is required");
      return;
    }

    try {
      await authFetch(`${API_BASE}/admin/customization/${selectedProductId}/examples`, {
        method: "POST",
        body: JSON.stringify(newExample),
      });

      setNewExample({ image_url: "", caption: "" });
      loadCustomizationData(selectedProductId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteItem(type, id) {
    const confirmDelete = confirm("Delete this item?");
    if (!confirmDelete) return;

    try {
      await authFetch(`${API_BASE}/admin/customization/${type}/${id}`, {
        method: "DELETE",
      });

      loadCustomizationData(selectedProductId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function addCollection() {
    if (!newCollectionName.trim()) {
      alert("Collection name is required");
      return;
    }

    try {
      await authFetch(`${API_BASE}/admin/customization/collections`, {
        method: "POST",
        body: JSON.stringify({
          product_id: selectedProductId,
          name: newCollectionName,
        }),
      });

      setNewCollectionName("");
      loadCustomizationData(selectedProductId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function deactivateCollection(id) {
    const confirmDeactivate = confirm("Deactivate this collection?");
    if (!confirmDeactivate) return;

    try {
      await authFetch(`${API_BASE}/admin/customization/collections/${id}`, {
        method: "DELETE",
      });

      if (selectedCollectionId === id) {
        setSelectedCollectionId(null);
        setDesigns([]);
      }

      loadCustomizationData(selectedProductId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadDesigns(collectionId) {
    try {
      setDesignsLoading(true);
      const data = await authFetch(
        `${API_BASE}/admin/customization/collections/${collectionId}/designs`
      );
      setDesigns(Array.isArray(data) ? data : []);
    } catch (err) {
      alert(err.message);
    } finally {
      setDesignsLoading(false);
    }
  }

  async function uploadDesign() {
    if (!newDesignName.trim()) {
      alert("Design name is required");
      return;
    }

    if (!newDesignFile) {
      alert("Design image is required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", newDesignName);
      formData.append("image", newDesignFile);

      // Use plain fetch here (not authFetch) — authFetch always sets
      // Content-Type: application/json, which breaks multipart uploads.
      const res = await fetch(
        `${API_BASE}/admin/customization/collections/${selectedCollectionId}/designs`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Upload failed");
      }

      setNewDesignName("");
      setNewDesignFile(null);
      loadDesigns(selectedCollectionId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function deactivateDesign(id) {
    const confirmDeactivate = confirm("Deactivate this design?");
    if (!confirmDeactivate) return;

    try {
      await authFetch(`${API_BASE}/admin/customization/designs/${id}`, {
        method: "DELETE",
      });

      loadDesigns(selectedCollectionId);
    } catch (err) {
      alert(err.message);
    }
  }

  function openCollection(id) {
    setSelectedCollectionId((current) => {
      const next = current === id ? null : id;

      if (next) {
        loadDesigns(next);
      } else {
        setDesigns([]);
      }

      setNewDesignName("");
      setNewDesignFile(null);

      return next;
    });
  }

  const selectedProduct = products.find(
    (p) => Number(p.id) === Number(selectedProductId)
  );

  const productCollections = collections.filter(
    (c) => Number(c.product_id) === Number(selectedProductId)
  );

  if (loading) {
    return <div style={styles.centerPage}>Loading customization manager...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <button onClick={() => navigate("/dashboard")} style={styles.backBtn}>
            Back to Dashboard
          </button>
        </div>

        <header style={styles.header}>
          <p style={styles.eyebrow}>Admin Studio</p>
          <h1 style={styles.title}>Customization Manager</h1>
          <p style={styles.subtitle}>
            Control which products are customizable and what customers are allowed to choose.
          </p>
        </header>

        {error && <div style={styles.errorBox}>{error}</div>}

        <section style={styles.productPanel}>
          <div>
            <label style={styles.label}>Choose Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={styles.select}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  #{product.id} — {product.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div style={styles.productInfo}>
              <div style={styles.productInfoTop}>
                <div style={styles.productThumbWrap}>
                  {selectedProduct.main_image_url || selectedProduct.image_url ? (
                    <img
                      src={selectedProduct.main_image_url || selectedProduct.image_url}
                      alt={selectedProduct.name}
                      style={styles.productThumbImg}
                    />
                  ) : (
                    <span style={styles.productThumbPlaceholder}>No Image</span>
                  )}
                </div>

                <div>
                  <span style={styles.productIdTag}>#{selectedProduct.id}</span>
                  <h2 style={styles.productName}>{selectedProduct.name}</h2>
                  <p style={styles.productMeta}>
                    {selectedProduct.category} · {selectedProduct.target_group}
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  toggleProductCustomization(!selectedProduct.is_customizable)
                }
                style={{
                  ...styles.toggleBtn,
                  background: selectedProduct.is_customizable ? "#111" : "#fff",
                  color: selectedProduct.is_customizable ? "#fff" : "#111",
                }}
              >
                {selectedProduct.is_customizable
                  ? "Customizable: ON"
                  : "Customizable: OFF"}
              </button>
            </div>
          )}
        </section>

        {sectionLoading ? (
          <div style={styles.centerSmall}>Loading selected product options...</div>
        ) : (
          <div style={styles.grid}>
            {/* COLORS */}
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Allowed Colors</h2>

              <div style={styles.formRow}>
                <input
                  value={newColor.color_name}
                  onChange={(e) =>
                    setNewColor({ ...newColor, color_name: e.target.value })
                  }
                  placeholder="Color name"
                  style={styles.input}
                />
                <input
                  type="color"
                  value={newColor.color_hex}
                  onChange={(e) =>
                    setNewColor({ ...newColor, color_hex: e.target.value })
                  }
                  style={styles.colorInput}
                />
                <button onClick={addColor} style={styles.addBtn}>
                  Add
                </button>
              </div>

              <div style={styles.list}>
                {colors.map((c) => (
                  <div key={c.id} style={styles.listItem}>
                    <div style={styles.rowLeft}>
                      <span
                        style={{
                          ...styles.colorDot,
                          background: c.color_hex || "#ccc",
                        }}
                      />
                      <div>
                        <strong>{c.color_name}</strong>
                        <p>{c.color_hex}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteItem("colors", c.id)}
                      style={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* SIZES */}
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Allowed Sizes</h2>

              <div style={styles.formRow}>
                <input
                  value={newSize.size_label}
                  onChange={(e) =>
                    setNewSize({ ...newSize, size_label: e.target.value })
                  }
                  placeholder="Example: XL"
                  style={styles.input}
                />
                <button onClick={addSize} style={styles.addBtn}>
                  Add
                </button>
              </div>

              <div style={styles.sizeList}>
                {sizes.map((s) => (
                  <div key={s.id} style={styles.sizeItem}>
                    <span>{s.size_label}</span>
                    <button
                      onClick={() => deleteItem("sizes", s.id)}
                      style={styles.smallDeleteBtn}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* OPTIONS */}
            <section style={styles.cardWide}>
              <h2 style={styles.cardTitle}>Design Placement Options</h2>

              <div style={styles.optionForm}>
                <input
                  value={newOption.option_label}
                  onChange={(e) =>
                    setNewOption({ ...newOption, option_label: e.target.value })
                  }
                  placeholder="Option label"
                  style={styles.input}
                />

                <select
                  value={newOption.option_type}
                  onChange={(e) =>
                    setNewOption({ ...newOption, option_type: e.target.value })
                  }
                  style={styles.input}
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="text_and_image">Text + Image</option>
                </select>

                <input
                  type="number"
                  value={newOption.extra_price}
                  onChange={(e) =>
                    setNewOption({ ...newOption, extra_price: e.target.value })
                  }
                  placeholder="Extra price"
                  style={styles.input}
                />

                <textarea
                  value={newOption.description}
                  onChange={(e) =>
                    setNewOption({ ...newOption, description: e.target.value })
                  }
                  placeholder="Description"
                  style={styles.textarea}
                />

                <button onClick={addOption} style={styles.addBtnWide}>
                  Add Design Option
                </button>
              </div>

              <div style={styles.list}>
                {options.map((o) => (
                  <div key={o.id} style={styles.optionItem}>
                    <div>
                      <strong>{o.option_label}</strong>
                      <p>{o.description}</p>
                      <small>
                        Type: {o.option_type} · Extra: ${Number(o.extra_price || 0).toFixed(2)}
                      </small>
                    </div>
                    <button
                      onClick={() => deleteItem("options", o.id)}
                      style={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* EXAMPLES */}
            <section style={styles.cardWide}>
              <h2 style={styles.cardTitle}>Customization Examples</h2>

              <div style={styles.optionForm}>
                <input
                  value={newExample.image_url}
                  onChange={(e) =>
                    setNewExample({ ...newExample, image_url: e.target.value })
                  }
                  placeholder="Image URL"
                  style={styles.input}
                />

                <input
                  value={newExample.caption}
                  onChange={(e) =>
                    setNewExample({ ...newExample, caption: e.target.value })
                  }
                  placeholder="Caption"
                  style={styles.input}
                />

                <button onClick={addExample} style={styles.addBtnWide}>
                  Add Example
                </button>
              </div>

              <div style={styles.exampleGrid}>
                {examples.map((ex) => (
                  <div key={ex.id} style={styles.exampleCard}>
                    <img src={ex.image_url} alt={ex.caption} style={styles.exampleImg} />
                    <p>{ex.caption}</p>
                    <button
                      onClick={() => deleteItem("examples", ex.id)}
                      style={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* DESIGN COLLECTIONS */}
            <section style={styles.cardWide}>
              <h2 style={styles.cardTitle}>Design Collections</h2>

              <div style={styles.formRow}>
                <input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Collection name (e.g. Country)"
                  style={styles.input}
                />
                <button onClick={addCollection} style={styles.addBtn}>
                  Add Collection
                </button>
              </div>

              <div style={styles.list}>
                {productCollections.length === 0 ? (
                  <p style={{ color: "#999" }}>
                    No collections yet for this product.
                  </p>
                ) : (
                  productCollections.map((collection) => (
                    <div key={collection.id}>
                      <div
                        style={{
                          ...styles.listItem,
                          borderColor:
                            selectedCollectionId === collection.id
                              ? "#111"
                              : "#eee",
                        }}
                      >
                        <div>
                          <strong>{collection.name}</strong>
                          <p
                            style={{
                              color: "#999",
                              fontSize: "12px",
                              margin: "4px 0 0",
                            }}
                          >
                            {collection.product_name
                              ? `${collection.product_name} · `
                              : ""}
                            {collection.is_active ? "Active" : "Inactive"}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => openCollection(collection.id)}
                            style={styles.addBtn}
                          >
                            {selectedCollectionId === collection.id
                              ? "Close"
                              : "Open"}
                          </button>
                          <button
                            onClick={() => deactivateCollection(collection.id)}
                            style={styles.deleteBtn}
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>

                      {selectedCollectionId === collection.id && (
                        <div style={styles.designPanel}>
                          <div style={styles.formRow}>
                            <input
                              value={newDesignName}
                              onChange={(e) =>
                                setNewDesignName(e.target.value)
                              }
                              placeholder="Design name (e.g. Yemen)"
                              style={styles.input}
                            />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                setNewDesignFile(e.target.files[0] || null)
                              }
                            />
                            <button
                              onClick={uploadDesign}
                              style={styles.addBtn}
                            >
                              Upload Design
                            </button>
                          </div>

                          {designsLoading ? (
                            <p style={{ color: "#999" }}>
                              Loading designs...
                            </p>
                          ) : designs.length === 0 ? (
                            <p style={{ color: "#999" }}>
                              No designs yet in this collection.
                            </p>
                          ) : (
                            <div style={styles.exampleGrid}>
                              {designs.map((design) => (
                                <div
                                  key={design.id}
                                  style={styles.exampleCard}
                                >
                                  <img
                                    src={design.image_url}
                                    alt={design.name}
                                    style={styles.exampleImg}
                                  />
                                  <strong>{design.name}</strong>
                                  <p
                                    style={{
                                      color: "#999",
                                      fontSize: "12px",
                                      margin: "4px 0 8px",
                                    }}
                                  >
                                    {design.is_active
                                      ? "Active"
                                      : "Inactive"}
                                  </p>
                                  <button
                                    onClick={() =>
                                      deactivateDesign(design.id)
                                    }
                                    style={styles.deleteBtn}
                                  >
                                    Deactivate
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f4f2",
    padding: "70px 20px",
    fontFamily: "Georgia, serif",
    color: "#111",
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  topBar: {
    marginBottom: "20px",
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
  header: {
    textAlign: "center",
    marginBottom: "36px",
  },
  eyebrow: {
    color: "#b59b5b",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    fontSize: "12px",
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
    fontSize: "15px",
  },
  errorBox: {
    background: "#fff0f0",
    border: "1px solid #f0b5b5",
    color: "#b52a2a",
    padding: "14px",
    marginBottom: "20px",
  },
  productPanel: {
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "24px",
    marginBottom: "24px",
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: "24px",
    alignItems: "center",
  },
  label: {
    display: "block",
    fontSize: "11px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#a99b84",
    marginBottom: "8px",
  },
  select: {
    width: "100%",
    padding: "14px",
    border: "1px solid #ddd",
    background: "#fff",
    fontFamily: "Georgia, serif",
  },
  productInfo: {
    borderLeft: "1px solid #eee",
    paddingLeft: "24px",
  },
  productInfoTop: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "14px",
  },
  productThumbWrap: {
    width: "64px",
    height: "64px",
    flexShrink: 0,
    background: "#f2f0eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  productThumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  productThumbPlaceholder: {
    fontSize: "9px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#999",
  },
  productIdTag: {
    display: "inline-block",
    fontSize: "11px",
    letterSpacing: "0.08em",
    color: "#999",
    border: "1px solid #e0dbd4",
    padding: "2px 7px",
    marginBottom: "6px",
  },
  productName: {
    margin: 0,
    fontWeight: 400,
  },
  productMeta: {
    color: "#999",
    fontSize: "13px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  toggleBtn: {
    padding: "12px 18px",
    border: "1px solid #111",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "22px",
  },
  card: {
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "22px",
  },
  cardWide: {
    gridColumn: "1 / -1",
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "22px",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: 400,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginBottom: "18px",
  },
  formRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "18px",
  },
  input: {
    flex: 1,
    padding: "12px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
  },
  colorInput: {
    width: "54px",
    height: "43px",
    border: "1px solid #ddd",
    background: "#fff",
  },
  textarea: {
    gridColumn: "1 / -1",
    minHeight: "80px",
    padding: "12px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
  },
  addBtn: {
    padding: "12px 18px",
    background: "#111",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
  },
  addBtnWide: {
    gridColumn: "1 / -1",
    padding: "14px",
    background: "#111",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "Georgia, serif",
  },
  list: {
    display: "grid",
    gap: "10px",
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #eee",
    padding: "12px",
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  colorDot: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "1px solid #ddd",
  },
  sizeList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  sizeItem: {
    border: "1px solid #ddd",
    padding: "10px 14px",
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  designPanel: {
    border: "1px solid #eee",
    background: "#fafafa",
    padding: "18px",
    marginTop: "8px",
    marginBottom: "8px",
  },
  optionForm: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "10px",
    marginBottom: "20px",
  },
  optionItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    border: "1px solid #eee",
    padding: "14px",
  },
  exampleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "14px",
  },
  exampleCard: {
    border: "1px solid #eee",
    padding: "10px",
    background: "#fafafa",
  },
  exampleImg: {
    width: "100%",
    height: "160px",
    objectFit: "cover",
    marginBottom: "8px",
  },
  deleteBtn: {
    padding: "8px 12px",
    border: "1px solid #d8b5b5",
    background: "#fff",
    color: "#b52a2a",
    cursor: "pointer",
  },
  smallDeleteBtn: {
    border: "none",
    background: "transparent",
    color: "#b52a2a",
    cursor: "pointer",
    fontSize: "18px",
  },
  centerPage: {
    padding: "100px",
    textAlign: "center",
    fontFamily: "Georgia, serif",
  },
  centerSmall: {
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "50px",
    textAlign: "center",
    color: "#999",
  },
};