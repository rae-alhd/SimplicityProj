import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const gold = "#C9A84C";
const offWhite = "#F7F5F0";
const black = "#0D0D0D";
const lightGray = "#E8E5DF";
const midGray = "#888";
const errorRed = "#c0392b";
const successGreen = "#2e7d4f";

const keyframes = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes checkPop {
    0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
    70%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg);   opacity: 1; }
  }
  .sr-input-wrap input:focus {
    outline: none;
    border-bottom-color: ${gold} !important;
  }
  .sr-input-wrap input::placeholder {
    color: #bbb;
    font-style: italic;
  }
  .sr-btn-submit:not(:disabled):hover {
    background: #222 !important;
    letter-spacing: 0.28em !important;
  }
  .sr-btn-submit:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .sr-link:hover { color: ${gold} !important; }
`;

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <span style={{
      fontSize: "0.72rem",
      color: errorRed,
      fontStyle: "italic",
      marginTop: "0.3rem",
      animation: "fadeUp 0.2s ease both",
    }}>
      {msg}
    </span>
  );
}

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    // Clear individual field error on change
    if (fieldErrors[field]) setFieldErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!form.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = "Please enter a valid email address.";
    }
    if (!form.password) {
      errs.password = "Password is required.";
    } else if (form.password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }
    if (!form.confirm) {
      errs.confirm = "Please confirm your password.";
    } else if (form.password !== form.confirm) {
      errs.confirm = "Passwords do not match.";
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error || data.message || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate("/login"), 2200);
    } catch {
      setGlobalError("Unable to connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{keyframes}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        backgroundColor: offWhite,
        fontFamily: "'Georgia', 'Times New Roman', serif",
      }}>

        {/* ── LEFT PANEL (form) ── */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 2rem",
          order: 1,
        }}>
          <div style={{
            width: "100%",
            maxWidth: "420px",
            animation: "fadeUp 0.6s ease both",
          }}>

            {/* heading */}
            <div style={{ marginBottom: "3rem" }}>
              <span style={{
                fontSize: "0.62rem", letterSpacing: "0.35em",
                textTransform: "uppercase", color: gold,
                fontStyle: "italic", display: "block",
                marginBottom: "0.8rem",
              }}>
                New Member
              </span>
              <h1 style={{
                fontSize: "clamp(1.9rem, 3vw, 2.6rem)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: black,
                lineHeight: 1.1,
                margin: 0,
              }}>
                Create Account
              </h1>
            </div>

            {/* ── SUCCESS STATE ── */}
            {success ? (
              <div style={{
                textAlign: "center",
                padding: "2rem 0",
                animation: "fadeUp 0.4s ease both",
              }}>
                <div style={{
                  width: "60px", height: "60px",
                  borderRadius: "50%",
                  border: `1.5px solid ${gold}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 1.5rem",
                  animation: "checkPop 0.5s ease both",
                }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <polyline
                      points="4,11 9,16 18,6"
                      stroke={gold}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p style={{
                  fontSize: "1.1rem",
                  fontWeight: 400,
                  color: black,
                  marginBottom: "0.6rem",
                }}>
                  Account created.
                </p>
                <p style={{
                  fontSize: "0.82rem",
                  color: midGray,
                  fontStyle: "italic",
                }}>
                  Redirecting you to sign in…
                </p>
              </div>
            ) : (
              <>
                {/* global error */}
                {globalError && (
                  <div style={{
                    backgroundColor: "#fdf2f2",
                    border: `1px solid ${errorRed}33`,
                    borderLeft: `3px solid ${errorRed}`,
                    padding: "0.9rem 1.1rem",
                    marginBottom: "1.8rem",
                    fontSize: "0.82rem",
                    color: errorRed,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                    animation: "fadeUp 0.3s ease both",
                  }}>
                    {globalError}
                  </div>
                )}

                {/* form */}
                <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.8rem" }}>

                  {/* email */}
                  <div className="sr-input-wrap" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{
                      fontSize: "0.62rem", letterSpacing: "0.25em",
                      textTransform: "uppercase", color: midGray,
                    }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="you@example.com"
                      autoComplete="email"
                      style={{
                        background: "transparent",
                        border: "none",
                        borderBottom: `1px solid ${fieldErrors.email ? errorRed + "88" : lightGray}`,
                        padding: "0.7rem 0",
                        fontSize: "0.95rem",
                        color: black,
                        fontFamily: "'Georgia', serif",
                        transition: "border-color 0.25s",
                      }}
                    />
                    <FieldError msg={fieldErrors.email} />
                  </div>

                  {/* password */}
                  <div className="sr-input-wrap" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{
                      fontSize: "0.62rem", letterSpacing: "0.25em",
                      textTransform: "uppercase", color: midGray,
                    }}>
                      Password
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={set("password")}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      style={{
                        background: "transparent",
                        border: "none",
                        borderBottom: `1px solid ${fieldErrors.password ? errorRed + "88" : lightGray}`,
                        padding: "0.7rem 0",
                        fontSize: "0.95rem",
                        color: black,
                        fontFamily: "'Georgia', serif",
                        transition: "border-color 0.25s",
                      }}
                    />
                    <FieldError msg={fieldErrors.password} />
                  </div>

                  {/* confirm password */}
                  <div className="sr-input-wrap" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{
                      fontSize: "0.62rem", letterSpacing: "0.25em",
                      textTransform: "uppercase", color: midGray,
                    }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={form.confirm}
                      onChange={set("confirm")}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      style={{
                        background: "transparent",
                        border: "none",
                        borderBottom: `1px solid ${fieldErrors.confirm ? errorRed + "88" : lightGray}`,
                        padding: "0.7rem 0",
                        fontSize: "0.95rem",
                        color: black,
                        fontFamily: "'Georgia', serif",
                        transition: "border-color 0.25s",
                      }}
                    />
                    <FieldError msg={fieldErrors.confirm} />
                  </div>

                  {/* password hint */}
                  <p style={{
                    fontSize: "0.72rem",
                    color: "#aaa",
                    fontStyle: "italic",
                    marginTop: "-0.8rem",
                    lineHeight: 1.6,
                  }}>
                    Your account will be created as a customer. Admin access is managed separately.
                  </p>

                  {/* submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="sr-btn-submit"
                    style={{
                      backgroundColor: black,
                      color: offWhite,
                      border: "none",
                      padding: "16px 0",
                      fontSize: "0.68rem",
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      fontFamily: "'Georgia', serif",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      transition: "background 0.25s, letter-spacing 0.25s",
                    }}
                  >
                    {loading && (
                      <div style={{
                        width: "14px", height: "14px",
                        border: "1.5px solid #ffffff44",
                        borderTopColor: offWhite,
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                        flexShrink: 0,
                      }} />
                    )}
                    {loading ? "Creating Account…" : "Create Account"}
                  </button>
                </form>

                {/* divider */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "16px",
                  margin: "2.5rem 0",
                }}>
                  <div style={{ flex: 1, height: "1px", backgroundColor: lightGray }} />
                  <div style={{
                    width: "5px", height: "5px",
                    backgroundColor: gold, transform: "rotate(45deg)",
                  }} />
                  <div style={{ flex: 1, height: "1px", backgroundColor: lightGray }} />
                </div>

                {/* login link */}
                <p style={{
                  textAlign: "center",
                  fontSize: "0.82rem",
                  color: midGray,
                  fontStyle: "italic",
                  lineHeight: 1.8,
                }}>
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="sr-link"
                    style={{
                      color: black,
                      textDecoration: "none",
                      borderBottom: `1px solid ${gold}`,
                      paddingBottom: "1px",
                      transition: "color 0.2s",
                    }}
                  >
                    Sign in
                  </Link>
                </p>
              </>
            )}

          </div>
        </div>

        {/* ── RIGHT PANEL (decorative) ── */}
        <div
          className="sr-right-panel"
          style={{
            flex: "0 0 42%",
            backgroundColor: black,
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "3.5rem",
            order: 2,
          }}
        >
          {/* horizontal stripe texture */}
          <div style={{
            position: "absolute", inset: 0,
            background: `
              repeating-linear-gradient(
                0deg,
                #ffffff03 0px, #ffffff03 1px,
                transparent 1px, transparent 32px
              )
            `,
            pointerEvents: "none",
          }} />

          {/* gold glow top-right */}
          <div style={{
            position: "absolute",
            top: "-15%", right: "-15%",
            width: "400px", height: "400px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${gold}14 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          {/* brand mark */}
          <div style={{ position: "relative", zIndex: 1, textAlign: "right" }}>
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "flex-end", gap: "12px",
            }}>
              <span style={{
                fontSize: "0.65rem", letterSpacing: "0.35em",
                textTransform: "uppercase", color: gold,
                fontStyle: "italic",
              }}>Simplicity</span>
              <div style={{ width: "28px", height: "1px", backgroundColor: gold }} />
            </div>
          </div>

          {/* decorative large number */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "clamp(8rem, 18vw, 16rem)",
            fontFamily: "'Georgia', serif",
            fontStyle: "italic",
            color: "transparent",
            WebkitTextStroke: `1px ${gold}18`,
            userSelect: "none",
            pointerEvents: "none",
            lineHeight: 1,
          }}>
            S
          </div>

          {/* bottom tagline */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{
              fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)",
              fontWeight: 400,
              color: offWhite,
              lineHeight: 1.35,
              marginBottom: "0.8rem",
            }}>
              Join the circle<br />
              <em style={{ color: gold }}>of simplicity.</em>
            </p>
            <p style={{
              fontSize: "0.8rem",
              color: "#555",
              fontStyle: "italic",
              lineHeight: 1.7,
            }}>
              Create your account and unlock<br />
              the full Simplicity experience.
            </p>
          </div>
        </div>
      </div>

      {/* Responsive: hide right panel on small screens */}
      <style>{`
        @media (max-width: 700px) {
          .sr-right-panel { display: none !important; }
        }
      `}</style>
    </>
  );
}