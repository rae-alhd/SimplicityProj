import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import API_BASE from "../config/api";

const PRODUCT_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "customizable", label: "Customizable" },
  { key: "ready_to_wear", label: "Ready-to-wear only" },
  { key: "in_stock", label: "In Stock" },
  { key: "out_of_stock", label: "Out of Stock" },
];

function productMatchesFilter(product, filterKey) {
  switch (filterKey) {
    case "active":
      return product.is_active !== false;
    case "inactive":
      return product.is_active === false;
    case "customizable":
      return product.is_customizable === true;
    case "ready_to_wear":
      return product.is_customizable !== true;
    case "in_stock":
      return Number(product.stock_quantity || 0) > 0;
    case "out_of_stock":
      return Number(product.stock_quantity || 0) <= 0;
    default:
      return true;
  }
}

function getStockBadge(product, threshold) {
  const stockQuantity = Number(product.stock_quantity || 0);

  if (stockQuantity <= 0) {
    return { label: "Out of stock", variant: "badgeBad" };
  }

  if (stockQuantity <= threshold) {
    return { label: `Low stock: ${stockQuantity}`, variant: "badgeWarning" };
  }

  return { label: `Stock: ${stockQuantity}`, variant: "badgeGood" };
}

function productMatchesSearch(product, normalizedTerm) {
  const fields = [product.name, product.category, product.target_group];
  return fields.some(
    (field) => field && field.toLowerCase().includes(normalizedTerm)
  );
}

// Task K2: pure helpers for the variant inventory matrix — kept free of
// component state so they're easy to reason about/test in isolation and
// never mutate anything passed in (colors/sizes/variants all come straight
// from the K1 GET .../inventory response).
function inventoryComboKey(colorId, sizeId) {
  return `${colorId === null || colorId === undefined ? "null" : colorId}:${sizeId}`;
}

// One row per size when the product has no active colors, otherwise one
// row per color with one column per size — matches exactly what the K1
// backend already considers "expected" for completeness.
function buildExpectedCombinations(colors, sizes) {
  if (!colors || colors.length === 0) {
    return (sizes || []).map((size) => ({
      color_id: null,
      size_id: size.id,
      color_name: null,
      size_label: size.size_label,
    }));
  }

  const combinations = [];
  for (const color of colors) {
    for (const size of sizes || []) {
      combinations.push({
        color_id: color.id,
        size_id: size.id,
        color_name: color.color_name,
        size_label: size.size_label,
      });
    }
  }
  return combinations;
}

// Builds the editable draft from the current inventory response: existing
// saved rows show their real quantity as a string, anything not yet saved
// starts blank ("") rather than "0" — zero is only ever a value the owner
// actually typed, never an assumption this code makes for them.
function buildDraftFromInventory(inventoryData) {
  if (!inventoryData) return {};

  const expected = buildExpectedCombinations(
    inventoryData.colors,
    inventoryData.sizes
  );
  const savedByKey = new Map(
    (inventoryData.variants || []).map((v) => [
      inventoryComboKey(v.color_id, v.size_id),
      v.stock_quantity,
    ])
  );

  const draft = {};
  for (const combo of expected) {
    const key = inventoryComboKey(combo.color_id, combo.size_id);
    const saved = savedByKey.get(key);
    draft[key] = saved === undefined ? "" : String(saved);
  }
  return draft;
}

// Validates every expected combination has a blank-free, nonnegative,
// whole-number entry, and returns the exact payload the PUT endpoint
// expects. Returns { ok: false, error } on the first problem found.
function validateInventoryDraft(inventoryData, draft) {
  const expected = buildExpectedCombinations(
    inventoryData?.colors,
    inventoryData?.sizes
  );

  if (expected.length === 0) {
    return { ok: false, error: "There are no active combinations to save." };
  }

  const variants = [];

  for (const combo of expected) {
    const key = inventoryComboKey(combo.color_id, combo.size_id);
    const raw = draft[key];

    if (raw === undefined || raw === null || String(raw).trim() === "") {
      return {
        ok: false,
        error:
          "Enter a nonnegative whole-number stock quantity for every active combination.",
      };
    }

    const trimmed = String(raw).trim();
    if (!/^\d+$/.test(trimmed)) {
      return {
        ok: false,
        error:
          "Enter a nonnegative whole-number stock quantity for every active combination.",
      };
    }

    const stockQuantity = Number(trimmed);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return {
        ok: false,
        error:
          "Enter a nonnegative whole-number stock quantity for every active combination.",
      };
    }

    variants.push({
      color_id: combo.color_id,
      size_id: combo.size_id,
      stock_quantity: stockQuantity,
    });
  }

  return { ok: true, variants };
}

export default function AdminProducts() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("all");

  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [thresholdInput, setThresholdInput] = useState("5");
  const [thresholdSaving, setThresholdSaving] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    target_group: "",
    base_price: "",
    image_url: "",
    description: "",
    stock_quantity: "",
    is_customizable: false,
    is_active: true,
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

  // Task K2: Variant Inventory — kept as its own isolated state group so it
  // can be reset in one place (the editingProduct?.id effect below) without
  // touching the unrelated colors/images state above.
  const [inventoryData, setInventoryData] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryDraft, setInventoryDraft] = useState({});
  const [inventoryDraftError, setInventoryDraftError] = useState("");
  const [inventorySaving, setInventorySaving] = useState(false);
  const [inventoryModeChanging, setInventoryModeChanging] = useState(false);
  const [inventorySuccessMessage, setInventorySuccessMessage] = useState("");

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch(`${API_BASE}/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchStoreSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      const threshold = Number(data.low_stock_threshold);

      if (Number.isInteger(threshold) && threshold >= 1) {
        setLowStockThreshold(threshold);
        setThresholdInput(String(threshold));
      }
    } catch (err) {
      console.error("Error fetching store settings:", err);
    }
  };

  const handleSaveThreshold = async () => {
    const parsedThreshold = Number(thresholdInput);

    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
      alert("Low stock alert must be a whole number of 1 or more.");
      return;
    }

    try {
      setThresholdSaving(true);

      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ low_stock_threshold: parsedThreshold }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not save low stock alert.");
        return;
      }

      setLowStockThreshold(Number(data.low_stock_threshold));
      setThresholdInput(String(data.low_stock_threshold));
    } catch (err) {
      console.error("Error saving store settings:", err);
      alert("Something went wrong while saving the low stock alert.");
    } finally {
      setThresholdSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = confirm("Delete this product?");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
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
        `${API_BASE}/products/${editingProduct.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...editingProduct,
            base_price: Number(editingProduct.base_price),
            stock_quantity:
              editingProduct.stock_quantity === "" ||
              editingProduct.stock_quantity == null
                ? 0
                : Number(editingProduct.stock_quantity),
            description: editingProduct.description || null,
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

      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newProduct,
          base_price: Number(newProduct.base_price),
          stock_quantity:
            newProduct.stock_quantity === ""
              ? 0
              : Number(newProduct.stock_quantity),
          description: newProduct.description || null,
        }),
      });

      const data = await res.json();
      console.log("Created:", data);

      const createdProduct = data?.product || data;

      fetchProducts();

      setNewProduct({
        name: "",
        category: "",
        target_group: "",
        base_price: "",
        image_url: "",
        description: "",
        stock_quantity: "",
        is_customizable: false,
        is_active: true,
      });

      if (res.ok && createdProduct?.id) {
        setEditingProduct(createdProduct);
      }
    } catch (err) {
      console.error("Create error:", err);
    }
  };

  const fetchProductImages = async (productId) => {
    try {
      setLoadingImages(true);
      const res = await fetch(
        `${API_BASE}/admin/products/${productId}/images`,
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
        `${API_BASE}/products/${productId}/colors`
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
        `${API_BASE}/admin/customization/${productId}/colors`,
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
        `${API_BASE}/admin/customization/${editingProduct.id}/colors`,
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
        `${API_BASE}/admin/customization/colors/${color.id}`,
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
        `${API_BASE}/admin/customization/colors/${color.id}`,
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

  const handleDeleteColor = async (color) => {
    const ok = window.confirm(
      "Permanently delete this color? This cannot be undone."
    );
    if (!ok) return;

    try {
      const res = await fetch(
        `${API_BASE}/admin/customization/colors/${color.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not delete color.");
        return;
      }

      fetchManageColors(editingProduct.id);
      fetchProductColors(editingProduct.id);
    } catch (err) {
      console.error("Delete color error:", err);
      alert("Something went wrong while deleting the color.");
    }
  };

  // Task K2: Variant Inventory — GET reloads the whole panel from the
  // server (source of truth) and rebuilds the draft from it, so a save or
  // mode switch always ends up showing exactly what's actually stored.
  const fetchInventory = async (productId) => {
    try {
      setInventoryLoading(true);
      setInventoryError("");

      const res = await fetch(
        `${API_BASE}/admin/products/${productId}/inventory`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();

      if (!res.ok) {
        setInventoryError(data.error || "Could not load inventory.");
        setInventoryData(null);
        setInventoryDraft({});
        return;
      }

      setInventoryData(data);
      setInventoryDraft(buildDraftFromInventory(data));
    } catch (err) {
      console.error("Fetch inventory error:", err);
      setInventoryError("Something went wrong while loading inventory.");
      setInventoryData(null);
      setInventoryDraft({});
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleInventoryCellChange = (colorId, sizeId, value) => {
    setInventoryDraftError("");
    setInventorySuccessMessage("");
    setInventoryDraft((prev) => ({
      ...prev,
      [inventoryComboKey(colorId, sizeId)]: value,
    }));
  };

  const handleSaveInventoryMatrix = async () => {
    if (!editingProduct || inventorySaving) return;

    const validation = validateInventoryDraft(inventoryData, inventoryDraft);
    if (!validation.ok) {
      setInventoryDraftError(validation.error);
      setInventorySuccessMessage("");
      return;
    }

    setInventoryDraftError("");
    setInventorySuccessMessage("");

    try {
      setInventorySaving(true);

      const res = await fetch(
        `${API_BASE}/admin/products/${editingProduct.id}/inventory/variants`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ variants: validation.variants }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setInventoryDraftError(data.error || "Could not save variant stock.");
        return;
      }

      await fetchInventory(editingProduct.id);
      setInventorySuccessMessage("Variant stock saved.");
    } catch (err) {
      console.error("Save inventory matrix error:", err);
      setInventoryDraftError("Something went wrong while saving variant stock.");
    } finally {
      setInventorySaving(false);
    }
  };

  const handleEnableVariantInventory = async () => {
    if (!editingProduct || inventoryModeChanging || !inventoryData?.is_complete)
      return;

    const ok = window.confirm(
      "Stock will now be tracked separately for each color and size. General stock will no longer control availability."
    );
    if (!ok) return;

    try {
      setInventoryModeChanging(true);
      setInventoryDraftError("");
      setInventorySuccessMessage("");

      const res = await fetch(
        `${API_BASE}/admin/products/${editingProduct.id}/inventory/mode`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ inventory_mode: "VARIANT" }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setInventoryDraftError(data.error || "Could not enable variant inventory.");
        return;
      }

      await fetchInventory(editingProduct.id);
      setInventorySuccessMessage("Variant inventory enabled.");
    } catch (err) {
      console.error("Enable variant inventory error:", err);
      setInventoryDraftError("Something went wrong while enabling variant inventory.");
    } finally {
      setInventoryModeChanging(false);
    }
  };

  const handleUseGeneralInventory = async () => {
    if (!editingProduct || inventoryModeChanging) return;

    const ok = window.confirm(
      "Saved variant quantities will be kept, but general stock will become the active inventory again."
    );
    if (!ok) return;

    try {
      setInventoryModeChanging(true);
      setInventoryDraftError("");
      setInventorySuccessMessage("");

      const res = await fetch(
        `${API_BASE}/admin/products/${editingProduct.id}/inventory/mode`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ inventory_mode: "GENERAL" }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setInventoryDraftError(data.error || "Could not switch to general inventory.");
        return;
      }

      await fetchInventory(editingProduct.id);
      setInventorySuccessMessage("Now using general inventory.");
    } catch (err) {
      console.error("Use general inventory error:", err);
      setInventoryDraftError("Something went wrong while switching inventory mode.");
    } finally {
      setInventoryModeChanging(false);
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
        `${API_BASE}/admin/products/${editingProduct.id}/images`,
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
        `${API_BASE}/admin/products/${editingProduct.id}/images/${imageId}/main`,
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
        `${API_BASE}/admin/products/${editingProduct.id}/images/${imageId}/deactivate`,
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
    fetchStoreSettings();
  }, [token, navigate]);

  useEffect(() => {
    if (editingProduct?.id) {
      fetchProductImages(editingProduct.id);
      fetchProductColors(editingProduct.id);
      fetchManageColors(editingProduct.id);
      fetchInventory(editingProduct.id);
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

    // Task K2: never let Product A's inventory data/draft/messages survive
    // into Product B's panel, or into no product being open at all.
    setInventoryData(null);
    setInventoryDraft({});
    setInventoryError("");
    setInventoryDraftError("");
    setInventorySuccessMessage("");
  }, [editingProduct?.id]);

  const filterFilteredProducts = products.filter((product) =>
    productMatchesFilter(product, productFilter)
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleProducts = normalizedSearch
    ? filterFilteredProducts.filter((product) =>
        productMatchesSearch(product, normalizedSearch)
      )
    : filterFilteredProducts;

  return (
    <>
      <AdminNav />
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
        </header>

        <section style={styles.formPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.smallEyebrow}>Product Management</p>
              <h2 style={styles.sectionTitle}>Add Product</h2>
              <p style={styles.muted}>
                Create the product first, then colors and image uploads will
                appear below.
              </p>
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
              style={styles.input}
              placeholder="Image URL"
              value={newProduct.image_url}
              onChange={(e) =>
                setNewProduct({ ...newProduct, image_url: e.target.value })
              }
            />

            <input
              style={styles.input}
              placeholder="Stock Quantity"
              type="number"
              value={newProduct.stock_quantity}
              onChange={(e) =>
                setNewProduct({
                  ...newProduct,
                  stock_quantity: e.target.value,
                })
              }
            />

            <textarea
              style={{ ...styles.input, ...styles.textarea, gridColumn: "span 3" }}
              placeholder="Description (optional)"
              value={newProduct.description}
              onChange={(e) =>
                setNewProduct({ ...newProduct, description: e.target.value })
              }
            />

            <label style={{ ...styles.checkboxLabel, gridColumn: "span 1" }}>
              <input
                type="checkbox"
                checked={newProduct.is_customizable}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    is_customizable: e.target.checked,
                  })
                }
              />
              Customizable product
            </label>

            <label style={{ ...styles.checkboxLabel, gridColumn: "span 2" }}>
              <input
                type="checkbox"
                checked={newProduct.is_active}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, is_active: e.target.checked })
                }
              />
              Active product
            </label>

            <button onClick={handleCreate} style={styles.addBtn}>
              Create Product
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
              {loadingProducts
                ? "Loading..."
                : `${visibleProducts.length} products`}
            </span>
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by name, category, target..."
            style={styles.searchInput}
          />

          <div style={styles.filterRow}>
            {PRODUCT_FILTERS.map((filterOption) => (
              <button
                key={filterOption.key}
                onClick={() => setProductFilter(filterOption.key)}
                style={{
                  ...styles.filterChip,
                  ...(productFilter === filterOption.key
                    ? styles.filterChipActive
                    : {}),
                }}
              >
                {filterOption.label}
              </button>
            ))}
          </div>

          <div style={styles.thresholdRow}>
            <label style={styles.thresholdLabel} htmlFor="low-stock-threshold">
              Low stock alert at
            </label>
            <input
              id="low-stock-threshold"
              type="number"
              min="1"
              step="1"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              style={styles.thresholdInput}
            />
            <button
              onClick={handleSaveThreshold}
              disabled={thresholdSaving}
              style={styles.editBtn}
            >
              {thresholdSaving ? "Saving..." : "Save"}
            </button>
          </div>

          {!loadingProducts && visibleProducts.length === 0 && (
            <p style={styles.muted}>No products match your search.</p>
          )}

          <div style={styles.productList}>
            {visibleProducts.map((product) => (
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
                    <div style={styles.badgeRow}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(product.is_active !== false
                            ? styles.badgeGood
                            : styles.badgeBad),
                        }}
                      >
                        {product.is_active !== false ? "Active" : "Inactive"}
                      </span>

                      <span
                        style={{
                          ...styles.badge,
                          ...styles.badgeNeutral,
                        }}
                      >
                        {product.is_customizable
                          ? "Customizable"
                          : "Ready-to-wear"}
                      </span>

                      {(() => {
                        const stockBadge = getStockBadge(product, lowStockThreshold);
                        return (
                          <span
                            style={{
                              ...styles.badge,
                              ...styles[stockBadge.variant],
                            }}
                          >
                            {stockBadge.label}
                          </span>
                        );
                      })()}
                    </div>
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
                style={styles.input}
                value={editingProduct.image_url || ""}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    image_url: e.target.value,
                  })
                }
              />

              <input
                style={styles.input}
                placeholder="Stock Quantity"
                type="number"
                value={editingProduct.stock_quantity || ""}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    stock_quantity: e.target.value,
                  })
                }
              />

              <textarea
                style={{ ...styles.input, ...styles.textarea, gridColumn: "span 3" }}
                placeholder="Description (optional)"
                value={editingProduct.description || ""}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    description: e.target.value,
                  })
                }
              />

              <label style={{ ...styles.checkboxLabel, gridColumn: "span 1" }}>
                <input
                  type="checkbox"
                  checked={!!editingProduct.is_customizable}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      is_customizable: e.target.checked,
                    })
                  }
                />
                Customizable product
              </label>

              <label style={{ ...styles.checkboxLabel, gridColumn: "span 2" }}>
                <input
                  type="checkbox"
                  checked={editingProduct.is_active !== false}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      is_active: e.target.checked,
                    })
                  }
                />
                Active product
              </label>

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
                          <>
                            <button
                              onClick={() => handleToggleColorActive(color)}
                              style={styles.imageActionBtn}
                            >
                              Reactivate
                            </button>
                            <button
                              onClick={() => handleDeleteColor(color)}
                              style={styles.imageDeleteBtn}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Task K2: Variant Inventory — owner-facing matrix built on
                top of the Task K1 GET/PUT/PATCH inventory endpoints. Does
                not affect Cart/checkout/customer pages in any way yet. */}
            <div style={styles.inventorySection}>
              <p style={styles.smallEyebrow}>Inventory</p>

              {inventoryLoading ? (
                <p style={styles.muted}>Loading inventory...</p>
              ) : inventoryError ? (
                <p style={{ ...styles.muted, color: "#b52a2a" }}>
                  {inventoryError}
                </p>
              ) : !inventoryData ? null : (
                <>
                  <div style={styles.inventoryModeRow}>
                    <span
                      style={
                        inventoryData.inventory_mode === "VARIANT"
                          ? styles.mainBadge
                          : styles.imageColorTag
                      }
                    >
                      {inventoryData.inventory_mode === "VARIANT"
                        ? "Variant inventory"
                        : "General inventory"}
                    </span>
                    <span style={styles.muted}>
                      General stock: {inventoryData.general_stock_quantity ?? 0}
                    </span>
                  </div>

                  {inventoryData.inventory_mode === "GENERAL" && (
                    <p style={styles.muted}>
                      This product currently uses one stock quantity for all
                      selections.
                    </p>
                  )}

                  {inventoryData.sizes.length === 0 ? (
                    <p style={{ ...styles.muted, marginTop: "10px" }}>
                      Variant inventory requires configured sizes. This
                      product must use General inventory.
                    </p>
                  ) : (
                    <>
                      <div style={styles.inventoryStatusRow}>
                        <span
                          style={
                            inventoryData.is_complete
                              ? styles.badgeGoodInline
                              : styles.badgeWarningInline
                          }
                        >
                          {inventoryData.is_complete
                            ? "Inventory matrix complete"
                            : `${inventoryData.configured_combinations} of ${inventoryData.expected_combinations} combinations configured`}
                        </span>
                      </div>

                      {inventoryData.inventory_mode === "VARIANT" &&
                        !inventoryData.is_complete && (
                          <p style={styles.inventoryWarningBox}>
                            Variant inventory is incomplete. Configure every
                            active combination before customer inventory is
                            enabled.
                          </p>
                        )}

                      {inventoryData.inventory_mode === "GENERAL" && (
                        <p style={styles.inventoryWarningBox}>
                          General stock will not be copied automatically.
                          Enter stock for every combination first.
                        </p>
                      )}

                      <div style={styles.inventoryTableWrap}>
                        <table style={styles.inventoryTable}>
                          <thead>
                            <tr>
                              <th style={styles.inventoryTh}>
                                {inventoryData.colors.length > 0
                                  ? "Color"
                                  : "Size"}
                              </th>
                              {inventoryData.colors.length > 0 &&
                                inventoryData.sizes.map((size) => (
                                  <th key={size.id} style={styles.inventoryTh}>
                                    {size.size_label}
                                  </th>
                                ))}
                              {inventoryData.colors.length === 0 && (
                                <th style={styles.inventoryTh}>Stock</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {inventoryData.colors.length > 0
                              ? inventoryData.colors.map((color) => (
                                  <tr key={color.id}>
                                    <td style={styles.inventoryTd}>
                                      <span
                                        style={{
                                          ...styles.colorSwatch,
                                          background: color.color_hex || "#eee",
                                          marginRight: "8px",
                                          verticalAlign: "middle",
                                        }}
                                      />
                                      {color.color_name}
                                    </td>
                                    {inventoryData.sizes.map((size) => (
                                      <td key={size.id} style={styles.inventoryTd}>
                                        <input
                                          type="number"
                                          min="0"
                                          step="1"
                                          style={styles.inventoryCellInput}
                                          placeholder="—"
                                          value={
                                            inventoryDraft[
                                              inventoryComboKey(color.id, size.id)
                                            ] ?? ""
                                          }
                                          onChange={(e) =>
                                            handleInventoryCellChange(
                                              color.id,
                                              size.id,
                                              e.target.value
                                            )
                                          }
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))
                              : inventoryData.sizes.map((size) => (
                                  <tr key={size.id}>
                                    <td style={styles.inventoryTd}>
                                      {size.size_label}
                                    </td>
                                    <td style={styles.inventoryTd}>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        style={styles.inventoryCellInput}
                                        placeholder="—"
                                        value={
                                          inventoryDraft[
                                            inventoryComboKey(null, size.id)
                                          ] ?? ""
                                        }
                                        onChange={(e) =>
                                          handleInventoryCellChange(
                                            null,
                                            size.id,
                                            e.target.value
                                          )
                                        }
                                      />
                                    </td>
                                  </tr>
                                ))}
                          </tbody>
                        </table>
                      </div>

                      {!inventoryData.is_complete &&
                        inventoryData.missing_combinations.length > 0 && (
                          <p style={styles.muted}>
                            Missing:{" "}
                            {inventoryData.missing_combinations
                              .map((combo) =>
                                combo.color_name
                                  ? `${combo.color_name} / ${combo.size_label}`
                                  : combo.size_label
                              )
                              .join(", ")}
                          </p>
                        )}

                      {inventoryDraftError && (
                        <p style={styles.inventoryErrorBox}>
                          {inventoryDraftError}
                        </p>
                      )}

                      {inventorySuccessMessage && (
                        <p style={styles.inventorySuccessBox}>
                          {inventorySuccessMessage}
                        </p>
                      )}

                      <div style={styles.inventoryActionsRow}>
                        <button
                          onClick={handleSaveInventoryMatrix}
                          disabled={inventorySaving}
                          style={styles.editBtn}
                        >
                          {inventorySaving ? "Saving..." : "Save variant stock"}
                        </button>

                        {inventoryData.inventory_mode === "GENERAL" ? (
                          <button
                            onClick={handleEnableVariantInventory}
                            disabled={
                              inventoryModeChanging || !inventoryData.is_complete
                            }
                            style={{
                              ...styles.editBtn,
                              opacity:
                                inventoryModeChanging || !inventoryData.is_complete
                                  ? 0.5
                                  : 1,
                              cursor:
                                inventoryModeChanging || !inventoryData.is_complete
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            Enable variant inventory
                          </button>
                        ) : (
                          <button
                            onClick={handleUseGeneralInventory}
                            disabled={inventoryModeChanging}
                            style={styles.editBtn}
                          >
                            Use general inventory
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
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
    </>
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
  searchInput: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
    fontSize: "14px",
    background: "#fff",
    boxSizing: "border-box",
    marginBottom: "14px",
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "18px",
  },
  filterChip: {
    padding: "7px 14px",
    border: "1px solid #e0dbd4",
    background: "#fff",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    fontSize: "12px",
    color: "#888",
  },
  filterChipActive: {
    background: "#111",
    color: "#fff",
    borderColor: "#111",
  },
  thresholdRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "18px",
    paddingBottom: "18px",
    borderBottom: "1px solid #eee",
  },
  thresholdLabel: {
    fontSize: "12px",
    color: "#888",
    fontFamily: "Georgia, serif",
  },
  thresholdInput: {
    width: "70px",
    padding: "8px 10px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
    fontSize: "14px",
    background: "#fff",
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
  textarea: {
    resize: "vertical",
    minHeight: "70px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
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
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "6px",
  },
  badge: {
    display: "inline-block",
    padding: "3px 7px",
    fontSize: "9px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  badgeGood: {
    background: "#eaf5ec",
    color: "#1a7a45",
  },
  badgeBad: {
    background: "#fbeaea",
    color: "#b52a2a",
  },
  badgeWarning: {
    background: "#fdf3e0",
    color: "#b07d2a",
  },
  badgeNeutral: {
    background: "#111",
    color: "#fff",
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
  // ---- Task K2: Variant Inventory ----
  inventorySection: {
    marginTop: "24px",
    paddingTop: "20px",
    borderTop: "1px solid #eee",
  },
  inventoryModeRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "8px",
  },
  inventoryStatusRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    margin: "10px 0",
  },
  badgeGoodInline: {
    display: "inline-block",
    padding: "4px 9px",
    fontSize: "11px",
    letterSpacing: "0.06em",
    background: "#eaf5ec",
    color: "#1a7a45",
  },
  badgeWarningInline: {
    display: "inline-block",
    padding: "4px 9px",
    fontSize: "11px",
    letterSpacing: "0.06em",
    background: "#fdf3e0",
    color: "#b07d2a",
  },
  inventoryWarningBox: {
    background: "#fff8e6",
    border: "1px solid #e8d9a8",
    color: "#8a6d1f",
    fontSize: "12px",
    padding: "10px 12px",
    margin: "10px 0",
  },
  inventoryErrorBox: {
    background: "#fbeaea",
    border: "1px solid #f0b5b5",
    color: "#b52a2a",
    fontSize: "12px",
    padding: "10px 12px",
    margin: "10px 0",
  },
  inventorySuccessBox: {
    background: "#eaf5ec",
    border: "1px solid #b3ddc0",
    color: "#1a7a45",
    fontSize: "12px",
    padding: "10px 12px",
    margin: "10px 0",
  },
  inventoryTableWrap: {
    overflowX: "auto",
    marginTop: "8px",
    border: "1px solid #eee",
  },
  inventoryTable: {
    borderCollapse: "collapse",
    width: "100%",
    minWidth: "360px",
    fontFamily: "Georgia, serif",
    fontSize: "13px",
  },
  inventoryTh: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid #ddd",
    background: "#faf9f7",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#888",
    whiteSpace: "nowrap",
  },
  inventoryTd: {
    padding: "8px 12px",
    borderBottom: "1px solid #f0f0f0",
    whiteSpace: "nowrap",
  },
  inventoryCellInput: {
    width: "64px",
    padding: "7px 8px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
    fontSize: "13px",
    textAlign: "center",
  },
  inventoryActionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "14px",
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
