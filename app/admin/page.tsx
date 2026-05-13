"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

interface Stats { totalUsers: number; activeSubscriptions: number; totalLocations: number; activeLocations: number; msgsToday: number; msgsThisMonth: number; trialUsers: number; wonLeads: number; mrr: number }
interface PlanBreakdown { plan: string; count: number }
interface RecentUser { id: string; email: string; name: string | null; plan: string; createdAt: string }

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<PlanBreakdown[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview").then(r => r.json()).then(d => {
      setStats(d.stats);
      setPlans(d.planBreakdown || []);
      setRecentUsers(d.recentUsers || []);
      setLoading(false);
    });
  }, []);

  const kpis = [
    { label: "Total Users", value: stats?.totalUsers, icon: "👥", color: "#14b8a6" },
    { label: "Active Subscribers", value: stats?.activeSubscriptions, icon: "💳", color: "#22c55e" },
    { label: "Monthly MRR", value: stats?.mrr ? `$${stats.mrr.toLocaleString()}` : null, icon: "💰", color: "#f59e0b" },
    { label: "Total Locations", value: stats?.totalLocations, icon: "📍", color: "#8b5cf6" },
    { label: "Active AI Locations", value: stats?.activeLocations, icon: "⚡", color: "#14b8a6" },
    { label: "Messages Today", value: stats?.msgsToday, icon: "💬", color: "#ec4899" },
    { label: "Messages This Month", value: stats?.msgsThisMonth, icon: "📊", color: "#7c9ab8" },
    { label: "Leads Won (AI)", value: stats?.wonLeads, icon: "🏆", color: "#22c55e" },
  ];

  const planColors: Record<string, string> = { trial: "#f59e0b", starter: "#14b8a6", pro: "#8b5cf6", agency: "#ec4899" };

  return (
    <div style={{ padding: "clamp(20px,4vw,40px)" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "5px", color: "#e2eaf4" }}>Platform Overview</h1>
        <p style={{ color: "#7c9ab8", fontSize: "14px" }}>Real-time stats across all users and locations.</p>
      </div>

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px", marginBottom: "32px" }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "13px", padding: "18px 20px", animation: `fadeInUp 0.4s ease ${i * 0.05}s both` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#445566", letterSpacing: "0.05em" }}>{k.label.toUpperCase()}</span>
              <span style={{ fontSize: "16px" }}>{k.icon}</span>
            </div>
            {loading
              ? <div style={{ height: "32px", width: "60px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.5s infinite" }} />
              : <div style={{ fontSize: "28px", fontWeight: 800, color: k.color, letterSpacing: "-0.02em" }}>{k.value ?? 0}</div>
            }
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "20px" }}>
        {/* Plan breakdown */}
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#7c9ab8", marginBottom: "18px", letterSpacing: "0.04em" }}>PLAN DISTRIBUTION</h2>
          {loading ? <div style={{ height: "120px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {plans.map(p => {
                const total = plans.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                return (
                  <div key={p.plan}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontSize: "13px", color: "#e2eaf4", textTransform: "capitalize" }}>{p.plan}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: planColors[p.plan] || "#7c9ab8" }}>{p.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: "5px", borderRadius: "3px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: planColors[p.plan] || "#14b8a6", borderRadius: "3px", transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent signups */}
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "18px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#7c9ab8", letterSpacing: "0.04em" }}>RECENT SIGNUPS</h2>
            <a href="/admin/users" style={{ fontSize: "12px", color: "#ec4899", textDecoration: "none" }}>View all →</a>
          </div>
          {loading ? <div style={{ height: "160px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentUsers.map(u => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#e2eaf4" }}>{u.name || u.email}</div>
                    <div style={{ fontSize: "11px", color: "#445566" }}>{u.email}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: planColors[u.plan] || "#445566", background: `${planColors[u.plan] || "#445566"}18`, padding: "2px 7px", borderRadius: "4px" }}>
                      {u.plan.toUpperCase()}
                    </span>
                    <div style={{ fontSize: "10px", color: "#445566", marginTop: "3px" }}>{formatRelativeTime(u.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>
    </div>
  );
}
