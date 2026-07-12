import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API_BASE from "../config/api";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   bg: "#fff8ec", color: "#b07d2a", border: "#f0d9a0", dot: "#e6a820" },
  confirmed: { label: "Confirmed", bg: "#edf6ff", color: "#1a6fb5", border: "#b3d4f5", dot: "#1a6fb5" },
  delivered: { label: "Delivered", bg: "#edfbf3", color: "#1a7a45", border: "#a3dfc0", dot: "#1a7a45" },
  cancelled: { label: "Cancelled", bg: "#fdf2f2", color: "#b52a2a", border: "#f0b3b3", dot: "#c0392b" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "5px 12px",
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: "0.68rem", letterSpacing: "0.14em",
      textTransform: "uppercase", fontFamily: "sans-serif", fontWeight: "500",
    }}>
      <span style={{
        width: "6px", height: "6px", borderRadius: "50%",
        background: cfg.dot, flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  );
}

function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];

  const date = order.created_at
    ? new Date(order.created_at).toLocaleDateString("tr-TR", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "—";

  const total = order.total_price
    ? `₺${Number(order.total_price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`
    : "—";

  return (
    <div style={s.card}>
      {/* ── Header ── */}
      <div style={s.cardHeader}>
        <div style={s.cardHeaderLeft}>
          <div>
            <span style={s.orderNum}>Order #{String(order.id).padStart(5, "0")}</span>
            <span style={s.orderDate}>{date}</span>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* ── Summary Row ── */}
      <div style={s.summaryRow}>
        <div style={s.summaryBlock}>
          <span style={s.summaryLabel}>Total</span>
          <span style={s.summaryValue}>{total}</span>
        </div>
        <div style={s.summaryBlock}>
          <span style={s.summaryLabel}>Items</span>
          <span style={s.summaryValue}>
            {items.reduce((n, i) => n + (i.quantity || 0), 0)} piece{items.reduce((n, i) => n + (i.quantity || 0), 0) !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ ...s.summaryBlock, flex: 2 }}>
          <span style={s.summaryLabel}>Delivery Address</span>
          <span style={{ ...s.summaryValue, fontSize: "0.82rem", color: "#555", fontFamily: "sans-serif", lineHeight: "1.5" }}>
            {order.address || "—"}
          </span>
        </div>
      </div>

      {order.notes && (
        <div style={s.notesRow}>
          <span style={s.summaryLabel}>Note</span>
          <span style={s.notesText}>"{order.notes}"</span>
        </div>
      )}

      {/* ── Items Accordion ── */}
      {items.length > 0 && (
        <div style={s.accordionWrapper}>
          <button style={s.accordionBtn} onClick={() => setExpanded(p => !p)}>
            <span>{expanded ? "▲" : "▼"}&nbsp;&nbsp;{expanded ? "Hide" : "View"} order items</span>
            <span style={s.itemCount}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
          </button>

          {expanded && (
            <div style={s.itemsList}>
              {items.map((item, idx) => (
                <div key={idx} style={{
                  ...s.itemRow,
                  borderTop: idx === 0 ? "none" : "1px solid #f5f2ee",
                }}>
                  {/* Left: item info */}
                  <div style={s.itemInfo}>
                    <span style={s.itemName}>{item.product_name || "Product"}</span>
                    <div style={s.itemMeta}>
  {item.size && <span style={s.metaTag}>Size: {item.size}</span>}
  {item.color && <span style={s.metaTag}>Color: {item.color}</span>}
  <span style={s.metaTag}>Qty: {item.quantity}</span>
</div>

{item.is_customized && (
  <div style={s.customDetails}>
    <span style={s.customBadge}>Customized</span>

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
      <div style={s.designBox}>
        <div style={s.designBoxText}>
          {item.collection_name && (
            <div>
              <strong>Collection:</strong> {item.collection_name}
            </div>
          )}
          <div>
            <strong>Design:</strong> {item.design_label}
            {item.design_color_name ? ` — ${item.design_color_name}` : ""}
          </div>
        </div>

        {(item.design_preview_image_url || item.design_image_url) && (
          <img
            src={item.design_preview_image_url || item.design_image_url}
            alt={item.design_label}
            style={s.designThumb}
          />
        )}
      </div>
    )}
  </div>
)}
                  </div>
                  {/* Right: price */}
                  <div style={s.itemPricing}>
                    <span style={s.unitPrice}>
                      ₺{Number(item.unit_price || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} each
                    </span>
                    <span style={s.lineTotal}>
                      ₺{(Number(item.unit_price || 0) * item.quantity).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}

              {/* Items subtotal */}
              <div style={s.itemsFooter}>
                <span style={s.summaryLabel}>Order Total</span>
                <span style={{ fontSize: "1rem", fontWeight: "500", letterSpacing: "0.04em" }}>{total}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Status message ── */}
      {order.status === "delivered" && (
        <div style={s.statusMessage}>
          ✓ &nbsp;Your order has been delivered. We hope you love your purchase.
        </div>
      )}
      {order.status === "cancelled" && (
        <div style={{ ...s.statusMessage, background: "#fdf2f2", color: "#b52a2a", borderColor: "#f0b3b3" }}>
          ✕ &nbsp;This order was cancelled.
        </div>
      )}
    </div>
  );
}

export default function MyOrders() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const navigate              = useNavigate();
  const token                 = localStorage.getItem("token");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }

    fetch(`${API_BASE}/orders/my`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error("Could not load your orders.");
        return r.json();
      })
      .then(data => {
        const list = Array.isArray(data) ? data : data.orders || [];
        // Most recent first
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setOrders(list);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [token, navigate]);

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* ── Page Title ── */}
        <div style={s.pageTop}>
          <h1 style={s.title}>My Orders</h1>
          <div style={s.titleDivider} />
          <p style={s.subtitle}>Track and review your Simplicity purchases</p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={s.centerState}>
            <div style={s.spinner} />
            <p style={s.stateText}>Loading your orders…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={s.errorBox}>
            <strong>Something went wrong:</strong> {error}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && orders.length === 0 && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>◻</div>
            <p style={s.emptyTitle}>No orders yet</p>
            <p style={s.emptyBody}>
              When you place an order, it will appear here so you can track its progress.
            </p>
            <Link to="/" style={s.shopLink}>Start Shopping</Link>
          </div>
        )}

        {/* ── Order Cards ── */}
        {!loading && !error && orders.length > 0 && (
          <>
            <p style={s.orderCount}>
              {orders.length} order{orders.length !== 1 ? "s" : ""} placed
            </p>
            <div style={s.list}>
              {orders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  page: {
    minHeight: "100vh",
    background: "#faf9f7",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    color: "#1a1a1a",
    paddingTop: "80px",
    paddingBottom: "100px",
  },
  container: {
    maxWidth: "780px",
    margin: "0 auto",
    padding: "0 24px",
  },

  // Page title
  pageTop: { textAlign: "center", marginBottom: "52px" },
  title: {
    fontSize: "clamp(1.5rem, 3vw, 2rem)",
    fontWeight: "400",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    margin: "0 0 14px",
  },
  titleDivider: {
    width: "36px", height: "1px",
    background: "#c8b99a",
    margin: "0 auto 16px",
  },
  subtitle: {
    fontSize: "0.75rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#aaa",
    margin: 0,
    fontFamily: "sans-serif",
  },

  orderCount: {
    fontSize: "0.7rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#bbb",
    fontFamily: "sans-serif",
    marginBottom: "20px",
    textAlign: "right",
  },

  // States
  centerState: { textAlign: "center", padding: "80px 0" },
  stateText: {
    color: "#aaa", fontSize: "0.85rem",
    letterSpacing: "0.06em", fontFamily: "sans-serif", marginTop: "16px",
  },
  spinner: {
    width: "26px", height: "26px",
    border: "2px solid #e8e2d9",
    borderTop: "2px solid #1a1a1a",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto",
  },
  errorBox: {
    background: "#fff5f5", border: "1px solid #f0c0c0",
    color: "#c0392b", padding: "14px 18px",
    fontSize: "0.82rem", fontFamily: "sans-serif", marginBottom: "24px",
  },
  emptyState: {
    textAlign: "center",
    padding: "80px 24px",
    border: "1px solid #e8e2d9",
    background: "#fff",
  },
  emptyIcon: {
    fontSize: "2.5rem", color: "#d8d0c4", marginBottom: "20px",
  },
  emptyTitle: {
    fontSize: "1rem", letterSpacing: "0.12em",
    textTransform: "uppercase", color: "#888",
    margin: "0 0 12px",
  },
  emptyBody: {
    fontSize: "0.82rem", color: "#aaa",
    fontFamily: "sans-serif", lineHeight: "1.7",
    maxWidth: "320px", margin: "0 auto 28px",
  },
  shopLink: {
    display: "inline-block",
    padding: "12px 32px",
    background: "#1a1a1a", color: "#fff",
    textDecoration: "none",
    fontSize: "0.68rem", letterSpacing: "0.2em",
    textTransform: "uppercase", fontFamily: "'Georgia', serif",
    transition: "background 0.2s",
  },

  // Order list
  list: { display: "flex", flexDirection: "column", gap: "20px" },

  // Card
  card: {
    background: "#fff",
    border: "1px solid #e8e2d9",
    padding: "28px 32px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
    paddingBottom: "18px",
    borderBottom: "1px solid #f0ece6",
    gap: "16px",
  },
  cardHeaderLeft: { display: "flex", flexDirection: "column", gap: "5px" },
  orderNum: {
    display: "block",
    fontSize: "0.95rem",
    fontWeight: "400",
    letterSpacing: "0.08em",
    color: "#1a1a1a",
    marginBottom: "4px",
  },
  orderDate: {
    display: "block",
    fontSize: "0.72rem",
    color: "#aaa",
    letterSpacing: "0.08em",
    fontFamily: "sans-serif",
  },

  // Summary row
  summaryRow: {
    display: "flex",
    gap: "24px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  summaryBlock: {
    display: "flex", flexDirection: "column", gap: "5px", flex: 1,
  },
  summaryLabel: {
    fontSize: "0.62rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#b0a090",
    fontFamily: "sans-serif",
  },
  summaryValue: {
    fontSize: "0.88rem",
    color: "#1a1a1a",
    letterSpacing: "0.02em",
    fontWeight: "500",
  },
  notesRow: {
    display: "flex", flexDirection: "column", gap: "5px", marginBottom: "14px",
  },
  notesText: {
    fontSize: "0.8rem", color: "#999",
    fontStyle: "italic", fontFamily: "sans-serif", lineHeight: "1.5",
  },

  // Accordion
  accordionWrapper: { marginTop: "18px" },
  accordionBtn: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    background: "#faf9f7",
    border: "1px solid #e8e2d9",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: "0.72rem",
    letterSpacing: "0.1em",
    color: "#888",
    textTransform: "uppercase",
    textAlign: "left",
  },
  itemCount: {
    fontSize: "0.68rem",
    color: "#bbb",
    letterSpacing: "0.1em",
    fontFamily: "sans-serif",
  },
  itemsList: {
    border: "1px solid #e8e2d9",
    borderTop: "none",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    gap: "16px",
  },
  itemInfo: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 },
  itemName: {
    fontSize: "0.88rem", color: "#1a1a1a", letterSpacing: "0.03em",
  },
  itemMeta: { display: "flex", gap: "8px", flexWrap: "wrap" },
  metaTag: {
    fontSize: "0.68rem", color: "#aaa",
    letterSpacing: "0.1em", textTransform: "uppercase",
    fontFamily: "sans-serif",
    background: "#f5f2ee", padding: "2px 8px",
  },
  
  customDetails: {
    marginTop: "6px",
    padding: "8px 10px",
    background: "#faf8f4",
    border: "1px solid #eee4d8",
    fontSize: "0.72rem",
    color: "#777",
    lineHeight: "1.6",
    fontFamily: "sans-serif",
  },
  
  customBadge: {
    display: "inline-block",
    marginBottom: "5px",
    padding: "2px 7px",
    background: "#111",
    color: "#fff",
    fontSize: "0.58rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: "sans-serif",
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

  itemPricing: {
    display: "flex", flexDirection: "column",
    alignItems: "flex-end", gap: "4px",
  },
  unitPrice: {
    fontSize: "0.72rem", color: "#bbb",
    fontFamily: "sans-serif", letterSpacing: "0.04em",
  },
  lineTotal: {
    fontSize: "0.9rem", color: "#1a1a1a", fontWeight: "500",
  },
  itemsFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    borderTop: "1px solid #f0ece6",
    background: "#faf9f7",
  },

  // Status messages
  statusMessage: {
    marginTop: "16px",
    padding: "11px 16px",
    background: "#edfbf3",
    color: "#1a7a45",
    border: "1px solid #a3dfc0",
    fontSize: "0.78rem",
    letterSpacing: "0.06em",
    fontFamily: "sans-serif",
    lineHeight: "1.5",
  },
};

// Inject spinner keyframe once
if (typeof document !== "undefined") {
  const id = "simplicity-myorders-style";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(el);
  }
}