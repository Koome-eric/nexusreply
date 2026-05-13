"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserData {
  plan:               string;
  status:             string;
  trialMessagesUsed:  number;
  trialMessagesLimit: number;
  trialExhausted:     boolean;
}

export default function TrialPaywall() {
  const [user, setUser] = useState<UserData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/user").then(r => r.json()).then(d => {
      if (d.user) setUser(d.user);
    });
  }, []);

  // Only show for trialing accounts that hit the cap
  if (!user) return null;
  if (user.status !== "trialing") return null;
  if (!user.trialExhausted && user.trialMessagesUsed < user.trialMessagesLimit) return null;
  if (dismissed) return null;

  const pct = Math.min(100, Math.round((user.trialMessagesUsed / user.trialMessagesLimit) * 100));

  return (
    <>
      {/* Full-screen backdrop for truly exhausted state */}
      {user.trialExhausted && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(4px)", zIndex: 998,
        }} />
      )}

      <div style={{
        position: "fixed",
        ...(user.trialExhausted
          ? { top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 999 }
          : { bottom: 24, right: 24, zIndex: 200 }),
        background: "rgba(13,21,37,0.98)",
        border: "1px solid rgba(245,158,11,0.4)",
        borderRadius: 18,
        padding: user.trialExhausted ? "36px 40px" : "20px 24px",
        maxWidth: user.trialExhausted ? 460 : 340,
        width: "calc(100vw - 32px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.15)",
      }}>

        {!user.trialExhausted && (
          <button onClick={() => setDismissed(true)} style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: "#445566", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        )}

        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: user.trialExhausted ? 20 : 14 }}>
          <div style={{ fontSize: user.trialExhausted ? 42 : 28, marginBottom: 8 }}>
            {user.trialExhausted ? "🚀" : "⚡"}
          </div>
          <div style={{ fontSize: user.trialExhausted ? 22 : 16, fontWeight: 900, color: "#e2eaf4", letterSpacing: "-0.03em" }}>
            {user.trialExhausted ? "Trial Limit Reached" : "Nearing Trial Limit"}
          </div>
          {user.trialExhausted && (
            <div style={{ fontSize: 14, color: "#7c9ab8", marginTop: 6, lineHeight: 1.5 }}>
              You&apos;ve used all 25 free AI messages. Upgrade to continue your conversations and keep your leads warm.
            </div>
          )}
        </div>

        {/* Usage bar */}
        <div style={{ marginBottom: user.trialExhausted ? 24 : 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "#7c9ab8" }}>
            <span>Trial messages used</span>
            <span style={{ fontWeight: 700, color: pct >= 100 ? "#ef4444" : "#f59e0b" }}>
              {user.trialMessagesUsed}/{user.trialMessagesLimit}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#ef4444" : "#f59e0b", borderRadius: 3, transition: "width 0.5s" }} />
          </div>
        </div>

        {/* Plans */}
        {user.trialExhausted && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {[
              { plan: "starter", label: "Starter", price: "$97/mo", msgs: "2,000 msgs/mo", color: "#14b8a6" },
              { plan: "pro",     label: "Pro",     price: "$197/mo", msgs: "8,000 msgs/mo", color: "#8b5cf6", badge: "POPULAR" },
              { plan: "agency",  label: "Agency",  price: "$397/mo", msgs: "25,000 msgs/mo", color: "#ec4899" },
            ].map(p => (
              <Link key={p.plan} href={`/checkout?plan=${p.plan}`} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 11,
                  background: p.badge ? `${p.color}12` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${p.badge ? p.color + "40" : "rgba(255,255,255,0.08)"}`,
                  transition: "all 0.2s", cursor: "pointer",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${p.color}18`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = p.badge ? `${p.color}12` : "rgba(255,255,255,0.03)"}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.label}</span>
                      {p.badge && <span style={{ fontSize: 9, fontWeight: 800, color: p.color, background: `${p.color}20`, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.06em" }}>{p.badge}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#445566", marginTop: 2 }}>{p.msgs}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#e2eaf4" }}>{p.price}</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <Link href="/pricing" style={{ textDecoration: "none", display: "block" }}>
          <div style={{
            padding: "13px", borderRadius: 11, textAlign: "center",
            background: "linear-gradient(135deg,#0d9488,#14b8a6)",
            color: "white", fontSize: 14, fontWeight: 800,
            cursor: "pointer", transition: "opacity 0.2s",
            boxShadow: "0 4px 20px rgba(20,184,166,0.35)",
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.85"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
          >
            {user.trialExhausted ? "Choose a Plan & Upgrade →" : "View Plans →"}
          </div>
        </Link>

        {!user.trialExhausted && (
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#2d3d50" }}>
            {user.trialMessagesLimit - user.trialMessagesUsed} message{user.trialMessagesLimit - user.trialMessagesUsed !== 1 ? "s" : ""} remaining
          </div>
        )}
      </div>
    </>
  );
}
