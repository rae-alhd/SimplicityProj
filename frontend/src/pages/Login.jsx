import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API_BASE from "../config/api";

const gold = "#C9A84C";
const offWhite = "#F7F5F0";
const black = "#0D0D0D";
const lightGray = "#E8E5DF";
const midGray = "#888";
const errorRed = "#c0392b";

const keyframes = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .s-input-wrap input:focus {
    outline: none;
    border-bottom-color: ${gold} !important;
  }
  .s-input-wrap input::placeholder {
    color: #bbb;
    font-style: italic;
  }
  .s-btn-submit:not(:disabled):hover {
    background: #222 !important;
    letter-spacing: 0.28em !important;
  }
  .s-btn-submit:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .s-link:hover { color: ${gold} !important; }
`;

export default function Login({ setUser }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) return setError("Please enter your email address.");
    if (!password) return setError("Please enter your password.");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);

      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const meData = await meRes.json();

      if (!meRes.ok) {
        setError("Authentication succeeded but we couldn't load your profile. Please try again.");
        setLoading(false);
        return;
      }

      setUser(meData.user);
      navigate(meData.user?.role === "admin" ? "/dashboard" : "/products");
    } catch {
      setError("Unable to connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{keyframes}</style>

      {/* Full-page split layout */}
      <div style={{
        minHeight: "100vh",
        display: "flex",
        backgroundColor: offWhite,
        fontFamily: "'Georgia', 'Times New Roman', serif",
      }}>

        {/* ── LEFT PANEL (decorative) ── */}
        <div style={{
          flex: "0 0 42%",
          backgroundColor: black,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "3.5rem",
        }}
          className="s-left-panel"
        >
          {/* diagonal stripe texture */}
          <div style={{
            position: "absolute", inset: 0,
            background: `
              repeating-linear-gradient(
                -55deg,
                #ffffff04 0px, #ffffff04 1px,
                transparent 1px, transparent 28px
              )
            `,
            pointerEvents: "none",
          }} />

          {/* gold glow */}
          <div style={{
            position: "absolute",
            bottom: "-10%", left: "-10%",
            width: "380px", height: "380px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${gold}1A 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          {/* brand mark */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "12px",
            }}>
              <div style={{
                width: "28px", height: "1px", backgroundColor: gold,
              }} />
              <span style={{
                fontSize: "0.65rem", letterSpacing: "0.35em",
                textTransform: "uppercase", color: gold,
                fontStyle: "italic",
              }}>Simplicity</span>
            </div>
          </div>

          {/* large watermark word */}
          <div style={{
            position: "absolute",
            bottom: "15%", left: "-1rem",
            fontSize: "clamp(4rem, 8vw, 7rem)",
            fontFamily: "'Georgia', serif",
            fontStyle: "italic",
            color: "transparent",
            WebkitTextStroke: `1px ${gold}30`,
            lineHeight: 1,
            letterSpacing: "0.05em",
            userSelect: "none",
            pointerEvents: "none",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
          }}>
            Welcome
          </div>

          {/* bottom tagline */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{
              fontSize: "clamp(1.2rem, 2vw, 1.7rem)",
              fontWeight: 400,
              color: offWhite,
              lineHeight: 1.3,
              marginBottom: "0.8rem",
            }}>
              Wear less.<br />
              <em style={{ color: gold }}>Mean more.</em>
            </p>
            <p style={{
              fontSize: "0.82rem",
              color: "#666",
              fontStyle: "italic",
              lineHeight: 1.7,
            }}>
              Sign in to your Simplicity account<br />
              and continue your journey.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ── */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 2rem",
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
                Member Access
              </span>
              <h1 style={{
                fontSize: "clamp(1.9rem, 3vw, 2.6rem)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: black,
                lineHeight: 1.1,
                margin: 0,
              }}>
                Sign In
              </h1>
            </div>

            {/* error */}
            {error && (
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
                {error}
              </div>
            )}

            {/* form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

              {/* email */}
              <div className="s-input-wrap" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{
                  fontSize: "0.62rem", letterSpacing: "0.25em",
                  textTransform: "uppercase", color: midGray,
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: `1px solid ${lightGray}`,
                    padding: "0.7rem 0",
                    fontSize: "0.95rem",
                    color: black,
                    fontFamily: "'Georgia', serif",
                    transition: "border-color 0.25s",
                  }}
                />
              </div>

              {/* password */}
              <div className="s-input-wrap" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{
                  fontSize: "0.62rem", letterSpacing: "0.25em",
                  textTransform: "uppercase", color: midGray,
                }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: `1px solid ${lightGray}`,
                    padding: "0.7rem 0",
                    fontSize: "0.95rem",
                    color: black,
                    fontFamily: "'Georgia', serif",
                    transition: "border-color 0.25s",
                  }}
                />
              </div>

              {/* submit */}
              <button
                type="submit"
                disabled={loading}
                className="s-btn-submit"
                style={{
                  marginTop: "0.5rem",
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
                {loading ? "Signing In…" : "Sign In"}
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

            {/* register link */}
            <p style={{
              textAlign: "center",
              fontSize: "0.82rem",
              color: midGray,
              fontStyle: "italic",
              lineHeight: 1.8,
            }}>
              New to Simplicity?{" "}
              <Link
                to="/register"
                className="s-link"
                style={{
                  color: black,
                  textDecoration: "none",
                  borderBottom: `1px solid ${gold}`,
                  paddingBottom: "1px",
                  transition: "color 0.2s",
                }}
              >
                Create an account
              </Link>
            </p>

          </div>
        </div>
      </div>

      {/* Responsive: hide left panel on small screens */}
      <style>{`
        @media (max-width: 700px) {
          .s-left-panel { display: none !important; }
        }
      `}</style>
    </>
  );
}