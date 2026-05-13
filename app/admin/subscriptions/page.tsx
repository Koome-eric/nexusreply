"use client";
import { useEffect, useState } from "react";

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<{plan:string;count:number}[]>([]);
  const [stats, setStats] = useState<{mrr:number;activeSubscriptions:number;trialUsers:number}|null>(null);
  const [loading, setLoading] = useState(true);
  const PLAN_COLORS: Record<string,string> = { trial:"#f59e0b", starter:"#14b8a6", pro:"#8b5cf6", agency:"#ec4899" };
  const PLAN_PRICES: Record<string,number> = { starter:97, pro:197, agency:397 };

  useEffect(() => {
    fetch("/api/admin/stats").then(r=>r.json()).then(d => {
      setPlans(d.planBreakdown||[]); setStats(d.stats); setLoading(false);
    });
  }, []);

  const total = plans.reduce((s,p) => s+p.count, 0);

  return (
    <div style={{ padding: "clamp(20px,4vw,36px)" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", color: "#e2eaf4", marginBottom: "4px" }}>Subscriptions</h1>
        <p style={{ color: "#7c9ab8", fontSize: "13px" }}>Revenue and plan distribution overview.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "Monthly MRR", value: stats?.mrr ? `$${stats.mrr.toLocaleString()}` : "$0", color: "#f59e0b" },
          { label: "Active Subscribers", value: stats?.activeSubscriptions ?? 0, color: "#22c55e" },
          { label: "Trial Users", value: stats?.trialUsers ?? 0, color: "#14b8a6" },
          { label: "Total Users", value: total, color: "#8b5cf6" },
        ].map(k => (
          <div key={k.label} style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "13px", padding: "18px 20px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#445566", letterSpacing: "0.05em", marginBottom: "10px" }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: k.color }}>{loading ? "..." : k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "24px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#7c9ab8", marginBottom: "20px", letterSpacing: "0.04em" }}>PLAN BREAKDOWN</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {loading ? <div style={{ height: "100px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} /> :
          plans.map(p => {
            const pct = total > 0 ? Math.round((p.count/total)*100) : 0;
            const revenue = (PLAN_PRICES[p.plan]||0) * p.count;
            return (
              <div key={p.plan}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#e2eaf4", textTransform: "capitalize" }}>{p.plan}</span>
                    <span style={{ fontSize: "11px", color: PLAN_COLORS[p.plan], background: `${PLAN_COLORS[p.plan]}18`, padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>{p.count} users · {pct}%</span>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: p.plan === "trial" ? "#445566" : "#22c55e" }}>
                    {p.plan === "trial" ? "free" : `$${revenue.toLocaleString()}/mo`}
                  </span>
                </div>
                <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: PLAN_COLORS[p.plan]||"#14b8a6", borderRadius: "4px", transition: "width 0.8s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
    </div>
  );
}
