"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  status: string;
  locationCount: number;
  messageCount: number;
  trialEndsAt: string | null;
  createdAt: string;
}

interface Stats { totalMessages: number; activeUsers: number; mrr: number }

const PLAN_COLORS: Record<string, string> = { trial: "#f59e0b", starter: "#14b8a6", pro: "#8b5cf6", agency: "#ec4899", none: "#445566" };

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionUser, setActionUser] = useState<string | null>(null);

  const load = (p = page) => {
    setLoading(true);
    fetch(`/api/admin/users?page=${p}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setStats(d.stats);
        setTotal(d.total || 0);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, [page]);

  const doAction = async (userId: string, action: string, plan?: string) => {
    setActionUser(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action, plan }),
    });
    load();
    setActionUser(null);
  };

  return (
    <div style={{ padding: "clamp(20px,4vw,40px)", maxWidth: "1200px" }}>
      <div style={{ marginBottom: "32px" }} className="fade-in-up">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "20px" }}>🛡</span>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, letterSpacing: "-0.03em" }}>Admin Dashboard</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Manage all users, subscriptions, and platform health.</p>
      </div>

      {/* Platform stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "14px", marginBottom: "32px" }}>
          {[
            { label: "Total Users", value: total, icon: "👥", color: "#14b8a6" },
            { label: "Active Subscribers", value: stats.activeUsers, icon: "✅", color: "#22c55e" },
            { label: "Monthly MRR", value: `$${stats.mrr.toLocaleString()}`, icon: "💰", color: "#f59e0b" },
            { label: "Total AI Messages", value: stats.totalMessages.toLocaleString(), icon: "💬", color: "#8b5cf6" },
          ].map((s) => (
            <div key={s.label} className="glass gradient-border" style={{ borderRadius: "14px", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em" }}>{s.label.toUpperCase()}</span>
                <span style={{ fontSize: "18px" }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div className="glass fade-in-up" style={{ borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--bg-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600 }}>All Users ({total})</h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bg-border)" }}>
                {["User", "Plan", "Status", "Locations", "Messages", "Joined", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} style={{ padding: "12px 16px" }}>
                    <div className="shimmer" style={{ height: "32px", borderRadius: "6px" }} />
                  </td></tr>
                ))
              ) : users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--bg-border)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: `${PLAN_COLORS[u.plan]}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: PLAN_COLORS[u.plan], flexShrink: 0 }}>
                        {(u.name || u.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{u.name || "—"}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: PLAN_COLORS[u.plan] || "#445566", background: `${PLAN_COLORS[u.plan]}18`, padding: "3px 8px", borderRadius: "5px" }}>
                      {u.plan.toUpperCase()}
                    </span>
                    {u.role === "admin" && <span style={{ marginLeft: "5px", fontSize: "10px", color: "#ec4899" }}>🛡 Admin</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "11px", color: u.status === "active" ? "#22c55e" : u.status === "trialing" ? "#f59e0b" : "#ef4444" }}>
                      ● {u.status}
                    </span>
                    {u.status === "trialing" && u.trialEndsAt && (
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>ends {formatRelativeTime(u.trialEndsAt)}</div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{u.locationCount}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{u.messageCount.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatRelativeTime(u.createdAt)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {actionUser === u.id ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>...</span>
                    ) : (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <select
                          onChange={(e) => { if (e.target.value) doAction(u.id, "set_plan", e.target.value); e.target.value = ""; }}
                          style={{ fontSize: "11px", padding: "4px 8px", background: "var(--bg-surface)", border: "1px solid var(--bg-border)", borderRadius: "6px", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-sora)" }}>
                          <option value="">Set plan…</option>
                          {["trial", "starter", "pro", "agency"].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button onClick={() => doAction(u.id, u.role === "admin" ? "remove_admin" : "make_admin")}
                          style={{ fontSize: "11px", padding: "4px 8px", background: "transparent", border: "1px solid var(--bg-border)", borderRadius: "6px", color: u.role === "admin" ? "#ec4899" : "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-sora)", transition: "all 0.15s" }}>
                          {u.role === "admin" ? "Remove Admin" : "Make Admin"}
                        </button>
                        <button onClick={() => doAction(u.id, "suspend")}
                          style={{ fontSize: "11px", padding: "4px 8px", background: "transparent", border: "1px solid var(--bg-border)", borderRadius: "6px", color: "#ef4444", cursor: "pointer", fontFamily: "var(--font-sora)", transition: "all 0.15s" }}>
                          Suspend
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--bg-border)", display: "flex", gap: "8px", justifyContent: "center" }}>
            {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${page === p ? "var(--brand)" : "var(--bg-border)"}`, background: page === p ? "rgba(20,184,166,0.1)" : "transparent", color: page === p ? "var(--brand)" : "var(--text-muted)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--font-sora)", transition: "all 0.15s" }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
