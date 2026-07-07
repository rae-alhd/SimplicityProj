import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const STATUS_OPTIONS = ["pending", "confirmed", "delivered", "cancelled"];

const STATUS_STYLES = {
  pending:   { background: "#fff8ec", color: "#b07d2a", border: "1px solid #f0d9a0" },
  confirmed: { background: "#edf6ff", color: "#1a6fb5", border: "1px solid #b3d4f5" },
  delivered: { background: "#edfbf3", color: "#1a7a45", border: "1px solid #a3dfc0" },
  cancelled: { background: "#fdf2f2", color: "#b52a2a", border: "1px solid #f0b3b3" },
};

function OrderCard({ order, onStatusChange }) {
  const [status, setStatus]     = useState(order.status || "pending");
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const token = localStorage.getItem("token");

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || d.message || "Failed to update status.");
      }
      setStatus(newStatus);
      onStatusChange(order.id, newStatus);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("tr-TR", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

  const totalDisplay = order.total_price
    ? `₺${Number(order.total_price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`
    : "—";

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div style={s.card}>
      {/* ── Card Header ── */}
      <div style={s.cardHeader}>
        <div style={s.cardHeaderLeft}>
          <span style={s.orderId}>#{String(order.id).padStart(5, "0")}</span>
          <span style={s.dateTag}>{formattedDate}</span>
        </div>
        <div style={s.cardHeaderRight}>
          <span style={{ ...s.statusPill, ...STATUS_STYLES[status] }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>

      {/* ── Customer Info Grid ── */}
      <div style={s.infoGrid}>
        <InfoBlock label="Customer" value={order.customer_name || "—"} />
        <InfoBlock label="Email"    value={order.user_email   || "—"} />
        <InfoBlock label="Phone"    value={order.phone        || "—"} />
        <InfoBlock label="Total"    value={totalDisplay} highlight />
      </div>

      <div style={s.addressRow}>
        <span style={s.infoLabel}>Address</span>
        <span style={s.addressValue}>{order.address || "—"}</span>
      </div>

      {order.notes && (
        <div style={s.notesRow}>
          <span style={s.infoLabel}>Notes</span>
          <span style={s.notesValue}>{order.notes}</span>
        </div>
      )}

      {/* ── Items Toggle ── */}
      {items.length > 0 && (
        <div style={s.itemsSection}>
          <button style={s.toggleBtn} onClick={() => setExpanded((p) => !p)}>
            <span style={s.toggleLabel}>
              {expanded ? "▲ Hide" : "▼ Show"} items ({items.length})
            </span>
          </button>

          {expanded && (
            <div style={s.itemsTable}>
              <div style={s.itemsTableHeader}>
                <span>Product</span>
                <span>Size</span>
                <span>Color</span>
                <span style={{ textAlign: "right" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Unit Price</span>
                <span style={{ textAlign: "right" }}>Subtotal</span>
              </div>
              {items.map((item, idx) => (
  <div key={idx} style={{ ...s.itemRow, ...(idx % 2 === 0 ? s.itemRowAlt : {}) }}>
    <div>
      <span style={s.itemName}>{item.product_name || "—"}</span>

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
                </div>
              </div>

              {item.design_image_url && (
                <img
                  src={item.design_image_url}
                  alt={item.design_label}
                  style={s.designThumb}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>

    <span style={s.itemCell}>{item.size || "—"}</span>
    <span style={s.itemCell}>{item.color || "—"}</span>
    <span style={{ ...s.itemCell, textAlign: "right" }}>{item.quantity}</span>
    <span style={{ ...s.itemCell, textAlign: "right" }}>
      ₺{Number(item.unit_price || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
    </span>
    <span style={{ ...s.itemCell, textAlign: "right", fontWeight: "500" }}>
      ₺{(Number(item.unit_price || 0) * item.quantity).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
    </span>
  </div>
))}
            </div>
          )}
        </div>
      )}

      {/* ── Status Control ── */}
      <div style={s.cardFooter}>
        <div style={s.statusControl}>
          <label style={s.selectLabel} htmlFor={`status-${order.id}`}>
            Update Status
          </label>
          <select
            id={`status-${order.id}`}
            value={status}
            onChange={handleStatusChange}
            disabled={saving}
            style={{ ...s.select, ...(saving ? s.selectDisabled : {}) }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
          {saving && <span style={s.savingText}>Saving…</span>}
          {saveError && <span style={s.saveErrorText}>{saveError}</span>}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value, highlight }) {
  return (
    <div style={s.infoBlock}>
      <span style={s.infoLabel}>{label}</span>
      <span style={{ ...s.infoValue, ...(highlight ? s.infoValueHighlight : {}) }}>
        {value}
      </span>
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [filter, setFilter]   = useState("all");
  const navigate              = useNavigate();
  const token                 = localStorage.getItem("token");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetch("http://localhost:5000/api/orders", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch orders.");
        return r.json();
      })
      .then((data) => {
        setOrders(Array.isArray(data) ? data : data.orders || []);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [token, navigate]);

  const handleStatusChange = (id, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
  };

  const filtered = filter === "all"
    ? orders
    : orders.filter((o) => o.status === filter);

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* ── Page Header ── */}
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>Orders</h1>
            <p style={s.pageSubtitle}>
              {orders.length} total order{orders.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* ── Stat Chips ── */}
        <div style={s.statsRow}>
          <StatChip label="All" count={orders.length} active={filter === "all"}
            onClick={() => setFilter("all")} color="#1a1a1a" />
          <StatChip label="Pending"   count={counts.pending}   active={filter === "pending"}
            onClick={() => setFilter("pending")}   color="#b07d2a" />
          <StatChip label="Confirmed" count={counts.confirmed} active={filter === "confirmed"}
            onClick={() => setFilter("confirmed")} color="#1a6fb5" />
          <StatChip label="Delivered" count={counts.delivered} active={filter === "delivered"}
            onClick={() => setFilter("delivered")} color="#1a7a45" />
          <StatChip label="Cancelled" count={counts.cancelled} active={filter === "cancelled"}
            onClick={() => setFilter("cancelled")} color="#b52a2a" />
        </div>

        <div style={s.divider} />

        {/* ── States ── */}
        {loading && (
          <div style={s.centerState}>
            <div style={s.spinner} />
            <p style={s.stateText}>Loading orders…</p>
          </div>
        )}

        {error && (
          <div style={s.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={s.centerState}>
            <p style={s.emptyIcon}>📋</p>
            <p style={s.stateText}>No {filter !== "all" ? filter : ""} orders found.</p>
          </div>
        )}

        {/* ── Order Cards ── */}
        {!loading && !error && (
          <div style={s.ordersList}>
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, count, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...s.statChip,
        ...(active ? { ...s.statChipActive, borderColor: color, color } : {}),
      }}
    >
      <span style={s.statChipLabel}>{label}</span>
      <span style={{
        ...s.statChipCount,
        ...(active ? { background: color, color: "#fff" } : {}),
      }}>
        {count}
      </span>
    </button>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  page: {
    minHeight: "100vh",
    background: "#f5f4f2",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    paddingTop: "80px",
    paddingBottom: "80px",
    color: "#1a1a1a",
  },
  container: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "0 24px",
  },

  // Header
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: "28px",
  },
  pageTitle: {
    fontSize: "1.7rem",
    fontWeight: "400",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    margin: 0,
    color: "#1a1a1a",
  },
  pageSubtitle: {
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    color: "#aaa",
    marginTop: "6px",
    fontFamily: "sans-serif",
  },

  // Stats
  statsRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  statChip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 14px",
    background: "#fff",
    border: "1px solid #e0dbd4",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
    color: "#888",
    transition: "all 0.15s",
  },
  statChipActive: {
    background: "#fff",
  },
  statChipLabel: { textTransform: "uppercase" },
  statChipCount: {
    display: "inline-block",
    minWidth: "20px",
    padding: "1px 6px",
    background: "#eee",
    borderRadius: "20px",
    fontSize: "0.7rem",
    textAlign: "center",
    fontFamily: "sans-serif",
    color: "#555",
    transition: "all 0.15s",
  },

  divider: {
    height: "1px",
    background: "#e0dbd4",
    marginBottom: "28px",
  },

  // States
  centerState: {
    textAlign: "center",
    padding: "60px 0",
  },
  stateText: {
    color: "#aaa",
    fontSize: "0.85rem",
    letterSpacing: "0.06em",
    fontFamily: "sans-serif",
    marginTop: "12px",
  },
  emptyIcon: { fontSize: "2rem", margin: 0 },
  spinner: {
    width: "28px",
    height: "28px",
    border: "2px solid #e0dbd4",
    borderTop: "2px solid #1a1a1a",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto",
  },
  errorBox: {
    background: "#fff5f5",
    border: "1px solid #f0c0c0",
    color: "#c0392b",
    padding: "14px 18px",
    fontSize: "0.82rem",
    marginBottom: "24px",
    fontFamily: "sans-serif",
  },

  // Order list
  ordersList: { display: "flex", flexDirection: "column", gap: "16px" },

  // Card
  card: {
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "28px 32px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingBottom: "16px",
    borderBottom: "1px solid #f0ece6",
  },
  cardHeaderLeft: { display: "flex", alignItems: "center", gap: "14px" },
  cardHeaderRight: {},
  orderId: {
    fontFamily: "monospace",
    fontSize: "0.95rem",
    fontWeight: "600",
    letterSpacing: "0.06em",
    color: "#1a1a1a",
  },
  dateTag: {
    fontSize: "0.72rem",
    letterSpacing: "0.1em",
    color: "#aaa",
    fontFamily: "sans-serif",
    textTransform: "uppercase",
  },
  statusPill: {
    display: "inline-block",
    padding: "4px 12px",
    fontSize: "0.68rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: "sans-serif",
    fontWeight: "500",
  },

  // Info grid
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "16px",
  },
  infoBlock: { display: "flex", flexDirection: "column", gap: "4px" },
  infoLabel: {
    fontSize: "0.62rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#b0a898",
    fontFamily: "sans-serif",
  },
  infoValue: {
    fontSize: "0.85rem",
    color: "#1a1a1a",
    letterSpacing: "0.02em",
  },
  infoValueHighlight: {
    fontSize: "0.95rem",
    fontWeight: "600",
    color: "#1a1a1a",
  },
  addressRow: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "12px",
  },
  addressValue: {
    fontSize: "0.83rem",
    color: "#555",
    lineHeight: "1.5",
    fontFamily: "sans-serif",
  },
  notesRow: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "12px",
  },
  notesValue: {
    fontSize: "0.8rem",
    color: "#888",
    fontStyle: "italic",
    fontFamily: "sans-serif",
    lineHeight: "1.5",
  },

  // Items
  itemsSection: { marginTop: "16px" },
  toggleBtn: {
    background: "none",
    border: "1px solid #e0dbd4",
    padding: "7px 16px",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: "0.72rem",
    letterSpacing: "0.1em",
    color: "#888",
    transition: "border-color 0.15s",
  },
  toggleLabel: { textTransform: "uppercase" },
  itemsTable: { marginTop: "12px", border: "1px solid #f0ece6" },
  itemsTableHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1fr",
    gap: "8px",
    padding: "9px 14px",
    background: "#f8f6f3",
    fontSize: "0.62rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#b0a898",
    fontFamily: "sans-serif",
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1fr",
    gap: "8px",
    padding: "10px 14px",
    borderTop: "1px solid #f5f2ee",
  },
  itemRowAlt: { background: "#fdfcfb" },
  itemName: {
    fontSize: "0.82rem",
    color: "#1a1a1a",
    letterSpacing: "0.02em",
  },
  
  customDetails: {
    marginTop: "7px",
    padding: "8px 10px",
    background: "#faf8f4",
    border: "1px solid #eee4d8",
    fontSize: "0.72rem",
    color: "#666",
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

  itemCell: {
    fontSize: "0.82rem",
    color: "#555",
    fontFamily: "sans-serif",
  },

  // Footer
  cardFooter: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid #f0ece6",
  },
  statusControl: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  selectLabel: {
    fontSize: "0.65rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#b0a898",
    fontFamily: "sans-serif",
  },
  select: {
    padding: "8px 14px",
    border: "1px solid #ddd8d0",
    background: "#faf9f7",
    fontFamily: "'Georgia', serif",
    fontSize: "0.82rem",
    color: "#1a1a1a",
    cursor: "pointer",
    outline: "none",
    letterSpacing: "0.04em",
  },
  selectDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  savingText: {
    fontSize: "0.72rem",
    color: "#aaa",
    fontFamily: "sans-serif",
    letterSpacing: "0.08em",
  },
  saveErrorText: {
    fontSize: "0.72rem",
    color: "#c0392b",
    fontFamily: "sans-serif",
  },
};

// Inject spinner keyframe once
if (typeof document !== "undefined") {
  const styleId = "simplicity-spinner-style";
  if (!document.getElementById(styleId)) {
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(el);
  }
}