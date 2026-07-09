import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE from "../config/api";

export default function Checkout({ fetchCart }) {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    address: "",
    notes: "",
  });

  const token = localStorage.getItem("token");

  // Redirect if not logged in
  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  // Fetch cart items
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setCartItems(Array.isArray(data) ? data : data.items || []);
        setLoadingCart(false);
      })
      .catch(() => {
        setError("Failed to load cart.");
        setLoadingCart(false);
      });
  }, [token]);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.customer_name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (cartItems.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_name: form.customer_name,
          phone: form.phone,
          address: form.address,
          notes: form.notes,
          items: cartItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            size: item.size,
            price: item.price,
          })),
          total: subtotal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Order submission failed.");
      }

      // Try to clear cart if fetchCart is exposed globally
      if (fetchCart) {
        fetchCart();
      }

      navigate("/order-success");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Styles ─────────────────────────────────────────────────── */
  const styles = {
    page: {
      minHeight: "100vh",
      backgroundColor: "#faf9f7",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#1a1a1a",
      paddingTop: "80px",
      paddingBottom: "80px",
    },
    container: {
      maxWidth: "1100px",
      margin: "0 auto",
      padding: "0 24px",
    },
    heading: {
      fontFamily: "'Georgia', serif",
      fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
      fontWeight: "400",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      textAlign: "center",
      marginBottom: "8px",
      color: "#1a1a1a",
    },
    subheading: {
      textAlign: "center",
      fontSize: "0.8rem",
      letterSpacing: "0.12em",
      color: "#999",
      textTransform: "uppercase",
      marginBottom: "56px",
    },
    divider: {
      width: "40px",
      height: "1px",
      backgroundColor: "#c8b99a",
      margin: "16px auto 48px",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "48px",
      alignItems: "start",
    },
    // ── Left: Form ──
    formCard: {
      background: "#fff",
      border: "1px solid #e8e2d9",
      padding: "40px 36px",
    },
    sectionLabel: {
      fontSize: "0.68rem",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "#b0a090",
      marginBottom: "28px",
      fontFamily: "'Georgia', serif",
    },
    fieldGroup: {
      marginBottom: "22px",
    },
    label: {
      display: "block",
      fontSize: "0.68rem",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "#888",
      marginBottom: "8px",
    },
    input: {
      width: "100%",
      padding: "12px 14px",
      border: "1px solid #ddd8d0",
      background: "#faf9f7",
      fontFamily: "'Georgia', serif",
      fontSize: "0.92rem",
      color: "#1a1a1a",
      outline: "none",
      transition: "border-color 0.2s",
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      padding: "12px 14px",
      border: "1px solid #ddd8d0",
      background: "#faf9f7",
      fontFamily: "'Georgia', serif",
      fontSize: "0.92rem",
      color: "#1a1a1a",
      outline: "none",
      resize: "vertical",
      minHeight: "90px",
      transition: "border-color 0.2s",
      boxSizing: "border-box",
    },
    paymentNote: {
      marginTop: "28px",
      padding: "18px 20px",
      background: "#faf7f2",
      border: "1px solid #e8dece",
      borderLeft: "3px solid #c8b99a",
    },
    paymentNoteTitle: {
      fontSize: "0.65rem",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "#b0a090",
      marginBottom: "8px",
      display: "block",
    },
    paymentNoteText: {
      fontSize: "0.8rem",
      color: "#888",
      lineHeight: "1.6",
      fontFamily: "sans-serif",
    },
    errorBox: {
      background: "#fff5f5",
      border: "1px solid #f0c0c0",
      color: "#c0392b",
      padding: "12px 16px",
      fontSize: "0.82rem",
      marginBottom: "20px",
      letterSpacing: "0.02em",
    },
    submitBtn: {
      width: "100%",
      padding: "16px",
      background: "#1a1a1a",
      color: "#fff",
      border: "none",
      fontFamily: "'Georgia', serif",
      fontSize: "0.75rem",
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      cursor: "pointer",
      marginTop: "28px",
      transition: "background 0.2s",
    },
    submitBtnDisabled: {
      background: "#aaa",
      cursor: "not-allowed",
    },
    // ── Right: Order Summary ──
    summaryCard: {
      background: "#fff",
      border: "1px solid #e8e2d9",
      padding: "40px 36px",
      position: "sticky",
      top: "100px",
    },
    summaryItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingBottom: "16px",
      marginBottom: "16px",
      borderBottom: "1px solid #f0ece6",
    },
    itemName: {
      fontSize: "0.88rem",
      color: "#1a1a1a",
      letterSpacing: "0.04em",
      marginBottom: "4px",
    },
    itemMeta: {
      fontSize: "0.72rem",
      color: "#aaa",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
    itemPrice: {
      fontSize: "0.88rem",
      color: "#1a1a1a",
      whiteSpace: "nowrap",
      marginLeft: "16px",
    },
    totalRow: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: "20px",
      paddingTop: "20px",
      borderTop: "1px solid #1a1a1a",
    },
    totalLabel: {
      fontSize: "0.7rem",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "#888",
    },
    totalAmount: {
      fontSize: "1.1rem",
      fontWeight: "400",
      letterSpacing: "0.06em",
      color: "#1a1a1a",
    },
    emptyCart: {
      color: "#aaa",
      fontSize: "0.85rem",
      textAlign: "center",
      padding: "24px 0",
      fontFamily: "sans-serif",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Checkout</h1>
        <p style={styles.subheading}>Review & Place Your Order</p>
        <div style={styles.divider} />

        <div style={styles.grid}>
          {/* ── Left: Shipping Form ── */}
          <div style={styles.formCard}>
            <span style={styles.sectionLabel}>Shipping Information</span>

            {error && <div style={styles.errorBox}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="customer_name">
                  Full Name *
                </label>
                <input
                  style={styles.input}
                  id="customer_name"
                  name="customer_name"
                  type="text"
                  placeholder="Ada Lovelace"
                  value={form.customer_name}
                  onChange={handleChange}
                  required
                  onFocus={(e) => (e.target.style.borderColor = "#c8b99a")}
                  onBlur={(e) => (e.target.style.borderColor = "#ddd8d0")}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="phone">
                  Phone Number *
                </label>
                <input
                  style={styles.input}
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+90 5XX XXX XX XX"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  onFocus={(e) => (e.target.style.borderColor = "#c8b99a")}
                  onBlur={(e) => (e.target.style.borderColor = "#ddd8d0")}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="address">
                  Delivery Address *
                </label>
                <textarea
                  style={styles.textarea}
                  id="address"
                  name="address"
                  placeholder="Street, neighbourhood, city, postal code"
                  value={form.address}
                  onChange={handleChange}
                  required
                  onFocus={(e) => (e.target.style.borderColor = "#c8b99a")}
                  onBlur={(e) => (e.target.style.borderColor = "#ddd8d0")}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="notes">
                  Order Notes{" "}
                  <span style={{ color: "#ccc" }}>(optional)</span>
                </label>
                <textarea
                  style={styles.textarea}
                  id="notes"
                  name="notes"
                  placeholder="Any special requests or delivery instructions..."
                  value={form.notes}
                  onChange={handleChange}
                  onFocus={(e) => (e.target.style.borderColor = "#c8b99a")}
                  onBlur={(e) => (e.target.style.borderColor = "#ddd8d0")}
                />
              </div>

              {/* Payment notice */}
              <div style={styles.paymentNote}>
                <span style={styles.paymentNoteTitle}>
                  💳 Payment Information
                </span>
                <p style={styles.paymentNoteText}>
                  Online card payment will be integrated through a secure
                  payment provider such as <strong>iyzico</strong> — a trusted
                  Turkish payment gateway supporting credit cards and
                  installments (taksit). For this graduation version, the order
                  is submitted with payment status{" "}
                  <em>pending / demo</em> and no real charge is made.
                </p>
              </div>

              <button
                type="submit"
                style={{
                  ...styles.submitBtn,
                  ...(submitting || cartItems.length === 0
                    ? styles.submitBtnDisabled
                    : {}),
                }}
                disabled={submitting || cartItems.length === 0}
                onMouseEnter={(e) => {
                  if (!submitting && cartItems.length > 0)
                    e.target.style.background = "#333";
                }}
                onMouseLeave={(e) => {
                  if (!submitting && cartItems.length > 0)
                    e.target.style.background = "#1a1a1a";
                }}
              >
                {submitting ? "Placing Order…" : "Place Order"}
              </button>
            </form>
          </div>

          {/* ── Right: Order Summary ── */}
          <div style={styles.summaryCard}>
            <span style={styles.sectionLabel}>Order Summary</span>

            {loadingCart ? (
              <p style={styles.emptyCart}>Loading cart…</p>
            ) : cartItems.length === 0 ? (
              <p style={styles.emptyCart}>Your cart is empty.</p>
            ) : (
              <>
                {cartItems.map((item, idx) => (
                  <div key={idx} style={styles.summaryItem}>
                    <div>
                      <div style={styles.itemName}>
                        {item.name || item.product_name || "Product"}
                      </div>
                      <div style={styles.itemMeta}>
                        {item.size && `Size: ${item.size}`}
                        {item.size && item.quantity ? " · " : ""}
                        {item.quantity && `Qty: ${item.quantity}`}
                      </div>
                    </div>
                    <div style={styles.itemPrice}>
                      ₺
                      {(Number(item.price) * item.quantity).toLocaleString(
                        "tr-TR",
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                  </div>
                ))}

                <div style={styles.totalRow}>
                  <span style={styles.totalLabel}>Total</span>
                  <span style={styles.totalAmount}>
                    ₺
                    {subtotal.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}