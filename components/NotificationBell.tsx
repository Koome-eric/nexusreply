"use client";

import { useState, useEffect, useRef } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  pipeline_update: "📊",
  agent_handoff: "🔄",
  new_message: "💬",
  trial_ending: "⏳",
  plan_upgraded: "🎉",
  new_lead: "👤",
  lead_won: "💰",
  ai_error: "⚠️",
  webhook_connected: "🔗",
  outbound_complete: "✅",
  agent_updated: "🤖",
  agent_removed: "🗑️",
  new_agent: "✨",
  agent_synced: "📡",
  ai_activated: "⚡",
  client_joined: "👤",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    fetch("/api/notifications").then(r => r.json()).then(d => {
      setNotifications(d.notifications || []);
      setUnread(d.unreadCount || 0);
    }).catch(() => {});
  };

  useEffect(() => {
    load();

    // SSE for real-time updates
    let es: EventSource;
    try {
      es = new EventSource("/api/notifications/stream");
      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "notification") {
          setNotifications(prev => [data.notification, ...prev].slice(0, 50));
          setUnread(prev => prev + 1);
        }
      };
      es.onerror = () => es.close();
    } catch { /* SSE not supported */ }

    // Fallback polling every 30s
    const interval = setInterval(load, 30000);

    return () => {
      es?.close();
      clearInterval(interval);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        style={{
          position: "relative",
          background: "rgba(13,21,37,0.8)",
          border: "1px solid rgba(20,184,166,0.2)",
          borderRadius: "10px",
          width: "38px",
          height: "38px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: "16px",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand)"}
        onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(20,184,166,0.2)"}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: "-5px",
            right: "-5px",
            background: "#ef4444",
            color: "white",
            fontSize: "10px",
            fontWeight: 800,
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--bg-base)",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "46px",
          right: 0,
          width: "340px",
          maxHeight: "480px",
          background: "rgba(13,21,37,0.98)",
          border: "1px solid rgba(20,184,166,0.2)",
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
          zIndex: 1000,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#e2eaf4" }}>
              Notifications {unread > 0 && <span style={{ color: "var(--brand)", fontSize: "12px" }}>({unread} new)</span>}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: "12px", color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#445566", fontSize: "13px" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔔</div>
                No notifications yet
              </div>
            ) : notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.read) markRead(n.id); }}
                style={{
                  padding: "12px 18px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: n.read ? "transparent" : "rgba(20,184,166,0.04)",
                  cursor: n.read ? "default" : "pointer",
                  transition: "background 0.15s",
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
                onMouseEnter={(e) => { if (!n.read) (e.currentTarget as HTMLDivElement).style.background = "rgba(20,184,166,0.07)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = n.read ? "transparent" : "rgba(20,184,166,0.04)"; }}
              >
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: n.read ? "rgba(255,255,255,0.04)" : "rgba(20,184,166,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "15px",
                  flexShrink: 0,
                }}>
                  {TYPE_ICONS[n.type] || "🔔"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: n.read ? 400 : 600, color: n.read ? "#7c9ab8" : "#e2eaf4", marginBottom: "2px" }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#445566", lineHeight: 1.45, marginBottom: "4px" }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: "10px", color: "#2d3d50" }}>
                    {timeAgo(n.createdAt)}
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--brand)", flexShrink: 0, marginTop: "4px" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
