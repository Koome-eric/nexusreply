"use client";

import { useState, useEffect } from "react";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  automationRate: number;
  fallbackRate: number;
  estimatedRevenue: number;
  totalLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  lostLeads: number;
  agentStats: { name: string; role: string; messages: number; successRate: number }[];
  dailyMessages: { date: string; count: number }[];
  recentErrors: { message: string; createdAt: string; locationId?: string }[];
  planBreakdown: { plan: string; count: number }[];
  conversionFunnel: { stage: string; count: number }[];
}

const EMPTY: AdminStats = {
  totalUsers: 0, activeUsers: 0, totalMessages: 0, messagesToday: 0,
  messagesThisWeek: 0, messagesThisMonth: 0, automationRate: 0, fallbackRate: 0,
  estimatedRevenue: 0, totalLeads: 0, qualifiedLeads: 0, wonLeads: 0, lostLeads: 0,
  agentStats: [], dailyMessages: [], recentErrors: [], planBreakdown: [], conversionFunnel: [],
};

function KPI({ label, value, sub, color = "#14b8a6", icon }: { label: string; value: string | number; sub?: string; color?: string; icon: string }) {
  return (
    <div style={{
      background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "14px", padding: "20px 22px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "-10px", right: "-10px", fontSize: "52px", opacity: 0.06 }}>{icon}</div>
      <div style={{ fontSize: "12px", color: "#445566", fontWeight: 500, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "#445566", marginTop: "6px" }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontSize: "12px", color: "#7c9ab8" }}>{label}</span>
        <span style={{ fontSize: "12px", color: "#e2eaf4", fontWeight: 600 }}>{value} <span style={{ color: "#445566" }}>({pct}%)</span></span>
      </div>
      <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "4px", transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AdminStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7d" | "30d" | "all">("7d");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/stats?range=${range}`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  const maxDaily = Math.max(...(stats.dailyMessages.map(d => d.count)), 1);

  return (
    <div style={{ padding: "32px", maxWidth: "1300px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#e2eaf4", margin: 0 }}>Platform Analytics</h1>
          <p style={{ color: "#445566", margin: "6px 0 0", fontSize: "13px" }}>Real-time performance across all users & locations</p>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["7d", "30d", "all"] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: range === r ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${range === r ? "rgba(236,72,153,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: range === r ? "#ec4899" : "#445566",
            }}>{r === "all" ? "All Time" : r === "7d" ? "7 Days" : "30 Days"}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px", color: "#445566" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px", animation: "spin 1s linear infinite" }}>⚙️</div>
          Loading analytics...
        </div>
      ) : (
        <>
          {/* AI Performance KPIs */}
          <div style={{ marginBottom: "12px" }}>
            <h2 style={{ fontSize: "13px", color: "#ec4899", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 14px" }}>🤖 AI Performance</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
              <KPI icon="💬" label="Messages Today" value={stats.messagesToday.toLocaleString()} color="#14b8a6" />
              <KPI icon="📅" label="This Week" value={stats.messagesThisWeek.toLocaleString()} color="#14b8a6" />
              <KPI icon="📆" label="This Month" value={stats.messagesThisMonth.toLocaleString()} color="#14b8a6" />
              <KPI icon="🤖" label="Automation Rate" value={`${stats.automationRate}%`} sub="AI handled vs human" color="#a78bfa" />
              <KPI icon="🔁" label="Fallback Rate" value={`${stats.fallbackRate}%`} sub="Human takeovers" color={stats.fallbackRate > 20 ? "#ef4444" : "#22c55e"} />
              <KPI icon="💰" label="Est. Revenue" value={`$${stats.estimatedRevenue.toLocaleString()}`} sub="From subscriptions" color="#f59e0b" />
            </div>
          </div>

          {/* Sales KPIs */}
          <div style={{ marginBottom: "12px" }}>
            <h2 style={{ fontSize: "13px", color: "#ec4899", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 14px" }}>📊 Sales Performance</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
              <KPI icon="👤" label="Total Leads" value={stats.totalLeads.toLocaleString()} color="#14b8a6" />
              <KPI icon="✅" label="Qualified" value={stats.qualifiedLeads.toLocaleString()} sub={`${stats.totalLeads > 0 ? Math.round((stats.qualifiedLeads / stats.totalLeads) * 100) : 0}% of total`} color="#22c55e" />
              <KPI icon="🏆" label="Won" value={stats.wonLeads.toLocaleString()} sub={`${stats.qualifiedLeads > 0 ? Math.round((stats.wonLeads / stats.qualifiedLeads) * 100) : 0}% close rate`} color="#f59e0b" />
              <KPI icon="❌" label="Lost" value={stats.lostLeads.toLocaleString()} color="#ef4444" />
              <KPI icon="👥" label="Total Users" value={stats.totalUsers.toLocaleString()} color="#a78bfa" />
              <KPI icon="🟢" label="Active Users" value={stats.activeUsers.toLocaleString()} sub="Last 7 days" color="#22c55e" />
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            {/* Daily messages bar chart */}
            <div style={{ background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "14px", fontWeight: 700, color: "#e2eaf4" }}>Messages Over Time</h3>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px" }}>
                {stats.dailyMessages.slice(-14).map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                      <div style={{
                        width: "100%",
                        height: `${Math.max(4, (d.count / maxDaily) * 100)}%`,
                        background: "linear-gradient(180deg, #14b8a6, #0d9488)",
                        borderRadius: "3px 3px 0 0",
                        transition: "height 0.5s ease",
                        minHeight: "4px",
                      }} title={`${d.date}: ${d.count}`} />
                    </div>
                    <span style={{ fontSize: "9px", color: "#2d3d50", transform: "rotate(-45deg)", transformOrigin: "center" }}>
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
                {stats.dailyMessages.length === 0 && (
                  <div style={{ width: "100%", textAlign: "center", color: "#2d3d50", fontSize: "12px", paddingTop: "40px" }}>No data yet</div>
                )}
              </div>
            </div>

            {/* Conversion funnel */}
            <div style={{ background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "14px", fontWeight: 700, color: "#e2eaf4" }}>Conversion Funnel</h3>
              {stats.conversionFunnel.length > 0 ? (
                stats.conversionFunnel.map((f, i) => {
                  const colors = ["#14b8a6", "#a78bfa", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#ef4444"];
                  return <MiniBar key={f.stage} label={f.stage} value={f.count} max={stats.conversionFunnel[0]?.count || 1} color={colors[i % colors.length]} />;
                })
              ) : (
                <div style={{ color: "#2d3d50", fontSize: "12px", textAlign: "center", paddingTop: "30px" }}>No pipeline data yet</div>
              )}
            </div>
          </div>

          {/* Plan breakdown + Agent comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginBottom: "16px" }}>
            {/* Plan breakdown */}
            <div style={{ background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "14px", fontWeight: 700, color: "#e2eaf4" }}>Plan Distribution</h3>
              {stats.planBreakdown.length > 0 ? stats.planBreakdown.map((p) => {
                const color = p.plan === "enterprise" ? "#f59e0b" : p.plan === "pro" ? "#a78bfa" : p.plan === "starter" ? "#14b8a6" : "#445566";
                return (
                  <div key={p.plan} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: "13px", color: "#7c9ab8", textTransform: "capitalize" }}>{p.plan}</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 700, color }}>{p.count}</span>
                  </div>
                );
              }) : <div style={{ color: "#2d3d50", fontSize: "12px", textAlign: "center", paddingTop: "20px" }}>No subscriptions yet</div>}
            </div>

            {/* Agent performance table */}
            <div style={{ background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "14px", fontWeight: 700, color: "#e2eaf4" }}>Agent Performance</h3>
              {stats.agentStats.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      {["Agent", "Role", "Messages", "Success Rate", "Rating"].map(h => (
                        <th key={h} style={{ textAlign: "left", color: "#445566", fontWeight: 600, paddingBottom: "10px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.agentStats.map((a, i) => (
                      <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "10px 0", color: "#e2eaf4", fontWeight: 600 }}>{a.name}</td>
                        <td style={{ padding: "10px 0", color: "#7c9ab8" }}>{a.role}</td>
                        <td style={{ padding: "10px 0", color: "#14b8a6" }}>{a.messages.toLocaleString()}</td>
                        <td style={{ padding: "10px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                              <div style={{ height: "100%", width: `${a.successRate}%`, background: a.successRate > 70 ? "#22c55e" : a.successRate > 40 ? "#f59e0b" : "#ef4444", borderRadius: "2px" }} />
                            </div>
                            <span style={{ color: "#7c9ab8", fontSize: "11px" }}>{a.successRate}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 0", color: "#f59e0b" }}>{"★".repeat(Math.round(a.successRate / 20))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{ color: "#2d3d50", fontSize: "12px", textAlign: "center", paddingTop: "30px" }}>No agent data yet</div>}
            </div>
          </div>

          {/* Errors & Logs */}
          <div style={{ background: "rgba(13,21,37,0.8)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "14px", padding: "22px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 700, color: "#e2eaf4" }}>⚠️ Recent Errors & Logs</h3>
            {stats.recentErrors.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {stats.recentErrors.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", padding: "10px 14px", background: "rgba(239,68,68,0.04)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.1)" }}>
                    <span style={{ color: "#ef4444", fontSize: "13px" }}>⚠</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", color: "#7c9ab8" }}>{e.message}</div>
                      {e.locationId && <div style={{ fontSize: "10px", color: "#445566", marginTop: "2px" }}>Location: {e.locationId}</div>}
                    </div>
                    <div style={{ fontSize: "10px", color: "#2d3d50", whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px", color: "#2d3d50", fontSize: "12px" }}>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
                No errors logged — system healthy
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
