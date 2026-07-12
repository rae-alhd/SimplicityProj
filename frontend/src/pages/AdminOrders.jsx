import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import API_BASE from "../config/api";

const STATUS_OPTIONS = ["pending", "confirmed", "delivered", "cancelled"];

const STATUS_STYLES = {
  pending:   { background: "#fff8ec", color: "#b07d2a", border: "1px solid #f0d9a0" },
  confirmed: { background: "#edf6ff", color: "#1a6fb5", border: "1px solid #b3d4f5" },
  delivered: { background: "#edfbf3", color: "#1a7a45", border: "1px solid #a3dfc0" },
  cancelled: { background: "#fdf2f2", color: "#b52a2a", border: "1px solid #f0b3b3" },
};

// Matches order id (plain or "#123" style), customer name/email/phone, and
// any item's product name — all case-insensitive substring matches.
function orderMatchesSearch(order, normalizedTerm) {
  const cleanTerm = normalizedTerm.replace(/^#/, "");

  const idCandidates = [String(order.id), String(order.id).padStart(5, "0")];
  if (idCandidates.some((candidate) => candidate.includes(cleanTerm))) {
    return true;
  }

  const textFields = [order.customer_name, order.user_email, order.phone];
  if (textFields.some((field) => field && field.toLowerCase().includes(normalizedTerm))) {
    return true;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  return items.some(
    (item) => item.product_name && item.product_name.toLowerCase().includes(normalizedTerm)
  );
}

function capitalizeStatus(status) {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTimelineDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderCard({
  order,
  onStatusChange,
  productImageMap,
  noteDraft,
  onNoteDraftChange,
  onSaveNote,
  savingNote,
}) {
  const [status, setStatus]     = useState(order.status || "pending");
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const token = localStorage.getItem("token");

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;

    if (newStatus === "cancelled") {
      const confirmed = window.confirm(
        "Cancel this order? Product stock will be restored if it has not been restored already."
      );
      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/status`, {
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
  const statusHistory = Array.isArray(order.status_history)
    ? order.status_history
    : [];

  return (
    <div style={s.card}>
      {/* ── Card Header ── */}
      <div style={s.cardHeader}>
        <div style={s.cardHeaderLeft}>
          <span style={s.orderId}>#{String(order.id).padStart(5, "0")}</span>
          <span style={s.dateTag}>{formattedDate}</span>
          {order.is_gift && <span style={s.giftBadge}>🎁 Gift order</span>}
        </div>
        <div style={s.cardHeaderRight}>
          <span style={{ ...s.statusPill, ...STATUS_STYLES[status] }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          {status === "cancelled" && (
            <span
              style={{
                ...s.stockBadge,
                ...(order.stock_restored ? s.stockBadgeRestored : s.stockBadgePending),
              }}
            >
              {order.stock_restored ? "Stock restored" : "Stock not restored yet"}
            </span>
          )}
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

      {/* ── Admin Notes (Internal) ── */}
      <div style={s.adminNotesSection}>
        <label style={s.infoLabel} htmlFor={`admin-notes-${order.id}`}>
          Admin Notes (Internal)
        </label>
        <textarea
          id={`admin-notes-${order.id}`}
          value={noteDraft}
          onChange={(e) => onNoteDraftChange(order.id, e.target.value)}
          placeholder="Internal notes for this order (not visible to the customer)..."
          style={s.adminNotesTextarea}
        />
        <button
          onClick={() => onSaveNote(order.id)}
          disabled={savingNote}
          style={{
            ...s.saveNoteBtn,
            ...(savingNote ? s.saveNoteBtnDisabled : {}),
          }}
        >
          {savingNote ? "Saving..." : "Save Note"}
        </button>
      </div>

      {/* ── Status Timeline ── */}
      <div style={s.timelineSection}>
        <span style={s.infoLabel}>Status Timeline</span>
        <div style={s.timelineList}>
          <div style={s.timelineRow}>
            <span style={s.timelineDot} />
            <div style={s.timelineContent}>
              <span style={s.timelineText}>Order placed — Pending</span>
              <span style={s.timelineDate}>
                {formatTimelineDate(order.created_at)}
              </span>
            </div>
          </div>

          {statusHistory.length === 0 ? (
            <p style={s.timelineEmpty}>No status changes yet.</p>
          ) : (
            statusHistory.map((entry) => (
              <div key={entry.id} style={s.timelineRow}>
                <span style={s.timelineDot} />
                <div style={s.timelineContent}>
                  <span style={s.timelineText}>
                    {capitalizeStatus(entry.old_status)} →{" "}
                    {capitalizeStatus(entry.new_status)}
                  </span>
                  <span style={s.timelineDate}>
                    {formatTimelineDate(entry.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
              {items.map((item, idx) => {
                const productImage = productImageMap?.[item.product_id];

                return (
  <div key={idx} style={{ ...s.itemRow, ...(idx % 2 === 0 ? s.itemRowAlt : {}) }}>
    <div style={s.itemProductCell}>
      <div style={s.itemThumbWrap}>
        {productImage ? (
          <img
            src={productImage}
            alt={item.product_name || "Product"}
            style={s.itemThumb}
          />
        ) : (
          <span style={s.itemThumbPlaceholder}>No Image</span>
        )}
      </div>

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
                );
              })}
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
  const [searchTerm, setSearchTerm] = useState("");
  const [productImageMap, setProductImageMap] = useState({});
  const [adminNoteDrafts, setAdminNoteDrafts] = useState({});
  const [savingNoteId, setSavingNoteId] = useState(null);
  const navigate              = useNavigate();
  const token                 = localStorage.getItem("token");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetch(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch orders.");
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data.orders || [];
        setOrders(list);
        setAdminNoteDrafts(
          list.reduce((acc, o) => {
            acc[o.id] = o.admin_notes || "";
            return acc;
          }, {})
        );
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [token, navigate]);

  // Demo/frontend-only lookup: resolves each order item's *current* product
  // image by product_id. order_items has no image snapshot, so this can show
  // a different image than what the customer actually saw at checkout time.
  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const map = {};
        list.forEach((p) => {
          map[p.id] = p.main_image_url || p.image_url || null;
        });
        setProductImageMap(map);
      })
      .catch((err) => console.error("Fetch products error:", err));
  }, []);

  const handleStatusChange = (id, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
  };

  const handleNoteDraftChange = (orderId, value) => {
    setAdminNoteDrafts((prev) => ({ ...prev, [orderId]: value }));
  };

  const handleSaveNote = async (orderId) => {
    try {
      setSavingNoteId(orderId);

      const res = await fetch(
        `${API_BASE}/orders/${orderId}/admin-notes`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ admin_notes: adminNoteDrafts[orderId] ?? "" }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not save admin notes.");
        return;
      }

      const savedNotes = data.order?.admin_notes ?? "";

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, admin_notes: savedNotes } : o
        )
      );
      setAdminNoteDrafts((prev) => ({ ...prev, [orderId]: savedNotes }));
    } catch (err) {
      console.error("Save admin notes error:", err);
      alert("Something went wrong while saving admin notes.");
    } finally {
      setSavingNoteId(null);
    }
  };

  const statusFiltered = filter === "all"
    ? orders
    : orders.filter((o) => o.status === filter);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filtered = normalizedSearch
    ? statusFiltered.filter((o) => orderMatchesSearch(o, normalizedSearch))
    : statusFiltered;

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  return (
    <>
      <AdminNav />
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

        {/* ── Search ── */}
        <div style={s.searchRow}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by order, customer, email, phone, product..."
            style={s.searchInput}
          />
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
            <p style={s.stateText}>
              {normalizedSearch
                ? "No orders match your search."
                : `No ${filter !== "all" ? filter : ""} orders found.`}
            </p>
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
                productImageMap={productImageMap}
                noteDraft={adminNoteDrafts[order.id] ?? ""}
                onNoteDraftChange={handleNoteDraftChange}
                onSaveNote={handleSaveNote}
                savingNote={savingNoteId === order.id}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </>
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

  // Search
  searchRow: {
    marginBottom: "20px",
  },
  searchInput: {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #e0dbd4",
    background: "#fff",
    fontFamily: "'Georgia', serif",
    fontSize: "0.85rem",
    color: "#1a1a1a",
    outline: "none",
    boxSizing: "border-box",
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
  cardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
  },
  cardHeaderRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "6px",
  },
  stockBadge: {
    display: "inline-block",
    fontSize: "0.62rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontFamily: "sans-serif",
  },
  stockBadgeRestored: {
    color: "#1a7a45",
  },
  stockBadgePending: {
    color: "#b07d2a",
  },
  giftBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "3px 10px",
    background: "#faf7f2",
    color: "#9b7d3f",
    border: "1px solid #e8d9a8",
    fontSize: "0.66rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontFamily: "sans-serif",
    fontWeight: "600",
  },
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
  adminNotesSection: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "16px",
    paddingTop: "12px",
    borderTop: "1px solid #f0ece6",
  },
  adminNotesTextarea: {
    width: "100%",
    minHeight: "60px",
    padding: "10px 12px",
    border: "1px solid #ddd8d0",
    background: "#faf9f7",
    fontFamily: "'Georgia', serif",
    fontSize: "0.82rem",
    color: "#1a1a1a",
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
  },
  saveNoteBtn: {
    alignSelf: "flex-start",
    padding: "8px 16px",
    border: "1px solid #111",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: "0.72rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  saveNoteBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  timelineSection: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "16px",
    paddingTop: "12px",
    borderTop: "1px solid #f0ece6",
  },
  timelineList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "4px",
  },
  timelineRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  timelineDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#b0a898",
    marginTop: "5px",
    flexShrink: 0,
  },
  timelineContent: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  timelineText: {
    fontSize: "0.8rem",
    color: "#1a1a1a",
    fontFamily: "sans-serif",
  },
  timelineDate: {
    fontSize: "0.68rem",
    color: "#aaa",
    fontFamily: "sans-serif",
    letterSpacing: "0.04em",
  },
  timelineEmpty: {
    fontSize: "0.75rem",
    color: "#aaa",
    fontFamily: "sans-serif",
    fontStyle: "italic",
    margin: 0,
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
  itemProductCell: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  itemThumbWrap: {
    width: "40px",
    height: "40px",
    minWidth: "40px",
    borderRadius: "6px",
    overflow: "hidden",
    background: "#f2f0eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #eee4d8",
  },
  itemThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  itemThumbPlaceholder: {
    fontSize: "0.48rem",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#b0a898",
    textAlign: "center",
    fontFamily: "sans-serif",
  },
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