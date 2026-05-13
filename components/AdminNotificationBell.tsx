"use client";

import { useState, useEffect, useRef } from "react";

interface AdminNotif {
  id: string;
  type: "new_user" | "new_subscription" | "ai_error" | "plan_change" | "trial_started";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, string> = {
  new_user: "👤",
  new_subscription: "💳",
  ai_error: "⚠️",
  plan_change: "🔄",
  trial_started: "🚀",
};

export default function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    // Admin sees all notifications that are system-level
    fetch("/api/notifications?unread=false&admin=true")
      .then(r => r.json())
      .then(d => {
        setNotifs(d.notifications || []);
        setUnread(d.unreadCount || 0);
      }).catch(() => {});
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifs(p => p.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const timeAgo = (d: string) => {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        style={{
          position: "relative", background: "rgba(6,11,18,0.8)",
          border: "1px solid rgba(236,72,153,0.2)", borderRadius: "10px",
          width: "38px", height: "38px", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", fontSize: "16px",
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "-5px", right: "-5px",
            background: "#ec4899", color: "white", fontSize: "10px", fontWeight: 800,
            width: "18px", height: "18px", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #060b12",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "46px", right: 0, width: "320px", maxHeight: "420px",
          background: "rgba(6,11,18,0.99)", border: "1px solid rgba(236,72,153,0.2)",
          borderRadius: "14px", boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          zIndex: 1000, overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(236,72,153,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#e2eaf4" }}>Admin Alerts</span>
            {unread > 0 && (
              <button onClick={markAll} style={{ fontSize: "11px", color: "#ec4899", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#445566", fontSize: "12px" }}>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>🛡</div>
                No alerts
              </div>
            ) : notifs.map((n) => (
              <div key={n.id} style={{
                padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: n.read ? "transparent" : "rgba(236,72,153,0.04)",
                display: "flex", gap: "10px",
              }}>
                <div style={{ fontSize: "18px", flexShrink: 0 }}>{ICONS[n.type] || "🔔"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: n.read ? 400 : 600, color: n.read ? "#7c9ab8" : "#e2eaf4" }}>{n.title}</div>
                  <div style={{ fontSize: "11px", color: "#445566", marginTop: "2px" }}>{n.message}</div>
                  <div style={{ fontSize: "10px", color: "#2d3d50", marginTop: "3px" }}>{timeAgo(n.createdAt)}</div>
                </div>
                {!n.read && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ec4899", flexShrink: 0, marginTop: "4px" }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
