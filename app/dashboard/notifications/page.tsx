"use client";

import { useState, useEffect } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

const TYPE_ICONS: Record<string, string> = {
  pipeline_update: "📊", agent_handoff: "🔄", new_message: "💬",
  trial_ending: "⏳", plan_upgraded: "🎉", new_lead: "👤",
  lead_won: "💰", ai_error: "⚠️", webhook_connected: "🔗", outbound_complete: "✅",
  agent_updated: "🤖", agent_removed: "🗑️", new_agent: "✨", agent_synced: "📡",
  ai_activated: "⚡",
};

const TYPE_COLORS: Record<string, string> = {
  pipeline_update: "#14b8a6", agent_handoff: "#a78bfa", new_message: "#3b82f6",
  trial_ending: "#f59e0b", plan_upgraded: "#22c55e", new_lead: "#14b8a6",
  lead_won: "#22c55e", ai_error: "#ef4444", webhook_connected: "#14b8a6", outbound_complete: "#22c55e",
  agent_updated: "#a78bfa", agent_removed: "#ef4444", new_agent: "#22c55e",
  agent_synced: "#14b8a6", ai_activated: "#14b8a6",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = () => {
    fetch("/api/notifications").then(r => r.json()).then(d => {
      setNotifications(d.notifications || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const displayed = filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ padding: "32px", maxWidth: "800px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 6px" }}>
            Notifications
            {unreadCount > 0 && (
              <span style={{ marginLeft: "10px", background: "rgba(20,184,166,0.15)", color: "#14b8a6", fontSize: "13px", padding: "2px 10px", borderRadius: "20px", border: "1px solid rgba(20,184,166,0.3)" }}>
                {unreadCount} new
              </span>
            )}
          </h1>
          <p style={{ color: "#445566", margin: 0, fontSize: "13px" }}>Pipeline updates, agent activity, and system alerts</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["all", "unread"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
              background: filter === f ? "rgba(20,184,166,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === f ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: filter === f ? "#14b8a6" : "#445566",
            }}>{f}</button>
          ))}
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{
              padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#445566",
            }}>Mark all read</button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#445566" }}>Loading notifications...</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px", background: "rgba(13,21,37,0.6)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔔</div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#7c9ab8", marginBottom: "8px" }}>
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </div>
          <div style={{ fontSize: "13px", color: "#2d3d50" }}>
            {filter === "unread" ? "You're all caught up!" : "Pipeline updates and AI activity will appear here."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {displayed.map((n) => {
            const color = TYPE_COLORS[n.type] || "#14b8a6";
            return (
              <div
                key={n.id}
                onClick={() => { if (!n.read) markRead(n.id); }}
                style={{
                  background: n.read ? "rgba(13,21,37,0.6)" : "rgba(13,21,37,0.9)",
                  border: `1px solid ${n.read ? "rgba(255,255,255,0.06)" : `${color}22`}`,
                  borderLeft: `3px solid ${n.read ? "rgba(255,255,255,0.06)" : color}`,
                  borderRadius: "12px", padding: "16px 18px",
                  cursor: n.read ? "default" : "pointer",
                  display: "flex", gap: "14px", alignItems: "flex-start",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!n.read) (e.currentTarget as HTMLDivElement).style.background = "rgba(20,184,166,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.read ? "rgba(13,21,37,0.6)" : "rgba(13,21,37,0.9)"; }}
              >
                {/* Icon */}
                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
                  background: n.read ? "rgba(255,255,255,0.04)" : `${color}18`,
                  border: `1px solid ${n.read ? "rgba(255,255,255,0.06)" : `${color}33`}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
                }}>
                  {TYPE_ICONS[n.type] || "🔔"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ fontSize: "14px", fontWeight: n.read ? 500 : 700, color: n.read ? "#7c9ab8" : "#e2eaf4" }}>
                      {n.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <span style={{ fontSize: "11px", color: "#2d3d50" }}>{timeAgo(n.createdAt)}</span>
                      {!n.read && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: color }} />}
                    </div>
                  </div>
                  <div style={{ fontSize: "13px", color: "#445566", marginTop: "4px", lineHeight: 1.5 }}>{n.message}</div>
                  <div style={{ marginTop: "6px" }}>
                    <span style={{
                      fontSize: "10px", padding: "2px 8px", borderRadius: "5px",
                      background: `${color}11`, color, border: `1px solid ${color}22`,
                      textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
                    }}>{n.type.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
