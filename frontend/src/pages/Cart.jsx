import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE from "../config/api";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f5f5f3",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    padding: "48px 16px",
  },
  container: {
    maxWidth: "680px",
    margin: "0 auto",
  },
  heading: {
    fontSize: "11px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#888",
    fontWeight: 500,
    marginBottom: "32px",
  },
  // ── Cart Item Card ──
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #ebebeb",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "10px",
    transition: "opacity 0.2s ease",
  },
  imagePlaceholder: {
    width: "84px",
    minWidth: "84px",
    height: "108px",
    backgroundColor: "#f0f0ee",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #e8e8e6",
  },
  itemBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  itemName: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#111",
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  itemMeta: {
    fontSize: "12px",
    color: "#999",
    letterSpacing: "0.04em",
    marginBottom: "4px",
  },
  
  customBox: {
    marginTop: "6px",
    padding: "8px 10px",
    backgroundColor: "#faf8f4",
    border: "1px solid #eee4d8",
    borderRadius: "8px",
    fontSize: "11px",
    color: "#777",
    lineHeight: 1.6,
  },
  
  customBadge: {
    display: "inline-block",
    marginBottom: "4px",
    padding: "2px 6px",
    backgroundColor: "#111",
    color: "#fff",
    fontSize: "9px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    borderRadius: "3px",
  },

  designBox: {
    marginTop: "6px",
    paddingTop: "6px",
    borderTop: "1px solid #eee4d8",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  designBoxText: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  designThumb: {
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    objectFit: "cover",
    border: "1px solid #eee4d8",
    flexShrink: 0,
  },

  itemPrice: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#111",
  },
  stockText: {
    fontSize: "11px",
    color: "#888",
    marginTop: "4px",
  },
  stockTextOut: {
    fontSize: "11px",
    color: "#e05252",
    marginTop: "4px",
  },
  maxStockText: {
    fontSize: "10px",
    color: "#e05252",
    marginTop: "4px",
  },
  itemFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "14px",
  },
  // ── Quantity Control ──
  qtyControl: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #ddd",
    borderRadius: "8px",
    overflow: "hidden",
  },
  qtyBtn: {
    width: "34px",
    height: "34px",
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    color: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    transition: "background 0.15s",
  },
  qtyNum: {
    width: "34px",
    height: "34px",
    textAlign: "center",
    fontSize: "13px",
    fontWeight: 500,
    color: "#111",
    borderLeft: "1px solid #ebebeb",
    borderRight: "1px solid #ebebeb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
  },
  // ── Trash Button ──
  trashBtn: {
    width: "34px",
    height: "34px",
    border: "none",
    background: "none",
    cursor: "pointer",
    color: "#bbb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    transition: "color 0.15s, background 0.15s",
  },
  // ── Summary ──
  summary: {
    backgroundColor: "#ffffff",
    border: "1px solid #ebebeb",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "12px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "#999",
    padding: "5px 0",
  },
  summaryDivider: {
    border: "none",
    borderTop: "1px solid #ebebeb",
    margin: "12px 0",
  },
  summaryTotal: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "15px",
    fontWeight: 500,
    color: "#111",
    padding: "4px 0",
  },
  checkoutBtn: {
    width: "100%",
    marginTop: "16px",
    padding: "15px",
    backgroundColor: "#111",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  // ── Empty State ──
  emptyState: {
    textAlign: "center",
    padding: "64px 0",
    color: "#bbb",
    fontSize: "13px",
    letterSpacing: "0.04em",
  },
  // ── Loading ──
  loading: {
    textAlign: "center",
    padding: "64px 0",
    color: "#bbb",
    fontSize: "13px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
};

// ─── Stock availability helper ─────────────────────────────────────────────────
// Customers must never see the raw stock_quantity number (business rule).
// The real configurable threshold (store_settings.low_stock_threshold) lives
// behind an admin-only endpoint (GET /api/admin/settings), so it isn't
// reachable from this customer-facing page without adding a new backend
// route — out of scope for this pass. These thresholds mirror the backend's
// own default (store_settings.low_stock_threshold defaults to 5).
const LOW_STOCK_THRESHOLD = 5;
const ALMOST_GONE_THRESHOLD = 2;

function getStockAvailability(stockQuantity) {
  const qty = Number(stockQuantity || 0);
  if (qty <= 0) return "Out of stock";
  if (qty <= ALMOST_GONE_THRESHOLD) return "Almost gone";
  if (qty <= LOW_STOCK_THRESHOLD) return "Low stock";
  return "Available";
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ccc"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CartItem({ item, onChangeQty, onRemove }) {
  const [trashHover, setTrashHover] = useState(false);
  const [minusHover, setMinusHover] = useState(false);
  const [plusHover, setPlusHover] = useState(false);

  const stockQuantity = Number(item.stock_quantity || 0);
  const isOutOfStock = stockQuantity <= 0;
  const isMaxStock = !isOutOfStock && item.quantity >= stockQuantity;
  const isPlusDisabled = isOutOfStock || isMaxStock;
  const availability = getStockAvailability(stockQuantity);

  return (
    <div style={styles.card}>
      {/* Image placeholder — swap with <img> once you have product images */}
      <div style={styles.imagePlaceholder}>
        {item.main_image_url || item.image_url ? (
          <img
            src={item.main_image_url || item.image_url}
            alt={item.product_name}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }}
          />
        ) : (
          <ImageIcon />
        )}
      </div>

      <div style={styles.itemBody}>
  <div style={styles.itemName}>
    {item.product_name || `Product #${item.product_id}`}
  </div>

  <div style={styles.itemMeta}>
    {item.color} · {item.size}
  </div>

  {item.is_customized && (
    <div style={styles.customBox}>
      <span style={styles.customBadge}>Customized</span>

      {item.customization_label && (
        <div>
          <strong>Placement:</strong> {item.customization_label}
        </div>
      )}

      {item.custom_text && (
        <div>
          <strong>Text:</strong> {item.custom_text}
        </div>
      )}

      {item.custom_note && (
        <div>
          <strong>Note:</strong> {item.custom_note}
        </div>
      )}

      {item.design_label && (
        <div style={styles.designBox}>
          <div style={styles.designBoxText}>
            {item.collection_name && (
              <div>
                <strong>Collection:</strong> {item.collection_name}
              </div>
            )}
            <div>
              <strong>Design:</strong> {item.design_label}
            </div>
          </div>

          {item.design_image_url && (
            <img
              src={item.design_image_url}
              alt={item.design_label}
              style={styles.designThumb}
            />
          )}
        </div>
      )}
    </div>
  )}

  {item.price && (
    <div style={styles.itemPrice}>${Number(item.price).toFixed(2)}</div>
  )}

  <div style={isOutOfStock ? styles.stockTextOut : styles.stockText}>
    {availability}
  </div>

  <div style={styles.itemFooter}>
          {/* Quantity stepper */}
          <div style={styles.qtyControl}>
            <button
              style={{
                ...styles.qtyBtn,
                backgroundColor: minusHover ? "#f5f5f3" : "transparent",
              }}
              onMouseEnter={() => setMinusHover(true)}
              onMouseLeave={() => setMinusHover(false)}
              onClick={() => onChangeQty(item.id, -1)}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span style={styles.qtyNum}>{item.quantity}</span>
            <button
              style={{
                ...styles.qtyBtn,
                backgroundColor: plusHover && !isPlusDisabled ? "#f5f5f3" : "transparent",
                opacity: isPlusDisabled ? 0.4 : 1,
                cursor: isPlusDisabled ? "not-allowed" : "pointer",
              }}
              onMouseEnter={() => setPlusHover(true)}
              onMouseLeave={() => setPlusHover(false)}
              onClick={() => onChangeQty(item.id, 1)}
              disabled={isPlusDisabled}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Remove button */}
          <button
            style={{
              ...styles.trashBtn,
              color: trashHover ? "#e05252" : "#bbb",
              backgroundColor: trashHover ? "#fef2f2" : "transparent",
            }}
            onMouseEnter={() => setTrashHover(true)}
            onMouseLeave={() => setTrashHover(false)}
            onClick={() => onRemove(item.id)}
            aria-label="Remove item"
          >
            <TrashIcon />
          </button>
        </div>

        {isMaxStock && (
          <div style={styles.maxStockText}>Max stock reached</div>
        )}
      </div>
    </div>
  );
}

function OrderSummary({ cart }) {
  const [btnHover, setBtnHover] = useState(false);
  const navigate = useNavigate();

  const subtotal = cart.reduce((sum, item) => {
    return sum + (Number(item.price) || 0) * item.quantity;
  }, 0);

  return (
    <div style={styles.summary}>
      <div style={styles.summaryRow}>
        <span>Subtotal</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      <div style={styles.summaryRow}>
        <span>Shipping</span>
        <span>Free</span>
      </div>
      <hr style={styles.summaryDivider} />
      <div style={styles.summaryTotal}>
        <span>Total</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      <button
  style={{
    ...styles.checkoutBtn,
    opacity: btnHover ? 0.75 : 1,
  }}
  onClick={() => navigate("/checkout")}
  onMouseEnter={() => setBtnHover(true)}
  onMouseLeave={() => setBtnHover(false)}
>
  Proceed to Checkout
</button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Cart() {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchCart = async () => {
    try {
      const token = localStorage.getItem("token");
  
      const res = await fetch(`${API_BASE}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      const data = await res.json();
      setCart(data);
  
      return data; 
    } catch (err) {
      console.error("Fetch cart error:", err);
    }
  };

  useEffect(() => {
    fetchCart().then(() => setLoading(false));
  }, []);

  const handleChangeQty = async (id, delta) => {
    try {
      const token = localStorage.getItem("token");

      const item = cart.find((i) => i.id === id);
      const stockQuantity = Number(item.stock_quantity || 0);
      const newQuantity = Math.max(1, item.quantity + delta);

      if (delta > 0 && newQuantity > stockQuantity) {
        alert(`Only ${stockQuantity} item(s) available in stock.`);
        return;
      }

      await fetch(`${API_BASE}/cart/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: newQuantity }),
      });
  
      await fetchCart();
  
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleRemove = async (id) => {
    try {
      const token = localStorage.getItem("token");
  
      await fetch(`${API_BASE}/cart/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      //update UI instantly
      fetchCart();
  
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <p style={styles.heading}>
          Your Cart {!loading && `— ${cart.length} item${cart.length !== 1 ? "s" : ""}`}
        </p>

        {loading ? (
          <div style={styles.loading}>Loading…</div>
        ) : cart.length === 0 ? (
          <div style={styles.emptyState}>Your cart is empty</div>
        ) : (
          <>
            {cart.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onChangeQty={handleChangeQty}
                onRemove={handleRemove}
              />
            ))}
            <OrderSummary cart={cart} />
          </>
        )}
      </div>
    </div>
  );
}

export default Cart;