"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";

const STAGES = [
  { key: "NEW", label: "New", color: "#7c9ab8", icon: "🆕" },
  { key: "ENGAGED", label: "Engaged", color: "#14b8a6", icon: "💬" },
  { key: "QUALIFIED", label: "Qualified", color: "#8b5cf6", icon: "✅" },
  { key: "BOOKING", label: "Booking", color: "#f59e0b", icon: "📅" },
  { key: "CLOSING", label: "Closing", color: "#ef4444", icon: "🔥" },
  { key: "WON", label: "Won", color: "#22c55e", icon: "💰" },
  { key: "NURTURE", label: "Nurture", color: "#445566", icon: "🌙" },
];

interface Lead {
  id: string;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: string;
  score: number;
  isQualified: boolean;
  hasBooked: boolean;
  messageCount: number;
  lastIntent: string | null;
  lastMessageAt: string | null;
  outboundStarted: boolean;
  assignedAgent: { id: string; name: string; avatar: string; role: string } | null;
}

interface Location { id: string; name: string }

function PipelineContent() {
  const params = useSearchParams();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocId, setSelectedLocId] = useState(params.get("locationId") || "");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [movingLead, setMovingLead] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      const locs = d.locations || [];
      setLocations(locs);
      if (!selectedLocId && locs[0]) setSelectedLocId(locs[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedLocId) return;
    setLoading(true);
    fetch(`/api/pipeline?locationId=${selectedLocId}`).then(r => r.json()).then(d => {
      setLeads(d.leads || []);
      const counts: Record<string, number> = {};
      (d.stageCounts || []).forEach((s: { stage: string; _count: number }) => { counts[s.stage] = s._count; });
      setStageCounts(counts);
      setLoading(false);
    });
  }, [selectedLocId]);

  const moveToStage = async (leadId: string, newStage: string) => {
    setMovingLead(leadId);
    await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, stage: newStage }),
    });
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
    if (selectedLead?.id === leadId) setSelectedLead(prev => prev ? { ...prev, stage: newStage } : null);
    setMovingLead(null);
  };

  const leadsInStage = (stageKey: string) =>
    leads.filter(l => l.stage === stageKey);

  const IS: React.CSSProperties = { width: "100%", background: "#0d1525", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "8px", padding: "9px 12px", color: "#e2eaf4", fontSize: "13px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ padding: "clamp(16px,3vw,32px)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "4px" }}>Sales Pipeline</h1>
          <p style={{ color: "#7c9ab8", fontSize: "13px" }}>Track every lead through your AI sales process.</p>
        </div>
        {locations.length > 1 && (
          <select style={{ ...IS, maxWidth: "240px" }} value={selectedLocId} onChange={e => setSelectedLocId(e.target.value)}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
        {STAGES.map(s => (
          <div key={s.key} style={{ padding: "6px 14px", borderRadius: "8px", background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: "7px", fontSize: "12px" }}>
            <span>{s.icon}</span>
            <span style={{ color: "#7c9ab8" }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: s.color }}>{stageCounts[s.key] || 0}</span>
          </div>
        ))}
        <div style={{ padding: "6px 14px", borderRadius: "8px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", gap: "7px", fontSize: "12px" }}>
          <span>👥</span>
          <span style={{ color: "#7c9ab8" }}>Total</span>
          <span style={{ fontWeight: 700, color: "#22c55e" }}>{leads.length}</span>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div style={{ display: "flex", gap: "14px", overflowX: "auto" }}>
          {STAGES.slice(0, 5).map(s => <div key={s.key} className="shimmer" style={{ minWidth: "240px", height: "400px", borderRadius: "14px", flexShrink: 0 }} />)}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "16px" }}>
          {STAGES.map(stageConfig => {
            const stageLeads = leadsInStage(stageConfig.key);
            return (
              <div key={stageConfig.key} style={{ minWidth: "230px", maxWidth: "260px", flexShrink: 0 }}>
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", padding: "10px 12px", borderRadius: "10px", background: "rgba(13,21,37,0.8)", border: `1px solid ${stageConfig.color}33` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span style={{ fontSize: "15px" }}>{stageConfig.icon}</span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: stageConfig.color }}>{stageConfig.label}</span>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: stageConfig.color, background: `${stageConfig.color}22`, padding: "2px 8px", borderRadius: "6px" }}>
                    {stageLeads.length}
                  </span>
                </div>

                {/* Lead cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {stageLeads.length === 0 ? (
                    <div style={{ padding: "20px", borderRadius: "10px", border: `1px dashed ${stageConfig.color}33`, textAlign: "center", color: "#445566", fontSize: "12px" }}>
                      No leads
                    </div>
                  ) : stageLeads.map(lead => (
                    <div key={lead.id}
                      onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                      style={{
                        background: selectedLead?.id === lead.id ? "rgba(20,184,166,0.06)" : "rgba(13,21,37,0.9)",
                        border: `1px solid ${selectedLead?.id === lead.id ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius: "10px", padding: "12px 14px", cursor: "pointer",
                        transition: "all 0.15s",
                      }}>
                      {/* Contact */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2eaf4" }}>{lead.contactName || "Unknown"}</div>
                          <div style={{ fontSize: "10px", color: "#445566" }}>{lead.contactPhone || lead.contactEmail || lead.contactId.slice(0, 12)}</div>
                        </div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: lead.score >= 60 ? "#22c55e" : lead.score >= 30 ? "#f59e0b" : "#445566" }}>
                          {lead.score}pts
                        </div>
                      </div>

                      {/* Agent */}
                      {lead.assignedAgent && (
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "13px" }}>{lead.assignedAgent.avatar}</span>
                          <span style={{ fontSize: "11px", color: "#14b8a6" }}>{lead.assignedAgent.name}</span>
                        </div>
                      )}

                      {/* Stats */}
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "10px", color: "#7c9ab8", background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: "4px" }}>
                          💬 {lead.messageCount}
                        </span>
                        {lead.lastMessageAt && (
                          <span style={{ fontSize: "10px", color: "#445566", background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: "4px" }}>
                            {formatRelativeTime(lead.lastMessageAt)}
                          </span>
                        )}
                        {lead.lastIntent && (
                          <span style={{ fontSize: "10px", color: "#7c9ab8", background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: "4px" }}>
                            {lead.lastIntent}
                          </span>
                        )}
                      </div>

                      {/* Move buttons */}
                      {selectedLead?.id === lead.id && (
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: "10px", color: "#445566", marginBottom: "6px", fontWeight: 600 }}>MOVE TO:</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {STAGES.filter(s => s.key !== lead.stage).map(s => (
                              <button key={s.key} onClick={(e) => { e.stopPropagation(); moveToStage(lead.id, s.key); }}
                                disabled={movingLead === lead.id}
                                style={{ padding: "3px 8px", borderRadius: "5px", border: `1px solid ${s.color}44`, background: `${s.color}11`, color: s.color, fontSize: "10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                                {s.icon} {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  return <Suspense fallback={<div style={{ padding: "40px", color: "#7c9ab8" }}>Loading...</div>}><PipelineContent /></Suspense>;
}
