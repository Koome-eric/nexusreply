"use client";
import { useEffect, useState } from "react";

interface Overview {
  totalLeads: number; wonLeads: number; activeLeads: number;
  qualifiedLeads: number; totalMessages: number; automationRate: number;
  agents: { name: string; role: string; avatar: string }[];
}

const ROLE_COLORS: Record<string, string> = { SDR: "#14b8a6", SETTER: "#f59e0b", CLOSER: "#22c55e", FOLLOWUP: "#3b82f6" };

function KPI({ icon, label, value, sub, color = "#14b8a6" }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-8px", right: "-8px", fontSize: "44px", opacity: 0.06 }}>{icon}</div>
      <div style={{ fontSize: "10px", color: "#445566", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "5px" }}>{sub}</div>}
    </div>
  );
}

export default function ClientOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client?section=overview").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  return (
    <div style={{ padding: "clamp(20px,3vw,36px)", maxWidth: "1100px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Overview</h1>
        <p style={{ color: "#2d3d50", margin: 0, fontSize: "13px" }}>Your AI sales team is working for you 24/7.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "12px", marginBottom: "28px" }}>
        <KPI icon="👤" label="Total Leads"    value={loading ? "—" : data?.totalLeads ?? 0}    />
        <KPI icon="✅" label="Qualified"      value={loading ? "—" : data?.qualifiedLeads ?? 0} color="#a78bfa" sub={`of ${data?.totalLeads ?? 0} total`} />
        <KPI icon="🏆" label="Won"            value={loading ? "—" : data?.wonLeads ?? 0}       color="#22c55e" />
        <KPI icon="🔥" label="Active"         value={loading ? "—" : data?.activeLeads ?? 0}    color="#f59e0b" sub="in pipeline" />
        <KPI icon="💬" label="AI Messages"    value={loading ? "—" : data?.totalMessages ?? 0}  />
        <KPI icon="⚡" label="Automation"     value={loading ? "—" : `${data?.automationRate ?? 0}%`} color="#22c55e" sub="AI handled" />
      </div>

      {/* AI Team */}
      <div style={{ background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px", marginBottom: "16px" }}>
        <div style={{ fontSize: "11px", fontWeight: 800, color: "#14b8a6", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>Your AI Sales Team</div>
        {loading ? (
          <div style={{ color: "#2d3d50", fontSize: "13px" }}>Loading…</div>
        ) : data?.agents.length === 0 ? (
          <div style={{ color: "#2d3d50", fontSize: "13px" }}>No agents assigned yet. Contact your agency.</div>
        ) : (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {data?.agents.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", minWidth: "160px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${ROLE_COLORS[a.role] || "#14b8a6"}18`, border: `1px solid ${ROLE_COLORS[a.role] || "#14b8a6"}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                  {a.avatar}
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2eaf4" }}>{a.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
                    <span style={{ fontSize: "10px", color: ROLE_COLORS[a.role] || "#14b8a6", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>{a.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "10px" }}>
        {[
          { href: "/client/pipeline",      icon: "📊", label: "View Pipeline",       desc: "See all your leads and stages" },
          { href: "/client/conversations",  icon: "💬", label: "Conversations",       desc: "Review AI chat history" },
          { href: "/client/analytics",      icon: "📈", label: "Analytics",           desc: "Performance breakdown" },
          { href: "/client/ai-team",        icon: "🤖", label: "AI Sales Team",       desc: "See your active agents" },
        ].map(item => (
          <a key={item.href} href={item.href} style={{ display: "block", padding: "16px", borderRadius: "12px", background: "rgba(10,17,30,0.8)", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none", transition: "border-color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}>
            <div style={{ fontSize: "20px", marginBottom: "8px" }}>{item.icon}</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2eaf4", marginBottom: "4px" }}>{item.label}</div>
            <div style={{ fontSize: "11px", color: "#2d3d50" }}>{item.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
