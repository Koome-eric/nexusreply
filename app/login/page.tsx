"use client";

import { useState, Suspense } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const IS: React.CSSProperties = {
  width: "100%", background: "#0d1525", border: "1px solid rgba(20,184,166,0.2)",
  borderRadius: "10px", padding: "12px 16px", color: "#e2eaf4", fontSize: "15px",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color 0.2s",
};
const LS: React.CSSProperties = {
  display: "block", fontSize: "12px", fontWeight: 600, color: "#7c9ab8",
  marginBottom: "8px", letterSpacing: "0.04em",
};

// Maps role → correct panel home
const ROLE_HOME: Record<string, string> = {
  admin:  "/admin",
  agency: "/agency",
  client: "/client",
  user:   "/dashboard",
};

function getRoleHome(role: string | undefined): string {
  if (!role) return "/dashboard";
  return ROLE_HOME[role] ?? "/dashboard";
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function Spinner() {
  return (
    <span style={{
      width: "16px", height: "16px",
      border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
      borderRadius: "50%", display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // We ignore callbackUrl for role-based redirect — middleware will enforce
  // but we keep it for edge cases where a specific deep link is provided
  const rawCallback = params.get("callbackUrl");

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError]       = useState("");

  // After credentials sign-in: read role from session, redirect to correct panel
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Fetch the fresh session to read role
    const session = await getSession();
    const role = (session?.user as { role?: string })?.role;
    const destination = getRoleHome(role);

    router.push(destination);
    router.refresh();
  };

  // Google OAuth: NextAuth will run our jwt callback which stamps role.
  // After Google sign-in, the user lands at callbackUrl. We set it to /auth/redirect
  // which is a thin server page that reads the session and bounces to the right panel.
  const handleGoogle = () => {
    setGLoading(true);
    signIn("google", { callbackUrl: "/auth/redirect" });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080d16", padding: "24px" }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(20,184,166,0.12) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "54px", height: "54px", borderRadius: "15px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", boxShadow: "0 0 30px rgba(20,184,166,0.4)" }}>⚡</div>
            <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.03em", color: "#e2eaf4" }}>NexusReply</span>
          </Link>
          <p style={{ color: "#7c9ab8", fontSize: "14px", marginTop: "8px" }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(13,21,37,0.95)", border: "1px solid rgba(20,184,166,0.18)", borderRadius: "20px", padding: "32px", backdropFilter: "blur(16px)" }}>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#f87171" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={gLoading || loading}
            style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e2eaf4", fontSize: "14px", fontWeight: 600, cursor: gLoading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "20px", opacity: gLoading ? 0.7 : 1 }}
            onMouseEnter={e => { if (!gLoading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
          >
            {gLoading ? <Spinner /> : <GoogleIcon />}
            {gLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: "12px", color: "#445566" }}>or sign in with email</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Email / password */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={LS}>EMAIL ADDRESS</label>
              <input
                type="email" placeholder="you@company.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" style={IS}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"}
              />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={LS}>PASSWORD</label>
              <input
                type="password" placeholder="Enter your password"
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" style={IS}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"}
              />
            </div>
            <button
              type="submit" disabled={loading || gLoading}
              style={{ width: "100%", padding: "13px", borderRadius: "11px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontSize: "15px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: loading ? 0.8 : 1, boxShadow: "0 4px 20px rgba(20,184,166,0.3)" }}
            >
              {loading ? <><Spinner /> Signing in…</> : "Sign In →"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "18px", fontSize: "14px", color: "#7c9ab8" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "#14b8a6", fontWeight: 600, textDecoration: "none" }}>Start free trial</Link>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080d16" }} />}>
      <LoginForm />
    </Suspense>
  );
}
