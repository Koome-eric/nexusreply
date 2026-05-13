"use client";
import { useEffect, useState } from "react";

const STAGE_COLORS: Record<string, string> = { NEW: "#445566", ENGAGED: "#3b82f6", QUALIFIED: "#a78bfa", BOOKING: "#f59e0b", CLOSING: "#ec4899", WON: "#22c55e", LOST: "#ef4444", NURTURE: "#14b8a6" };

interface Lead { id: string; contactName: string | null; contactEmail: string | null; stage: string; score: number; isQualified: boolean; hasBooked: boolean; lastIntent: string | null; messageCount: number; outboundStarted: boolean; assignedAgent: { name: string; avatar: string } | null; updatedAt: string; }
interface StageCount { stage: string; _count: number; }

export default function ClientPipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stageCounts, setStageCounts] = useState<StageCount[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client?section=pipeline").then(r => r.json()).then(d => {
      setLeads(d.leads || []); setStageCounts(d.stageCounts || []); setLoading(false);
    });
  }, []);

  const stages = ["ALL", "NEW", "ENGAGED", "QUALIFIED", "BOOKING", "CLOSING", "WON", "LOST", "NURTURE"];
  const filtered = filter === "ALL" ? leads : leads.filter(l => l.stage === filter);

  return (
    <div style={{ padding: "clamp(20px,3vw,36px)", maxWidth: "1100px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>My Pipeline</h1>
        <p style={{ color: "#2d3d50", margin: 0, fontSize: "13px" }}>All leads being worked by your AI sales team.</p>
      </div>

      {/* Stage counts */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {stages.map(s => {
          const count = s === "ALL" ? leads.length : (stageCounts.find(sc => sc.stage === s)?._count || 0);
          const active = filter === s;
          const color = STAGE_COLORS[s] || "#14b8a6";
          return (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: active ? `${color}20` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? color : "rgba(255,255,255,0.07)"}`, color: active ? color : "#445566" }}>
              {s} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      <div style={{ background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Contact", "Stage", "Agent", "Score", "Messages", "Last Activity"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#445566", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ padding: "50px", textAlign: "center", color: "#445566" }}>Loading pipeline…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6} style={{ padding: "50px", textAlign: "center", color: "#445566" }}>No leads found</td></tr>
              : filtered.map(lead => (
                <tr key={lead.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#e2eaf4" }}>{lead.contactName || "Unknown"}</div>
                    <div style={{ fontSize: "10px", color: "#2d3d50" }}>{lead.contactEmail || ""}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 9px", borderRadius: "5px", fontSize: "10px", fontWeight: 700, background: `${STAGE_COLORS[lead.stage] || "#445566"}20`, color: STAGE_COLORS[lead.stage] || "#7c9ab8", border: `1px solid ${STAGE_COLORS[lead.stage] || "#445566"}40` }}>{lead.stage}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#7c9ab8" }}>{lead.assignedAgent ? `${lead.assignedAgent.avatar} ${lead.assignedAgent.name}` : "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px" }}>
                        <div style={{ height: "100%", width: `${lead.score}%`, background: lead.score >= 80 ? "#22c55e" : lead.score >= 50 ? "#f59e0b" : "#ef4444", borderRadius: "2px" }} />
                      </div>
                      <span style={{ fontSize: "11px", color: "#445566" }}>{lead.score}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#7c9ab8" }}>{lead.messageCount}</td>
                  <td style={{ padding: "12px 16px", color: "#2d3d50", fontSize: "11px" }}>
                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
