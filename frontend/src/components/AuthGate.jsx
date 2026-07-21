import { useState } from "react";
import "../styles/auth.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const videoSrc = "/hero-video.mp4"; // apni actual video filename se match karo agar alag hai

export default function AuthGate({ onAuthSuccess, onBack }) {
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [industryName, setIndustryName] = useState("");
  const [industryCode, setIndustryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetFields() {
    setPassword("");
    setNewPassword("");
    setError("");
    setSuccessMsg("");
  }

  function switchMode(next) {
    setMode(next);
    resetFields();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      if (mode === "forgot") {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, industry_code: industryCode, new_password: newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Something went wrong");

        setSuccessMsg("Password reset! You can sign in now.");
        setTimeout(() => switchMode("login"), 1500);
        return;
      }

      const endpoint = mode === "signup" ? "/auth/signup" : "/auth/login";
      const body =
        mode === "signup"
          ? { email, password, industry_name: industryName, industry_code: industryCode }
          : { email, password };

      const res = await fetch(API_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");

      onAuthSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const titles = { login: "Sign In", signup: "Create Account", forgot: "Reset Password" };
  const subs = {
    login: "Access your industry's knowledge brain",
    signup: "Register your industry to get started",
    forgot: "Verify your industry code to set a new password",
  };
  const buttonLabels = { login: "Sign In", signup: "Sign Up", forgot: "Reset Password" };

  return (
    <div className="auth-wrap">
      {/* Same video background as homepage, so it feels continuous */}
      <div className="auth-video-bg">
        <video autoPlay muted loop playsInline className="auth-video">
          <source src={videoSrc} type="video/mp4" />
        </video>
        <div className="auth-video-overlay" />
      </div>

      {onBack && (
        <button className="auth-back-btn" onClick={onBack}>
          ← Back to home
        </button>
      )}

      <div className="auth-card auth-card-enter">
        <div className="auth-logo">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="nexusAuthGradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF6A1A" />
                <stop offset="100%" stopColor="#34C3D9" />
              </linearGradient>
            </defs>
            <line x1="16" y1="16" x2="6" y2="7" stroke="url(#nexusAuthGradient)" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="16" y1="16" x2="26" y2="7" stroke="url(#nexusAuthGradient)" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="16" y1="16" x2="6" y2="25" stroke="url(#nexusAuthGradient)" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="16" y1="16" x2="26" y2="25" stroke="url(#nexusAuthGradient)" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="16" cy="16" r="5.5" fill="url(#nexusAuthGradient)" />
            <circle cx="6" cy="7" r="2.6" fill="#FF6A1A" />
            <circle cx="26" cy="7" r="2.6" fill="#34C3D9" />
            <circle cx="6" cy="25" r="2.6" fill="#34C3D9" />
            <circle cx="26" cy="25" r="2.6" fill="#FF6A1A" />
          </svg>
          <span>Industrial Nexus</span>
        </div>

        <h2 key={titles[mode]} className="auth-title-animate">{titles[mode]}</h2>
        <p className="sub">{subs[mode]}</p>

        {error && <div className="auth-error auth-shake">{error}</div>}
        {successMsg && <div className="auth-success">{successMsg}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="signup-fields">
              <input
                type="text"
                placeholder="Industry Name (e.g. Reliance Refinery)"
                value={industryName}
                onChange={(e) => setIndustryName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Industry Code (e.g. IND001)"
                value={industryCode}
                onChange={(e) => setIndustryCode(e.target.value)}
                required
              />
            </div>
          )}

          {mode === "forgot" && (
            <input
              type="text"
              placeholder="Industry Code (e.g. IND001)"
              value={industryCode}
              onChange={(e) => setIndustryCode(e.target.value)}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {mode === "forgot" ? (
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          ) : (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : buttonLabels[mode]}
          </button>
        </form>

        {mode === "login" && (
          <div className="auth-forgot-link">
            <a onClick={() => switchMode("forgot")}>Forgot password?</a>
          </div>
        )}

        <div className="auth-toggle">
          {mode === "signup" && (
            <span>Already have an account? <a onClick={() => switchMode("login")}>Sign In</a></span>
          )}
          {mode === "login" && (
            <span>Don't have an account? <a onClick={() => switchMode("signup")}>Sign up</a></span>
          )}
          {mode === "forgot" && (
            <span>Remembered it? <a onClick={() => switchMode("login")}>Back to Sign In</a></span>
          )}
        </div>
      </div>
    </div>
  );
}