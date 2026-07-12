import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import API_BASE from "../config/api";

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

  // Which design's "Available Colors & Sizes" editor is currently open —
  // only one at a time, matching the existing one-collection-open pattern.
  const [expandedDesignId, setExpandedDesignId] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      // Switching products invalidates whatever collection/design/design
      // editor was open — those belonged to the previous product's data.
      setSelectedCollectionId(null);
      setDesigns([]);
      setExpandedDesignId(null);
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
        setExpandedDesignId(null);
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
      setExpandedDesignId(null);

      return next;
    });
  }

  function toggleDesignAvailability(designId) {
    setExpandedDesignId((current) => (current === designId ? null : designId));
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
    <>
      <AdminNav />
      <div style={styles.page}>
      <div style={styles.container}>
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
                                <Fragment key={design.id}>
                                  <div style={styles.exampleCard}>
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
                                    <button
                                      onClick={() =>
                                        toggleDesignAvailability(design.id)
                                      }
                                      style={styles.manageAvailabilityBtn(
                                        expandedDesignId === design.id
                                      )}
                                    >
                                      {expandedDesignId === design.id
                                        ? "Hide Availability"
                                        : "Manage Availability"}
                                    </button>
                                  </div>

                                  {expandedDesignId === design.id && (
                                    <div style={styles.availabilityPanel}>
                                      <DesignAvailabilityEditor
                                        key={design.id}
                                        authFetch={authFetch}
                                        collectionId={collection.id}
                                        designId={design.id}
                                        productColors={colors}
                                        productSizes={sizes}
                                      />
                                    </div>
                                  )}
                                </Fragment>
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
    </>
  );
}

// Per-design "Available Colors & Sizes" editor. Mounted with key={designId}
// by the parent so switching designs fully resets this component's state
// (variants, drafts, errors) instead of carrying anything stale over.
function DesignAvailabilityEditor({
  authFetch,
  collectionId,
  designId,
  productColors,
  productSizes,
}) {
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(true);
  const [variantsError, setVariantsError] = useState("");

  // Keyed by color_id — which color's enable/reactivate/deactivate action
  // is currently in flight, and any error for that specific action.
  const [pendingColorId, setPendingColorId] = useState(null);
  const [colorActionError, setColorActionError] = useState({});

  // Keyed by variant_id — draft (unsaved) size selections, save-in-flight
  // state, and any save error, kept separate so a failed save never loses
  // the admin's in-progress selection.
  const [draftSizesByVariant, setDraftSizesByVariant] = useState({});
  const [savingVariantId, setSavingVariantId] = useState(null);
  const [sizeSaveError, setSizeSaveError] = useState({});
  const [sizeSaveSuccess, setSizeSaveSuccess] = useState({});

  useEffect(() => {
    loadVariants();
  }, []);

  async function loadVariants() {
    try {
      setVariantsLoading(true);
      setVariantsError("");

      const data = await authFetch(
        `${API_BASE}/admin/customization/collections/${collectionId}/designs/${designId}/variants`
      );
      const list = Array.isArray(data) ? data : [];
      setVariants(list);

      const drafts = {};
      for (const v of list) {
        drafts[v.id] = (v.size_restrictions || []).map((s) => s.id);
      }
      setDraftSizesByVariant(drafts);
    } catch (err) {
      setVariantsError(err.message);
    } finally {
      setVariantsLoading(false);
    }
  }

  function findVariantForColor(colorId) {
    return variants.find((v) => Number(v.color_id) === Number(colorId));
  }

  async function enableColor(colorId) {
    setPendingColorId(colorId);
    setColorActionError((prev) => ({ ...prev, [colorId]: "" }));

    try {
      // The backend POST endpoint already inserts-or-reactivates: if no
      // row exists it creates one, if an inactive row exists it reactivates
      // that same row (no duplicates), if an active row exists it 409s.
      await authFetch(
        `${API_BASE}/admin/customization/collections/${collectionId}/designs/${designId}/variants`,
        {
          method: "POST",
          body: JSON.stringify({ color_id: colorId }),
        }
      );
      await loadVariants();
    } catch (err) {
      setColorActionError((prev) => ({ ...prev, [colorId]: err.message }));
    } finally {
      setPendingColorId(null);
    }
  }

  async function setVariantActive(variant, isActive) {
    setPendingColorId(variant.color_id);
    setColorActionError((prev) => ({ ...prev, [variant.color_id]: "" }));

    try {
      // Reactivating a known row (we already have its id) goes through
      // PATCH rather than POST — more direct than re-deriving the row via
      // collection/design/color_id when we already hold its identity.
      await authFetch(`${API_BASE}/admin/customization/variants/${variant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      await loadVariants();
    } catch (err) {
      setColorActionError((prev) => ({
        ...prev,
        [variant.color_id]: err.message,
      }));
    } finally {
      setPendingColorId(null);
    }
  }

  function toggleDraftSize(variantId, sizeId) {
    setDraftSizesByVariant((prev) => {
      const current = prev[variantId] || [];
      const next = current.includes(sizeId)
        ? current.filter((id) => id !== sizeId)
        : [...current, sizeId];
      return { ...prev, [variantId]: next };
    });
  }

  async function saveSizes(variant) {
    setSavingVariantId(variant.id);
    setSizeSaveError((prev) => ({ ...prev, [variant.id]: "" }));

    try {
      const sizeIds = draftSizesByVariant[variant.id] || [];
      const updatedSizes = await authFetch(
        `${API_BASE}/admin/customization/variants/${variant.id}/sizes`,
        {
          method: "PUT",
          body: JSON.stringify({ size_ids: sizeIds }),
        }
      );

      // Patch just this one variant's saved size_restrictions locally
      // instead of refetching the whole list — keeps other variants'
      // in-progress drafts untouched.
      setVariants((prev) =>
        prev.map((v) =>
          v.id === variant.id ? { ...v, size_restrictions: updatedSizes } : v
        )
      );
      setDraftSizesByVariant((prev) => ({
        ...prev,
        [variant.id]: updatedSizes.map((s) => s.id),
      }));

      setSizeSaveSuccess((prev) => ({ ...prev, [variant.id]: true }));
      setTimeout(() => {
        setSizeSaveSuccess((prev) => ({ ...prev, [variant.id]: false }));
      }, 2000);
    } catch (err) {
      // Draft is intentionally left exactly as the admin set it — a failed
      // save must not revert or discard the in-progress selection.
      setSizeSaveError((prev) => ({ ...prev, [variant.id]: err.message }));
    } finally {
      setSavingVariantId(null);
    }
  }

  const activeColors = (productColors || []).filter((c) => c.is_active !== false);
  const activeSizes = (productSizes || []).filter((s) => s.is_active !== false);

  return (
    <>
      <h3 style={styles.availabilityTitle}>Available Colors &amp; Sizes</h3>
      <p style={styles.availabilityHint}>
        Choose which product colors support this design. Size restrictions
        are optional; leaving all sizes unselected means the design is
        available for every configured size.
      </p>

      {variantsLoading ? (
        <p style={{ color: "#999" }}>Loading availability...</p>
      ) : variantsError ? (
        <div style={styles.availabilityErrorBox}>
          <span>{variantsError}</span>
          <button onClick={loadVariants} style={styles.retryBtn}>
            Retry
          </button>
        </div>
      ) : activeColors.length === 0 ? (
        <p style={{ color: "#999" }}>
          This product has no active colors configured yet. Add colors above
          before configuring design availability.
        </p>
      ) : (
        <div style={styles.availabilityColorList}>
          {activeColors.map((color) => {
            const variant = findVariantForColor(color.id);
            const isPending = pendingColorId === color.id;
            const status = !variant
              ? "not-added"
              : variant.is_active
              ? "active"
              : "inactive";

            return (
              <div key={color.id} style={styles.availabilityColorRow}>
                <div style={styles.availabilityColorHeader}>
                  <span
                    style={{
                      ...styles.colorDot,
                      background: color.color_hex || "#ccc",
                    }}
                  />
                  <strong>{color.color_name}</strong>
                  <span style={styles.availabilityStatusBadge(status)}>
                    {status === "active"
                      ? "Active"
                      : status === "inactive"
                      ? "Inactive"
                      : "Not added"}
                  </span>

                  <div style={{ marginLeft: "auto" }}>
                    {status === "not-added" && (
                      <button
                        onClick={() => enableColor(color.id)}
                        disabled={isPending}
                        style={styles.addBtn}
                      >
                        {isPending ? "Adding..." : "Enable"}
                      </button>
                    )}
                    {status === "inactive" && (
                      <button
                        onClick={() => setVariantActive(variant, true)}
                        disabled={isPending}
                        style={styles.addBtn}
                      >
                        {isPending ? "Reactivating..." : "Reactivate"}
                      </button>
                    )}
                    {status === "active" && (
                      <button
                        onClick={() => setVariantActive(variant, false)}
                        disabled={isPending}
                        style={styles.deleteBtn}
                      >
                        {isPending ? "Deactivating..." : "Deactivate"}
                      </button>
                    )}
                  </div>
                </div>

                {colorActionError[color.id] && (
                  <p style={styles.availabilityErrorText}>
                    {colorActionError[color.id]}
                  </p>
                )}

                {status === "active" && variant && (
                  <div style={styles.availabilitySizeBlock}>
                    {activeSizes.length === 0 ? (
                      <p style={styles.mutedNote}>
                        This product currently uses a standard/no-size
                        option. No size restrictions are needed for this
                        design.
                      </p>
                    ) : (
                      <>
                        <div style={styles.availabilitySizeRow}>
                          {activeSizes.map((size) => {
                            const draft = draftSizesByVariant[variant.id] || [];
                            const selected = draft.includes(size.id);

                            return (
                              <button
                                key={size.id}
                                onClick={() =>
                                  toggleDraftSize(variant.id, size.id)
                                }
                                style={styles.sizeToggleBtn(selected)}
                              >
                                {size.size_label}
                              </button>
                            );
                          })}
                        </div>

                        <div style={styles.availabilitySizeFooter}>
                          <span style={styles.mutedNote}>
                            {(draftSizesByVariant[variant.id] || []).length === 0
                              ? "All product sizes"
                              : `${(draftSizesByVariant[variant.id] || []).length} size(s) selected`}
                          </span>

                          <button
                            onClick={() => saveSizes(variant)}
                            disabled={savingVariantId === variant.id}
                            style={styles.addBtn}
                          >
                            {savingVariantId === variant.id
                              ? "Saving..."
                              : "Save Sizes"}
                          </button>

                          {sizeSaveSuccess[variant.id] && (
                            <span style={styles.savedIndicator}>Saved</span>
                          )}
                        </div>

                        {sizeSaveError[variant.id] && (
                          <p style={styles.availabilityErrorText}>
                            {sizeSaveError[variant.id]}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
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

  // ---- Design availability (colors & sizes) editor ----
  manageAvailabilityBtn: (isOpen) => ({
    marginTop: "6px",
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #111",
    background: isOpen ? "#111" : "#fff",
    color: isOpen ? "#fff" : "#111",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "11px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  }),
  availabilityPanel: {
    gridColumn: "1 / -1",
    marginTop: "10px",
    marginBottom: "8px",
    paddingTop: "18px",
    borderTop: "2px solid #111",
  },
  availabilityTitle: {
    fontSize: "16px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  availabilityHint: {
    color: "#888",
    fontSize: "13px",
    lineHeight: 1.6,
    marginBottom: "16px",
    maxWidth: "640px",
  },
  availabilityErrorBox: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    background: "#fff0f0",
    border: "1px solid #f0b5b5",
    color: "#b52a2a",
    padding: "12px 14px",
  },
  availabilityColorList: {
    display: "grid",
    gap: "10px",
  },
  availabilityColorRow: {
    border: "1px solid #eee",
    padding: "14px",
    background: "#fff",
  },
  availabilityColorHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  availabilityStatusBadge: (status) => ({
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "3px 9px",
    background:
      status === "active"
        ? "#eaf5ea"
        : status === "inactive"
        ? "#f5f0e0"
        : "#f2f0eb",
    color:
      status === "active"
        ? "#2a7a2a"
        : status === "inactive"
        ? "#a07a1a"
        : "#999",
  }),
  availabilitySizeBlock: {
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid #f0eeea",
  },
  availabilitySizeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "10px",
  },
  sizeToggleBtn: (selected) => ({
    padding: "8px 12px",
    border: selected ? "1.5px solid #111" : "1px solid #ddd",
    background: selected ? "#111" : "#fff",
    color: selected ? "#fff" : "#111",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "12px",
  }),
  availabilitySizeFooter: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  mutedNote: {
    color: "#999",
    fontSize: "12px",
  },
  savedIndicator: {
    color: "#2a7a2a",
    fontSize: "12px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  availabilityErrorText: {
    color: "#b52a2a",
    fontSize: "12px",
    marginTop: "6px",
  },
  retryBtn: {
    background: "none",
    border: "none",
    borderBottom: "1px solid #b52a2a",
    color: "#b52a2a",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "12px",
    padding: 0,
  },
};