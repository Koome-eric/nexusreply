"use client";
import { useEffect, useState } from "react";

const ROLE_META: Record<string, { icon: string; label: string; color: string; trigger: string }> = {
  SDR:      { icon: "🤝", label: "Lead Qualifier",       color: "#14b8a6", trigger: "Activates on NEW & ENGAGED leads"          },
  SETTER:   { icon: "📅", label: "Appointment Setter",   color: "#f59e0b", trigger: "Activates when lead shows scheduling intent" },
  CLOSER:   { icon: "🔥", label: "Sales Closer",         color: "#22c55e", trigger: "Activates on price enquiry & buying signals" },
  FOLLOWUP: { icon: "🌙", label: "Follow-Up Specialist", color: "#3b82f6", trigger: "Activates after 24h+ silence"               },
};

interface Agent { id: string; name: string; role: string; avatar: string; tone: string; isActive: boolean; triggerStages: string[]; triggerIntents: string[]; }

export default function ClientAITeamPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client?section=agents").then(r => r.json()).then(d => { setAgents(d.agents || []); setLoading(false); });
  }, []);

  return (
    <div style={{ padding: "clamp(20px,3vw,36px)", maxWidth: "900px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>AI Sales Team</h1>
        <p style={{ color: "#2d3d50", margin: 0, fontSize: "13px" }}>Your AI agents work automatically on your leads 24/7. Contact your agency to make changes.</p>
      </div>

      {loading ? <div style={{ color: "#2d3d50", padding: "40px" }}>Loading agents…</div>
        : agents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", background: "rgba(10,17,30,0.8)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🤖</div>
            <div style={{ fontSize: "15px", color: "#7c9ab8", marginBottom: "6px" }}>No agents assigned yet</div>
            <div style={{ fontSize: "12px", color: "#2d3d50" }}>Contact your agency to activate your AI sales team.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "14px" }}>
            {agents.map(agent => {
              const meta = ROLE_META[agent.role] || { icon: "⚙️", label: agent.role, color: "#a78bfa", trigger: "" };
              return (
                <div key={agent.id} style={{ background: "rgba(10,17,30,0.9)", border: `1px solid ${agent.isActive ? `${meta.color}25` : "rgba(255,255,255,0.06)"}`, borderRadius: "16px", padding: "22px", opacity: agent.isActive ? 1 : 0.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${meta.color}18`, border: `1px solid ${meta.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>{agent.avatar}</div>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#e2eaf4" }}>{agent.name}</div>
                      <div style={{ fontSize: "10px", color: meta.color, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>{meta.label}</div>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px", background: agent.isActive ? "rgba(34,197,94,0.1)" : "rgba(100,100,100,0.1)", color: agent.isActive ? "#22c55e" : "#445566" }}>
                        {agent.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#445566", padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", borderLeft: `3px solid ${meta.color}` }}>
                    {meta.trigger}
                  </div>
                  <div style={{ marginTop: "12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "10px", color: "#2d3d50" }}>Tone:</div>
                    <span style={{ fontSize: "10px", color: "#7c9ab8", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: "4px", textTransform: "capitalize" }}>{agent.tone}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
