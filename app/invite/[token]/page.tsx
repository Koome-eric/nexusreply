"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

const IS: React.CSSProperties = {
  width: "100%", background: "#0d1525", border: "1px solid rgba(20,184,166,0.2)",
  borderRadius: "10px", padding: "12px 16px", color: "#e2eaf4", fontSize: "15px",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};
const LS: React.CSSProperties = {
  display: "block", fontSize: "12px", fontWeight: 600, color: "#7c9ab8", marginBottom: "8px",
};

type InviteState = "loading" | "valid" | "invalid" | "used" | "expired" | "success";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [state, setState] = useState<InviteState>("loading");
  const [locationName, setLocationName] = useState("");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invite/accept?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) {
          setState("valid");
          setLocationName(d.locationName);
          if (d.email) { setPrefillEmail(d.email); setForm(f => ({ ...f, email: d.email })); }
        } else if (d.used) { setState("used"); }
        else if (d.expired) { setState("expired"); }
        else { setState("invalid"); setErrorMsg(d.error || "Invalid invite"); }
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (form.password.length < 8) { setErrorMsg("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm) { setErrorMsg("Passwords don't match."); return; }
    setSubmitting(true);

    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: form.name, email: form.email, password: form.password }),
    });
    const data = await res.json();

    if (!res.ok) { setErrorMsg(data.error || "Something went wrong."); setSubmitting(false); return; }

    // Auto sign in
    const result = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    if (result?.ok) {
      setState("success");
      setTimeout(() => router.push("/client"), 1500);
    } else {
      setState("success"); // account created, ask them to login
    }
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080d16", padding: "24px" }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(20,184,166,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>🤖</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#e2eaf4", letterSpacing: "-0.03em" }}>NexusReply</div>
        </div>

        <div style={{ background: "rgba(10,17,30,0.95)", border: "1px solid rgba(20,184,166,0.15)", borderRadius: "18px", padding: "32px", backdropFilter: "blur(12px)" }}>

          {/* LOADING */}
          {state === "loading" && (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <div style={{ fontSize: "28px", marginBottom: "12px", animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</div>
              <div style={{ color: "#445566", fontSize: "14px" }}>Validating invite…</div>
            </div>
          )}

          {/* INVALID */}
          {(state === "invalid" || state === "used" || state === "expired") && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>{state === "used" ? "✅" : "❌"}</div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e2eaf4", margin: "0 0 8px" }}>
                {state === "used" ? "Already Used" : state === "expired" ? "Link Expired" : "Invalid Link"}
              </h2>
              <p style={{ color: "#445566", fontSize: "13px", lineHeight: 1.6 }}>
                {state === "used" ? "This invite link has already been accepted." :
                 state === "expired" ? "This invite link has expired. Ask your agency to send a new one." :
                 errorMsg || "This invite link is not valid."}
              </p>
              <Link href="/login" style={{ display: "inline-block", marginTop: "20px", fontSize: "13px", color: "#14b8a6", textDecoration: "none", fontWeight: 600 }}>
                Go to Login →
              </Link>
            </div>
          )}

          {/* SUCCESS */}
          {state === "success" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#22c55e", margin: "0 0 8px" }}>Welcome to {locationName}!</h2>
              <p style={{ color: "#445566", fontSize: "13px" }}>Your account is ready. Redirecting to your dashboard…</p>
            </div>
          )}

          {/* VALID FORM */}
          {state === "valid" && (
            <>
              {/* Header */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "20px", padding: "6px 14px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "13px" }}>📍</span>
                  <span style={{ fontSize: "12px", color: "#14b8a6", fontWeight: 700 }}>{locationName}</span>
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                  You've been invited
                </h2>
                <p style={{ color: "#445566", fontSize: "13px", margin: 0 }}>
                  Create your account to access the AI dashboard for <strong style={{ color: "#7c9ab8" }}>{locationName}</strong>.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={LS}>Your Name</label>
                  <input style={IS} type="text" placeholder="John Smith" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={LS}>Email Address</label>
                  <input style={{ ...IS, opacity: prefillEmail ? 0.7 : 1 }} type="email"
                    placeholder="you@example.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    readOnly={!!prefillEmail} required />
                  {prefillEmail && <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "4px" }}>This invite is for this email address</div>}
                </div>
                <div>
                  <label style={LS}>Password</label>
                  <input style={IS} type="password" placeholder="Min 8 characters" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                </div>
                <div>
                  <label style={LS}>Confirm Password</label>
                  <input style={IS} type="password" placeholder="Re-enter password" value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
                </div>

                {errorMsg && (
                  <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "13px" }}>
                    {errorMsg}
                  </div>
                )}

                <button type="submit" disabled={submitting} style={{
                  padding: "13px", borderRadius: "10px", border: "none",
                  background: submitting ? "rgba(20,184,166,0.3)" : "linear-gradient(135deg,#0d9488,#14b8a6)",
                  color: "white", fontWeight: 700, fontSize: "15px", cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "inherit", marginTop: "4px",
                }}>
                  {submitting ? "Creating Account…" : "Create Account & Join"}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <span style={{ color: "#2d3d50", fontSize: "13px" }}>Already have an account? </span>
                <Link href="/login" style={{ color: "#14b8a6", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
