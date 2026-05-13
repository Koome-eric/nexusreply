"use client";
import { useEffect, useState } from "react";

interface Notif { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; }

const ICONS: Record<string, string> = { pipeline_update: "📊", agent_handoff: "🔄", new_message: "💬", lead_won: "🏆", ai_activated: "⚡", agent_updated: "🤖", new_agent: "✨" };

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ClientNotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client?section=notifications").then(r => r.json()).then(d => { setNotifs(d.notifications || []); setLoading(false); });
  }, []);

  return (
    <div style={{ padding: "clamp(20px,3vw,36px)", maxWidth: "760px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Notifications</h1>
      <p style={{ color: "#2d3d50", margin: "0 0 24px", fontSize: "13px" }}>Updates from your AI sales team and platform.</p>

      {loading ? <div style={{ color: "#2d3d50", padding: "40px", textAlign: "center" }}>Loading…</div>
        : notifs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", background: "rgba(10,17,30,0.8)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔔</div>
            <div style={{ color: "#445566" }}>No notifications yet</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {notifs.map(n => (
              <div key={n.id} style={{ display: "flex", gap: "12px", padding: "14px 16px", background: n.read ? "rgba(10,17,30,0.7)" : "rgba(10,17,30,0.95)", border: `1px solid ${n.read ? "rgba(255,255,255,0.05)" : "rgba(20,184,166,0.15)"}`, borderRadius: "12px", borderLeft: `3px solid ${n.read ? "rgba(255,255,255,0.06)" : "#14b8a6"}` }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                  {ICONS[n.type] || "🔔"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "13px", fontWeight: n.read ? 400 : 700, color: n.read ? "#7c9ab8" : "#e2eaf4" }}>{n.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "10px" }}>
                      <span style={{ fontSize: "10px", color: "#2d3d50" }}>{timeAgo(n.createdAt)}</span>
                      {!n.read && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#14b8a6" }} />}
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#445566", marginTop: "3px", lineHeight: 1.5 }}>{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
