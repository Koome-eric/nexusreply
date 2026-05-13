"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Choice = "agency" | "user" | null;

const OPTIONS = [
  {
    role: "agency" as const,
    icon: "🏢",
    title: "I run an agency",
    subtitle: "I manage AI sales for multiple business clients",
    bullets: ["Manage multiple client locations", "White-label your brand", "Invite clients to their portal", "Up to 6 custom AI agents"],
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))",
    border: "rgba(139,92,246,0.4)",
  },
  {
    role: "user" as const,
    icon: "👤",
    title: "Just me",
    subtitle: "I'm managing AI sales for my own business",
    bullets: ["Connect your GHL location", "Full AI sales team", "Pipeline & analytics", "SMS + Email automation"],
    color: "#14b8a6",
    gradient: "linear-gradient(135deg, rgba(20,184,166,0.15), rgba(20,184,166,0.05))",
    border: "rgba(20,184,166,0.4)",
  },
];

function Spinner() {
  return <span style={{ width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [choice, setChoice]   = useState<Choice>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const handleContinue = async () => {
    if (!choice) return;
    setSaving(true);
    setError("");

    const res  = await fetch("/api/onboarding", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ role: choice }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      setSaving(false);
      return;
    }

    // Force session refresh so JWT reflects new role, then navigate
    await fetch("/api/auth/session");
    router.push(data.redirect);
    router.refresh();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080d16", padding: "24px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(20,184,166,0.1) 0%, transparent 55%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "640px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", margin: "0 auto 16px", boxShadow: "0 0 32px rgba(20,184,166,0.4)" }}>⚡</div>
          <h1 style={{ fontSize: "28px", fontWeight: 900, color: "#e2eaf4", margin: "0 0 10px", letterSpacing: "-0.03em" }}>
            How will you use NexusReply?
          </h1>
          <p style={{ fontSize: "15px", color: "#7c9ab8", margin: 0 }}>
            This sets up your workspace. You can always switch later.
          </p>
        </div>

        {/* Choice cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
          {OPTIONS.map(opt => {
            const selected = choice === opt.role;
            return (
              <button
                key={opt.role}
                onClick={() => setChoice(opt.role)}
                style={{
                  padding: "24px 20px", borderRadius: "18px", cursor: "pointer",
                  border: `2px solid ${selected ? opt.border : "rgba(255,255,255,0.07)"}`,
                  background: selected ? opt.gradient : "rgba(13,21,37,0.8)",
                  fontFamily: "inherit", textAlign: "left",
                  transition: "all 0.2s", position: "relative",
                  boxShadow: selected ? `0 0 32px ${opt.color}22` : "none",
                }}
                onMouseEnter={e => {
                  if (!selected) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                }}
                onMouseLeave={e => {
                  if (!selected) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                {selected && (
                  <div style={{ position: "absolute", top: "14px", right: "14px", width: "20px", height: "20px", borderRadius: "50%", background: opt.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "white", fontWeight: 800 }}>✓</div>
                )}

                <div style={{ fontSize: "32px", marginBottom: "12px" }}>{opt.icon}</div>
                <div style={{ fontSize: "17px", fontWeight: 800, color: selected ? opt.color : "#e2eaf4", marginBottom: "6px", letterSpacing: "-0.02em" }}>
                  {opt.title}
                </div>
                <div style={{ fontSize: "13px", color: "#7c9ab8", marginBottom: "16px", lineHeight: "1.4" }}>
                  {opt.subtitle}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                  {opt.bullets.map(b => (
                    <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: "7px", fontSize: "12px", color: "#445566" }}>
                      <span style={{ color: opt.color, flexShrink: 0, marginTop: "1px" }}>✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#f87171", textAlign: "center" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!choice || saving}
          style={{
            width: "100%", padding: "15px", borderRadius: "13px", border: "none",
            background: choice
              ? `linear-gradient(135deg, ${OPTIONS.find(o => o.role === choice)!.color}cc, ${OPTIONS.find(o => o.role === choice)!.color})`
              : "rgba(255,255,255,0.06)",
            color: choice ? "white" : "#2d3d50",
            fontSize: "16px", fontWeight: 800, cursor: !choice || saving ? "not-allowed" : "pointer",
            fontFamily: "inherit", transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            boxShadow: choice ? `0 4px 24px ${OPTIONS.find(o => o.role === choice)!.color}44` : "none",
            opacity: saving ? 0.85 : 1,
          }}
        >
          {saving ? (
            <><Spinner /> Setting up your workspace…</>
          ) : (
            choice
              ? `Continue as ${choice === "agency" ? "Agency" : "Individual"} →`
              : "Select an option above"
          )}
        </button>

        <p style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "#2d3d50" }}>
          Admin accounts are assigned manually. If you need admin access, contact support.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
    </div>
  );
}
