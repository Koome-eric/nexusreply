"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const IS: React.CSSProperties = {
  width: "100%", background: "#0d1525",
  border: "1px solid rgba(20,184,166,0.2)", borderRadius: "10px",
  padding: "12px 16px", color: "#e2eaf4", fontSize: "15px",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  transition: "border-color 0.2s",
};
const LS: React.CSSProperties = {
  display: "block", fontSize: "12px", fontWeight: 600,
  color: "#7c9ab8", marginBottom: "8px", letterSpacing: "0.04em",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function Spinner() {
  return <span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError]       = useState("");

  const up = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const strength = form.password.length >= 12 ? { w: "100%", c: "#22c55e", t: "Strong ✓" }
    : form.password.length >= 8  ? { w: "65%",  c: "#14b8a6", t: "Good" }
    : form.password.length  > 0  ? { w: "30%",  c: "#f59e0b", t: "Too short" }
    : null;

  // Google → always onboarding after OAuth (role not known yet)
  const handleGoogle = () => {
    setGLoading(true);
    signIn("google", { callbackUrl: "/onboarding" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8)        { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm)  { setError("Passwords don't match."); return; }
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), email: form.email.toLowerCase().trim(), password: form.password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Registration failed."); setLoading(false); return; }

    // Sign in immediately then go to onboarding
    const result = await signIn("credentials", {
      email: form.email.toLowerCase().trim(),
      password: form.password,
      redirect: false,
    });
    if (result?.error) { router.push("/login"); return; }
    router.push("/onboarding");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080d16", padding: "24px" }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(20,184,166,0.12) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", boxShadow: "0 0 28px rgba(20,184,166,0.4)" }}>⚡</div>
            <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.03em", color: "#e2eaf4" }}>NexusReply</span>
          </Link>
          <p style={{ color: "#7c9ab8", fontSize: "14px", marginTop: "8px" }}>Create your free account — no credit card needed</p>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(13,21,37,0.95)", border: "1px solid rgba(20,184,166,0.18)", borderRadius: "20px", padding: "28px 32px", backdropFilter: "blur(16px)" }}>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#f87171" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Google */}
          <button type="button" onClick={handleGoogle} disabled={gLoading || loading}
            style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e2eaf4", fontSize: "14px", fontWeight: 600, cursor: gLoading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "18px", opacity: gLoading ? 0.7 : 1, transition: "background 0.2s" }}
            onMouseEnter={e => { if (!gLoading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}>
            {gLoading ? <Spinner /> : <GoogleIcon />}
            {gLoading ? "Redirecting…" : "Sign up with Google"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: "12px", color: "#445566" }}>or sign up with email</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "14px" }}>
              <label style={LS}>FULL NAME</label>
              <input type="text" placeholder="Alex Johnson" value={form.name} onChange={e => up("name", e.target.value)} autoComplete="name" style={IS}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"} />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={LS}>EMAIL ADDRESS</label>
              <input type="email" placeholder="you@company.com" value={form.email} onChange={e => up("email", e.target.value)} required autoComplete="email" style={IS}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"} />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={LS}>PASSWORD</label>
              <input type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => up("password", e.target.value)} required autoComplete="new-password" style={IS}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"} />
              {strength && (
                <div style={{ marginTop: "6px" }}>
                  <div style={{ height: "3px", borderRadius: "2px", background: "#111c2e", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: strength.w, background: strength.c, transition: "all 0.3s", borderRadius: "2px" }} />
                  </div>
                  <div style={{ fontSize: "11px", color: "#445566", marginTop: "3px" }}>{strength.t}</div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: "22px" }}>
              <label style={LS}>CONFIRM PASSWORD</label>
              <input type="password" placeholder="Repeat your password" value={form.confirm} onChange={e => up("confirm", e.target.value)} required autoComplete="new-password" style={IS}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"} />
            </div>
            <button type="submit" disabled={loading || gLoading}
              style={{ width: "100%", padding: "13px", borderRadius: "11px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontSize: "15px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: loading ? 0.8 : 1, boxShadow: "0 4px 20px rgba(20,184,166,0.3)" }}>
              {loading ? <><Spinner /> Creating account…</> : "⚡ Start Free Trial"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "16px", fontSize: "14px", color: "#7c9ab8" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#14b8a6", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
        </p>
        <p style={{ textAlign: "center", marginTop: "6px", fontSize: "11px", color: "#2d3d50" }}>
          No credit card required · Cancel anytime
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
    </div>
  );
}
