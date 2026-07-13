import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import API_BASE from "../config/api";
import {
  ALL_STATUSES,
  getStatusActions,
  getStatusBadgeStyle,
  statusLabel,
} from "../utils/orderStatus";
import {
  ALL_PAYMENT_METHODS,
  ALL_PAYMENT_STATUSES,
  getPaymentStatusActions,
  getPaymentStatusBadgeStyle,
  paymentMethodLabel,
  paymentStatusLabel,
} from "../utils/paymentStatus";

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

function StatusBadge({ status }) {
  const cfg = getStatusBadgeStyle(status);
  return (
    <span
      style={{
        ...s.statusPill,
        background: cfg.background,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span style={{ ...s.statusDot, background: cfg.dot }} />
      {statusLabel(status)}
    </span>
  );
}

function PaymentStatusBadge({ status }) {
  const cfg = getPaymentStatusBadgeStyle(status);
  return (
    <span
      style={{
        ...s.statusPill,
        background: cfg.background,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span style={{ ...s.statusDot, background: cfg.dot }} />
      {paymentStatusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Private Owner Notes — Task M1. Fetched lazily the first time a card is
   expanded. Newest first; add/edit/delete; never visible to customers
   (admin-only endpoints, admin-only UI).
───────────────────────────────────────────── */
function NotesSection({ orderId, token }) {
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/admin-notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load notes.");
      setNotes(Array.isArray(data.notes) ? data.notes : []);
      setLoaded(true);
    } catch (err) {
      setLoadError(err.message);
      setLoaded(true);
    }
  }, [orderId, token]);

  useEffect(() => {
    if (!loaded) loadNotes();
  }, [loaded, loadNotes]);

  const handleAdd = async () => {
    const noteText = draft.trim();
    if (!noteText) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/admin-notes`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ note_text: noteText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note.");
      setNotes((prev) => [data.note, ...prev]);
      setDraft("");
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditDraft(note.note_text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async (noteId) => {
    const noteText = editDraft.trim();
    if (!noteText) return;
    setSavingId(noteId);
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/admin-notes/${noteId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ note_text: noteText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update note.");
      setNotes((prev) => prev.map((n) => (n.id === noteId ? data.note : n)));
      setEditingId(null);
      setEditDraft("");
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    setDeletingId(noteId);
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/admin-notes/${noteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete note.");
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={s.notesSection}>
      <div style={s.notesSectionHeader}>
        <span style={s.infoLabel}>Private Owner Notes</span>
        <span style={s.notesPrivacyNote}>Customers cannot see these notes.</span>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add an internal note about this order..."
        maxLength={2000}
        style={s.adminNotesTextarea}
      />
      <div style={s.notesAddRow}>
        <button
          onClick={handleAdd}
          disabled={adding || !draft.trim()}
          style={{
            ...s.saveNoteBtn,
            ...(adding || !draft.trim() ? s.saveNoteBtnDisabled : {}),
          }}
        >
          {adding ? "Adding..." : "Add Note"}
        </button>
        {addError && <span style={s.saveErrorText}>{addError}</span>}
      </div>

      {loadError && <p style={s.saveErrorText}>{loadError}</p>}

      {loaded && notes.length === 0 && !loadError && (
        <p style={s.timelineEmpty}>No private notes yet.</p>
      )}

      <div style={s.notesList}>
        {notes.map((note) => (
          <div key={note.id} style={s.noteCard}>
            {editingId === note.id ? (
              <>
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  maxLength={2000}
                  style={s.adminNotesTextarea}
                />
                <div style={s.noteEditActions}>
                  <button
                    onClick={() => handleSaveEdit(note.id)}
                    disabled={savingId === note.id || !editDraft.trim()}
                    style={s.saveNoteBtn}
                  >
                    {savingId === note.id ? "Saving..." : "Save"}
                  </button>
                  <button onClick={cancelEdit} style={s.noteCancelBtn}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={s.noteText}>{note.note_text}</p>
                <div style={s.noteMeta}>
                  <span>
                    {note.admin_email || "Legacy note"} · {formatTimelineDate(note.updated_at)}
                    {note.updated_at !== note.created_at ? " (edited)" : ""}
                  </span>
                  <span style={s.noteActions}>
                    <button onClick={() => startEdit(note)} style={s.noteLinkBtn}>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={deletingId === note.id}
                      style={{ ...s.noteLinkBtn, color: "#b52a2a" }}
                    >
                      {deletingId === note.id ? "Deleting..." : "Delete"}
                    </button>
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Payment Management — Task N1. Displays the current payment record and
   valid next actions (Mark Paid / Mark Failed / Retry-Pending / Mark
   Refunded), each with its own small form, plus the Private Payment
   History timeline. Never shows every status in an open dropdown — only
   the actions the backend would actually accept from the current state.
───────────────────────────────────────────── */
function PaymentSection({ order, token, onPaymentUpdated }) {
  const [selectedAction, setSelectedAction] = useState(null);
  const [method, setMethod] = useState(order.payment_method || "CASH_ON_DELIVERY");
  const [reference, setReference] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const actions = getPaymentStatusActions(order.payment_status);
  const history = Array.isArray(order.payment_history) ? order.payment_history : [];

  const resetForm = () => {
    setSelectedAction(null);
    setReference("");
    setFailureReason("");
    setRefundReason("");
    setChangeNote("");
  };

  const openAction = (action) => {
    setError("");
    setSuccessMessage("");
    setMethod(order.payment_method || "CASH_ON_DELIVERY");
    setReference(order.transaction_reference || "");
    setSelectedAction(action.to);
  };

  const submit = async () => {
    if (selectedAction === "REFUNDED") {
      const confirmed = window.confirm(
        "Mark this payment as Refunded?\n\n" +
          "This records the refund only. It does not change inventory, " +
          "and it does not change the order's production status."
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError("");
    try {
      const body = { status: selectedAction };
      if (changeNote.trim()) body.change_note = changeNote.trim();
      if (selectedAction === "PAID") {
        body.payment_method = method;
        body.transaction_reference = reference;
      }
      if (selectedAction === "FAILED") {
        body.failure_reason = failureReason;
      }
      if (selectedAction === "REFUNDED") {
        body.refund_reason = refundReason;
      }

      const res = await fetch(`${API_BASE}/orders/${order.id}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update payment.");

      setSuccessMessage(`Payment marked ${paymentStatusLabel(selectedAction)}.`);
      resetForm();
      await onPaymentUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.paymentMgmtSection}>
      <span style={s.infoLabel}>Payment Management</span>

      <div style={s.infoGrid} className="ao-info-grid">
        <InfoBlock label="Status" value={paymentStatusLabel(order.payment_status)} highlight />
        <InfoBlock label="Method" value={paymentMethodLabel(order.payment_method)} />
        <InfoBlock label="Transaction Reference" value={order.transaction_reference || "—"} />
        <InfoBlock label="Paid" value={formatTimelineDate(order.paid_at)} />
        <InfoBlock label="Failed" value={formatTimelineDate(order.failed_at)} />
        <InfoBlock label="Refunded" value={formatTimelineDate(order.refunded_at)} />
      </div>

      {order.failure_reason && (
        <div style={s.notesRow}>
          <span style={s.infoLabel}>Failure Reason</span>
          <span style={s.notesValue}>{order.failure_reason}</span>
        </div>
      )}
      {order.refund_reason && (
        <div style={s.notesRow}>
          <span style={s.infoLabel}>Refund Reason</span>
          <span style={s.notesValue}>{order.refund_reason}</span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={s.actionButtonsRow}>
        {actions.length === 0 && (
          <span style={s.finalStatusNote}>Refunded — final status, no actions.</span>
        )}
        {actions.map((action) => (
          <button
            key={action.to}
            onClick={() => openAction(action)}
            disabled={saving}
            style={{
              ...s.actionBtn,
              ...(action.kind === "primary" ? s.actionBtnPrimary : {}),
              ...(action.kind === "danger" ? s.actionBtnDanger : {}),
              ...(selectedAction === action.to ? s.actionBtnSelected : {}),
              ...(saving ? s.actionBtnDisabled : {}),
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* ── Action form ── */}
      {selectedAction && (
        <div style={s.paymentFormBox}>
          {selectedAction === "PAID" && (
            <>
              <label style={s.formFieldLabel}>
                Payment Method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  style={s.formSelect}
                >
                  {ALL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{paymentMethodLabel(m)}</option>
                  ))}
                </select>
              </label>
              <label style={s.formFieldLabel}>
                Transaction Reference{method === "BANK_TRANSFER" ? " (required)" : " (optional)"}
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={200}
                  style={s.formInput}
                  placeholder="e.g. TRX-12345"
                />
              </label>
            </>
          )}

          {selectedAction === "FAILED" && (
            <label style={s.formFieldLabel}>
              Failure Reason (required)
              <input
                type="text"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                style={s.formInput}
                placeholder="e.g. Bank transfer never arrived"
              />
            </label>
          )}

          {selectedAction === "REFUNDED" && (
            <label style={s.formFieldLabel}>
              Refund Reason (required)
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                style={s.formInput}
                placeholder="e.g. Customer cancellation"
              />
            </label>
          )}

          <label style={s.formFieldLabel}>
            Private Change Note (optional)
            <textarea
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              maxLength={2000}
              style={s.adminNotesTextarea}
              placeholder="Internal note about this payment change..."
            />
          </label>

          <div style={s.notesAddRow}>
            <button
              onClick={submit}
              disabled={
                saving ||
                (selectedAction === "FAILED" && !failureReason.trim()) ||
                (selectedAction === "REFUNDED" && !refundReason.trim())
              }
              style={{
                ...s.saveNoteBtn,
                ...(saving ? s.saveNoteBtnDisabled : {}),
              }}
            >
              {saving ? "Saving..." : `Confirm ${paymentStatusLabel(selectedAction)}`}
            </button>
            <button onClick={resetForm} disabled={saving} style={s.noteCancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p style={s.saveErrorText}>{error}</p>}
      {successMessage && !error && <p style={s.successText}>{successMessage}</p>}

      {/* ── Private Payment History ── */}
      <div style={s.timelineSection}>
        <span style={s.infoLabel}>Private Payment History</span>
        <span style={s.notesPrivacyNote}>
          Customers can see payment statuses but cannot see private payment notes.
        </span>
        <div style={s.timelineList}>
          {history.length === 0 ? (
            <p style={s.timelineEmpty}>No payment changes yet.</p>
          ) : (
            [...history].reverse().map((entry) => (
              <div key={entry.id} style={s.timelineRow}>
                <span style={s.timelineDot} />
                <div style={s.timelineContent}>
                  <span style={s.timelineText}>
                    {paymentStatusLabel(entry.old_status)} → {paymentStatusLabel(entry.new_status)}
                  </span>
                  <span style={s.timelineDate}>
                    {formatTimelineDate(entry.created_at)}
                    {entry.changed_by_email ? ` · ${entry.changed_by_email}` : ""}
                  </span>
                  {entry.change_note && (
                    <span style={s.paymentHistoryNote}>{entry.change_note}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onOrderUpdated, productImageMap, token }) {
  const [expanded, setExpanded] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleStatusAction = async (nextStatus, actionLabel) => {
    if (nextStatus === "cancelled") {
      const confirmed = window.confirm(
        "Cancel this order? Any General or Variant stock deducted at checkout will be restored automatically. This cannot be undone."
      );
      if (!confirmed) return;
    }

    setSavingStatus(true);
    setSaveError("");
    setSuccessMessage("");
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to update status.");
      }
      setSuccessMessage(`${actionLabel} — done.`);
      await onOrderUpdated();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSavingStatus(false);
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
  const statusHistory = Array.isArray(order.status_history) ? order.status_history : [];
  const itemCount = order.item_count ?? items.reduce((n, i) => n + Number(i.quantity || 0), 0);
  const isCustomized = order.contains_customized_items ?? items.some((i) => i.is_customized);
  const actions = getStatusActions(order.status);

  return (
    <div style={s.card}>
      {/* ── Card Header ── */}
      <div style={s.cardHeader} className="ao-card-header">
        <div style={s.cardHeaderLeft}>
          <span style={s.orderId}>#{String(order.id).padStart(5, "0")}</span>
          <span style={s.dateTag}>{formattedDate}</span>
          {order.is_gift && <span style={s.giftBadge}>🎁 Gift order</span>}
          {isCustomized && <span style={s.customizedBadge}>✎ Customized</span>}
        </div>
        <div style={s.cardHeaderRight}>
          <StatusBadge status={order.status} />
          {order.status === "cancelled" && (
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

      {/* ── Payment Summary Row (always visible) ── */}
      <div style={s.paymentSummaryRow}>
        <PaymentStatusBadge status={order.payment_status} />
        <span style={s.paymentMethodTag}>{paymentMethodLabel(order.payment_method)}</span>
        {order.refund_required && (
          <span style={s.refundRequiredBadge}>⚠ Refund Required</span>
        )}
      </div>

      {/* ── Summary Row (always visible) ── */}
      <div style={s.infoGrid} className="ao-info-grid">
        <InfoBlock label="Customer" value={order.customer_name || "—"} />
        <InfoBlock label="Email" value={order.user_email || "—"} />
        <InfoBlock label="Total" value={totalDisplay} highlight />
        <InfoBlock label="Items" value={`${itemCount} piece${itemCount !== 1 ? "s" : ""}`} />
      </div>

      <button style={s.toggleBtn} onClick={() => setExpanded((p) => !p)}>
        <span style={s.toggleLabel}>
          {expanded ? "▲ Hide" : "▼ Show"} order details
        </span>
      </button>

      {expanded && (
        <div style={s.detailsWrap}>
          <div style={s.infoGrid} className="ao-info-grid">
            <InfoBlock label="Phone" value={order.phone || "—"} />
            <InfoBlock label="Gift order" value={order.is_gift ? "Yes" : "No"} />
          </div>

          <div style={s.addressRow}>
            <span style={s.infoLabel}>Shipping Address</span>
            <span style={s.addressValue}>{order.address || "—"}</span>
          </div>

          {order.notes && (
            <div style={s.notesRow}>
              <span style={s.infoLabel}>Customer Note</span>
              <span style={s.notesValue}>{order.notes}</span>
            </div>
          )}

          {/* ── Items ── */}
          {items.length > 0 && (
            <div style={s.itemsSection}>
              <span style={s.infoLabel}>Ordered Items</span>
              <div style={s.itemsTable}>
                <div style={s.itemsTableHeader} className="ao-items-row">
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
                    <div
                      key={idx}
                      className="ao-items-row"
                      style={{ ...s.itemRow, ...(idx % 2 === 0 ? s.itemRowAlt : {}) }}
                    >
                      <div style={s.itemProductCell}>
                        <div style={s.itemThumbWrap}>
                          {productImage ? (
                            <img src={productImage} alt={item.product_name || "Product"} style={s.itemThumb} />
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

                      {/* Task L1: item.size is always null for a STANDARD order
                          line — its permanent standard_size_label_snapshot is
                          shown instead. */}
                      <span style={s.itemCell}>
                        {item.size || item.standard_size_label_snapshot || "—"}
                      </span>
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
            </div>
          )}

          {/* ── Status Timeline ── */}
          <div style={s.timelineSection}>
            <span style={s.infoLabel}>Status Timeline</span>
            <div style={s.timelineList}>
              <div style={s.timelineRow}>
                <span style={s.timelineDot} />
                <div style={s.timelineContent}>
                  <span style={s.timelineText}>Order placed — New</span>
                  <span style={s.timelineDate}>{formatTimelineDate(order.created_at)}</span>
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
                        {statusLabel(entry.old_status)} → {statusLabel(entry.new_status)}
                      </span>
                      <span style={s.timelineDate}>
                        {formatTimelineDate(entry.created_at)}
                        {entry.changed_by_email ? ` · ${entry.changed_by_email}` : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Payment Management ── */}
          {expanded && (
            <PaymentSection order={order} token={token} onPaymentUpdated={onOrderUpdated} />
          )}

          {/* ── Private Owner Notes ── */}
          {expanded && <NotesSection orderId={order.id} token={token} />}
        </div>
      )}

      {/* ── Status Control (always visible, so the owner can act without expanding) ── */}
      <div style={s.cardFooter}>
        <div style={s.statusControl}>
          <span style={s.selectLabel}>Update Status</span>
          <div style={s.actionButtonsRow}>
            {actions.length === 0 && (
              <span style={s.finalStatusNote}>
                {order.status === "delivered" ? "Delivered — final status, no actions." : "Cancelled — final status, no actions."}
              </span>
            )}
            {actions.map((action) => (
              <button
                key={action.to}
                onClick={() => handleStatusAction(action.to, action.label)}
                disabled={savingStatus}
                style={{
                  ...s.actionBtn,
                  ...(action.kind === "primary" ? s.actionBtnPrimary : {}),
                  ...(action.kind === "danger" ? s.actionBtnDanger : {}),
                  ...(savingStatus ? s.actionBtnDisabled : {}),
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
          {savingStatus && <span style={s.savingText}>Saving…</span>}
          {saveError && <span style={s.saveErrorText}>{saveError}</span>}
          {successMessage && !saveError && (
            <span style={s.successText}>{successMessage}</span>
          )}
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

const EMPTY_FILTERS = {
  status: "all",
  search: "",
  gift: "all",
  customized: "all",
  dateFrom: "",
  dateTo: "",
  paymentStatus: "all",
  paymentMethod: "all",
  refundRequired: "all",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [productImageMap, setProductImageMap] = useState({});
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch orders.");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.orders || []);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchOrders();
  }, [token, navigate, fetchOrders]);

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

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters(EMPTY_FILTERS);

  const filtered = useMemo(() => {
    let list = orders;

    if (filters.status !== "all") {
      list = list.filter((o) => o.status === filters.status);
    }
    if (filters.gift !== "all") {
      list = list.filter((o) => Boolean(o.is_gift) === (filters.gift === "true"));
    }
    if (filters.customized !== "all") {
      list = list.filter((o) => {
        const flag = o.contains_customized_items ??
          (Array.isArray(o.items) && o.items.some((i) => i.is_customized));
        return Boolean(flag) === (filters.customized === "true");
      });
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      list = list.filter((o) => new Date(o.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((o) => new Date(o.created_at) <= to);
    }
    if (filters.paymentStatus !== "all") {
      list = list.filter((o) => o.payment_status === filters.paymentStatus);
    }
    if (filters.paymentMethod !== "all") {
      list = list.filter((o) => o.payment_method === filters.paymentMethod);
    }
    if (filters.refundRequired !== "all") {
      list = list.filter((o) => Boolean(o.refund_required) === (filters.refundRequired === "true"));
    }

    const normalizedSearch = filters.search.trim().toLowerCase();
    if (normalizedSearch) {
      list = list.filter((o) => orderMatchesSearch(o, normalizedSearch));
    }

    return list;
  }, [orders, filters]);

  const counts = useMemo(
    () =>
      ALL_STATUSES.reduce((acc, statusKey) => {
        acc[statusKey] = orders.filter((o) => o.status === statusKey).length;
        return acc;
      }, {}),
    [orders]
  );

  const paymentCounts = useMemo(
    () =>
      ALL_PAYMENT_STATUSES.reduce((acc, statusKey) => {
        acc[statusKey] = orders.filter((o) => o.payment_status === statusKey).length;
        return acc;
      }, {}),
    [orders]
  );

  const filtersActive =
    filters.status !== "all" ||
    filters.search.trim() !== "" ||
    filters.gift !== "all" ||
    filters.customized !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.paymentStatus !== "all" ||
    filters.paymentMethod !== "all" ||
    filters.refundRequired !== "all";

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

          {/* ── Filters ── */}
          <div style={s.filtersBar} className="ao-filters-bar">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Search by order, customer, email, phone, product..."
              style={s.searchInput}
            />

            <div style={s.statsRow}>
              <StatChip label="All" count={orders.length} active={filters.status === "all"}
                onClick={() => setFilter("status", "all")} color="#1a1a1a" />
              {ALL_STATUSES.map((statusKey) => (
                <StatChip
                  key={statusKey}
                  label={statusLabel(statusKey)}
                  count={counts[statusKey]}
                  active={filters.status === statusKey}
                  onClick={() => setFilter("status", statusKey)}
                  color={getStatusBadgeStyle(statusKey).color}
                />
              ))}
            </div>

            <div style={s.statsRow}>
              <StatChip label="All Payments" count={orders.length} active={filters.paymentStatus === "all"}
                onClick={() => setFilter("paymentStatus", "all")} color="#1a1a1a" />
              {ALL_PAYMENT_STATUSES.map((statusKey) => (
                <StatChip
                  key={statusKey}
                  label={paymentStatusLabel(statusKey)}
                  count={paymentCounts[statusKey]}
                  active={filters.paymentStatus === statusKey}
                  onClick={() => setFilter("paymentStatus", statusKey)}
                  color={getPaymentStatusBadgeStyle(statusKey).color}
                />
              ))}
            </div>

            <div style={s.toggleFiltersRow} className="ao-toggle-filters-row">
              <ToggleFilter
                label="Gift Orders"
                value={filters.gift}
                onChange={(v) => setFilter("gift", v)}
              />
              <ToggleFilter
                label="Customized Orders"
                value={filters.customized}
                onChange={(v) => setFilter("customized", v)}
              />
              <ToggleFilter
                label="Refund Required"
                value={filters.refundRequired}
                onChange={(v) => setFilter("refundRequired", v)}
              />

              <label style={s.dateLabel}>
                Payment Method
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilter("paymentMethod", e.target.value)}
                  style={s.dateInput}
                >
                  <option value="all">All</option>
                  {ALL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{paymentMethodLabel(m)}</option>
                  ))}
                </select>
              </label>

              <div style={s.dateFilterGroup}>
                <label style={s.dateLabel}>
                  From
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilter("dateFrom", e.target.value)}
                    style={s.dateInput}
                  />
                </label>
                <label style={s.dateLabel}>
                  To
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilter("dateTo", e.target.value)}
                    style={s.dateInput}
                  />
                </label>
              </div>

              {filtersActive && (
                <button onClick={resetFilters} style={s.resetBtn}>
                  Reset filters
                </button>
              )}
            </div>
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
                {filtersActive ? "No orders match your filters." : "No orders found."}
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
                  onOrderUpdated={fetchOrders}
                  productImageMap={productImageMap}
                  token={token}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ToggleFilter({ label, value, onChange }) {
  return (
    <div style={s.toggleGroup}>
      <button
        onClick={() => onChange("all")}
        style={{ ...s.toggleGroupBtn, ...(value === "all" ? s.toggleGroupBtnActive : {}) }}
      >
        All
      </button>
      <button
        onClick={() => onChange("true")}
        style={{ ...s.toggleGroupBtn, ...(value === "true" ? s.toggleGroupBtnActive : {}) }}
      >
        {label}
      </button>
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

  // Filters
  filtersBar: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginBottom: "8px",
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

  // Stats
  statsRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
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

  toggleFiltersRow: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  toggleGroup: {
    display: "flex",
    border: "1px solid #e0dbd4",
    overflow: "hidden",
  },
  toggleGroupBtn: {
    padding: "7px 14px",
    background: "#fff",
    border: "none",
    borderRight: "1px solid #e0dbd4",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    color: "#888",
  },
  toggleGroupBtnActive: {
    background: "#1a1a1a",
    color: "#fff",
  },
  dateFilterGroup: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  dateLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    fontSize: "0.62rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#b0a898",
    fontFamily: "sans-serif",
  },
  dateInput: {
    padding: "6px 8px",
    border: "1px solid #e0dbd4",
    background: "#fff",
    fontFamily: "sans-serif",
    fontSize: "0.78rem",
    color: "#1a1a1a",
  },
  resetBtn: {
    padding: "7px 14px",
    background: "none",
    border: "1px solid #ddd8d0",
    color: "#888",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: "0.72rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  divider: {
    height: "1px",
    background: "#e0dbd4",
    marginTop: "20px",
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
  customizedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "3px 10px",
    background: "#f4f1fb",
    color: "#6a4fc2",
    border: "1px solid #dcd2f2",
    fontSize: "0.66rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontFamily: "sans-serif",
    fontWeight: "600",
  },

  // Payment summary (Task N1)
  paymentSummaryRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  paymentMethodTag: {
    fontSize: "0.72rem",
    color: "#888",
    fontFamily: "sans-serif",
    letterSpacing: "0.04em",
  },
  refundRequiredBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "3px 10px",
    background: "#fff4e6",
    color: "#a35b00",
    border: "1px solid #f0c98a",
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
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 12px",
    fontSize: "0.68rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: "sans-serif",
    fontWeight: "500",
  },
  statusDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
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

  detailsWrap: {
    marginTop: "6px",
    paddingTop: "16px",
    borderTop: "1px solid #f0ece6",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  // Notes (private owner notes)
  notesSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "10px",
    paddingTop: "16px",
    borderTop: "1px solid #f0ece6",
  },
  notesSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
  },
  notesPrivacyNote: {
    fontSize: "0.68rem",
    color: "#b07d2a",
    fontFamily: "sans-serif",
    fontStyle: "italic",
  },
  adminNotesTextarea: {
    width: "100%",
    minHeight: "64px",
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
  notesAddRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
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
  notesList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "4px",
  },
  noteCard: {
    padding: "12px 14px",
    background: "#faf9f7",
    border: "1px solid #eee4d8",
  },
  noteText: {
    fontSize: "0.82rem",
    color: "#1a1a1a",
    lineHeight: "1.6",
    fontFamily: "sans-serif",
    margin: "0 0 8px",
    whiteSpace: "pre-wrap",
  },
  noteMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    fontSize: "0.68rem",
    color: "#aaa",
    fontFamily: "sans-serif",
  },
  noteActions: { display: "flex", gap: "12px" },
  noteLinkBtn: {
    background: "none",
    border: "none",
    padding: 0,
    color: "#1a6fb5",
    cursor: "pointer",
    fontSize: "0.68rem",
    letterSpacing: "0.04em",
    fontFamily: "sans-serif",
    textDecoration: "underline",
  },
  noteEditActions: {
    display: "flex",
    gap: "10px",
    marginTop: "8px",
  },
  noteCancelBtn: {
    padding: "8px 16px",
    border: "1px solid #ddd8d0",
    background: "#fff",
    color: "#888",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: "0.72rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  // Payment Management (Task N1)
  paymentMgmtSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "10px",
    paddingTop: "16px",
    borderTop: "1px solid #f0ece6",
  },
  actionBtnSelected: {
    boxShadow: "0 0 0 2px rgba(26,26,26,0.25)",
  },
  paymentFormBox: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "14px 16px",
    background: "#faf9f7",
    border: "1px solid #eee4d8",
    marginTop: "6px",
  },
  formFieldLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    fontSize: "0.65rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#b0a898",
    fontFamily: "sans-serif",
  },
  formSelect: {
    padding: "9px 10px",
    border: "1px solid #ddd8d0",
    background: "#fff",
    fontFamily: "'Georgia', serif",
    fontSize: "0.82rem",
    color: "#1a1a1a",
  },
  formInput: {
    padding: "9px 10px",
    border: "1px solid #ddd8d0",
    background: "#fff",
    fontFamily: "'Georgia', serif",
    fontSize: "0.82rem",
    color: "#1a1a1a",
    boxSizing: "border-box",
  },
  paymentHistoryNote: {
    fontSize: "0.72rem",
    color: "#888",
    fontFamily: "sans-serif",
    fontStyle: "italic",
    marginTop: "2px",
  },

  timelineSection: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "10px",
    paddingTop: "16px",
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
  itemsSection: { marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" },
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
  itemsTable: { marginTop: "4px", border: "1px solid #f0ece6" },
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

  // Footer / status control
  cardFooter: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid #f0ece6",
  },
  statusControl: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
  },
  selectLabel: {
    fontSize: "0.65rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#b0a898",
    fontFamily: "sans-serif",
  },
  actionButtonsRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: "9px 16px",
    border: "1px solid #ddd8d0",
    background: "#fff",
    color: "#1a1a1a",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: "0.74rem",
    letterSpacing: "0.04em",
  },
  actionBtnPrimary: {
    background: "#1a1a1a",
    color: "#fff",
    borderColor: "#1a1a1a",
  },
  actionBtnDanger: {
    background: "#fff",
    color: "#b52a2a",
    borderColor: "#f0b3b3",
  },
  actionBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  finalStatusNote: {
    fontSize: "0.78rem",
    color: "#aaa",
    fontFamily: "sans-serif",
    fontStyle: "italic",
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
  successText: {
    fontSize: "0.72rem",
    color: "#1a7a45",
    fontFamily: "sans-serif",
  },
};

// Inject spinner keyframe + small responsive rules once. Plain inline style
// objects can't express @media queries, so this mirrors the same
// injected-<style> pattern already used elsewhere in this file for the
// spinner animation.
if (typeof document !== "undefined") {
  const styleId = "simplicity-adminorders-style";
  if (!document.getElementById(styleId)) {
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (max-width: 720px) {
        .ao-info-grid { grid-template-columns: repeat(2, 1fr) !important; }
        .ao-items-row { grid-template-columns: 1fr !important; gap: 4px !important; }
        .ao-items-row > span:not(:first-child) { text-align: left !important; }
        .ao-card-header { flex-direction: column; align-items: flex-start !important; gap: 10px; }
        .ao-toggle-filters-row { flex-direction: column; align-items: flex-start !important; }
      }
      @media (max-width: 480px) {
        .ao-info-grid { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(el);
  }
}
