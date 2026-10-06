import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { UserDataContext } from "../context/userDataContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { setAccessToken } from "../utils/api.js";

/* ─── Authentic Custom SVG Icons (Zero broken external imports) ──────────── */
const IcoSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IcoMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IcoArrowRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const IcoUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const IcoEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const IcoEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const IcoMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const IcoLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IcoCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IcoShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

/* ─── Cheeni Editorial Design System Tokens ──────────────────────────────── */
const S = {
  page: {
    background: "var(--land-bg)",
    color: "var(--land-ink)",
    fontFamily: "var(--land-sans)",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  serif: { fontFamily: "var(--land-serif)" },
  wrap: { maxWidth: 1120, margin: "0 auto", padding: "0 24px", width: "100%" },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--land-accent)",
    display: "block",
    marginBottom: 8,
  },
  h1: {
    fontFamily: "var(--land-serif)",
    fontWeight: 400,
    lineHeight: 1.12,
    letterSpacing: "-0.03em",
    color: "var(--land-ink)",
    margin: "0 0 12px",
    fontSize: "clamp(28px, 4vw, 40px)",
  },
  body: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--land-ink-2)",
  },
  card: {
    background: "var(--land-bg)",
    border: "1px solid var(--land-rule)",
    borderRadius: 14,
    padding: "36px 32px",
    boxShadow: "0 20px 48px rgba(0, 0, 0, 0.12)",
  },
  input: {
    width: "100%",
    padding: "11px 14px 11px 38px",
    borderRadius: 7,
    background: "var(--land-bg-2)",
    border: "1px solid var(--land-rule)",
    color: "var(--land-ink)",
    fontSize: 14,
    fontFamily: "var(--land-sans)",
    outline: "none",
    transition: "border-color 0.15s ease",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "12px 20px",
    borderRadius: 7,
    border: "none",
    background: "var(--land-accent)",
    color: "#ffffff",
    fontFamily: "var(--land-sans)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    lineHeight: 1,
    transition: "opacity 0.15s ease",
  },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--land-rule)",
    background: "transparent",
    color: "var(--land-ink-2)",
    cursor: "pointer",
  },
};

function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const { serverURL, setUserData } = useContext(UserDataContext);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSuccessMsg("");

    try {
      const result = await axios.post(
        `${serverURL}/api/auth/signup`,
        { name, email, password },
        { withCredentials: true }
      );

      if (result.data?.accessToken) {
        setAccessToken(result.data.accessToken);
      }
      setUserData(result.data.user || result.data);
      setLoading(false);
      setSuccessMsg("Account created! Direct access granted. Loading customizer...");

      setTimeout(() => {
        setSuccessMsg("");
        navigate("/customize");
      }, 700);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || "Something went wrong during sign up. Please try again.");
    }
  };

  return (
    <div style={S.page}>
      {/* ── Top Navigation Bar (Identical to Landing.jsx) ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--land-bg)", borderBottom: "1px solid var(--land-rule)" }}>
        <div style={{ ...S.wrap, height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            <span style={{ ...S.serif, fontSize: 21, fontWeight: 400, color: "var(--land-ink)", letterSpacing: "-0.02em" }}>Cheeni</span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to warm light theme" : "Switch to dark studio theme"}
              aria-label="Toggle theme"
              style={S.iconBtn}
            >
              {isDark ? <IcoSun /> : <IcoMoon />}
            </button>

            <Link
              to="/signin"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--land-ink-2)",
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 7,
                border: "1px solid var(--land-rule)",
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Auth Card Section ── */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          
          {/* Header Title in Cheeni Typography */}
          <div style={{ marginBottom: 28, textAlign: "left" }}>
            <span style={S.label}>Direct Registration</span>
            <h1 style={S.h1}>Create your account</h1>
            <p style={S.body}>
              Get immediate access to your personalized Cheeni voice desktop assistant. No OTP verification required.
            </p>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 7,
              marginBottom: 16,
              background: "rgba(42, 122, 59, 0.12)",
              border: "1px solid rgba(42, 122, 59, 0.35)",
              color: "#2A7A3B",
              fontSize: 13,
              fontWeight: 500,
            }}>
              <IcoCheck />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 7,
              marginBottom: 16,
              background: "rgba(192, 57, 43, 0.1)",
              border: "1px solid rgba(192, 57, 43, 0.3)",
              color: "#C0392B",
              fontSize: 13,
              fontWeight: 500,
            }}>
              <span>{error}</span>
            </div>
          )}

          {/* Form Card */}
          <div style={S.card}>
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              
              {/* Full Name */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--land-ink)", marginBottom: 6 }}>
                  Full name
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--land-ink-3)", display: "flex" }}>
                    <IcoUser />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    style={S.input}
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--land-ink)", marginBottom: 6 }}>
                  Email address
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--land-ink-3)", display: "flex" }}>
                    <IcoMail />
                  </span>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    style={S.input}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--land-ink)", marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--land-ink-3)", display: "flex" }}>
                    <IcoLock />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    style={{ ...S.input, paddingRight: 38 }}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--land-ink-3)",
                      cursor: "pointer",
                      display: "flex",
                      padding: 0,
                    }}
                  >
                    {showPassword ? <IcoEyeOff /> : <IcoEye />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...S.btnPrimary,
                  opacity: loading ? 0.7 : 1,
                  marginTop: 6,
                }}
              >
                {loading ? (
                  <span>Creating account…</span>
                ) : (
                  <>
                    <span>Create account</span>
                    <IcoArrowRight />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Footer Links */}
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--land-rule)", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--land-ink-3)" }}>
                Already have an account?{" "}
                <Link to="/signin" style={{ color: "var(--land-accent)", textDecoration: "none", fontWeight: 600 }}>
                  Sign in instead
                </Link>
              </p>
            </div>
          </div>

          {/* Trust Guarantee Footnote */}
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--land-ink-3)", fontSize: 12 }}>
            <IcoShield />
            <span>Encrypted credentials • Direct access without OTP</span>
          </div>

        </div>
      </main>
    </div>
  );
}

export default SignUp;
