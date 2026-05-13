"use client";

import { useState, useEffect, useCallback } from "react";

interface ActiveContact {
  id: string; name: string; email: string; phone: string;
  stage: string; assignedAgent: string; score: number; lastActivity: string | null;
  tags: string[]; outboundStarted: boolean; isAIEnabled: boolean;
  aiStatus: "active" | "activating" | "pending" | "off";
}

const STAGE_COLORS: Record<string, string> = {
  NEW: "#445566", ENGAGED: "#3b82f6", QUALIFIED: "#a78bfa",
  BOOKING: "#f59e0b", CLOSING: "#ec4899", WON: "#22c55e",
  LOST: "#ef4444", NURTURE: "#14b8a6",
};

const AI_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:     { label: "AI Active",     color: "#22c55e", bg: "rgba(34,197,94,0.1)",   dot: "#22c55e" },
  activating: { label: "Starting…",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  dot: "#f59e0b" },
  pending:    { label: "Pending",        color: "#445566", bg: "rgba(100,116,139,0.1)", dot: "#445566" },
  off:        { label: "Not enabled",   color: "#2d3d50", bg: "rgba(100,116,139,0.06)", dot: "#2d3d50" },
};

interface Location { id: string; name: string; }

export default function ActiveContactsPage() {
  const [contacts, setContacts] = useState<ActiveContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [aiCount, setAiCount] = useState(0);

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      const locs = d.locations || [];
      setLocations(locs);
      if (locs[0]) setSelectedLoc(locs[0].id);
    });
  }, []);

  const load = useCallback(() => {
    if (!selectedLoc) return;
    setLoading(true);
    fetch(`/api/outbound/contacts?locationId=${selectedLoc}&tag=ai_enabled`)
      .then(r => r.json())
      .then(d => {
        setContacts(d.contacts || []);
        setAiCount(d.aiEnabledCount || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedLoc]);

  useEffect(() => { load(); }, [load]);

  const manualActivate = async (contact: ActiveContact) => {
    setActivatingId(contact.id);
    const res = await fetch("/api/outbound/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: selectedLoc,
        contactId: contact.id,
        contactName: contact.name,
        contactEmail: contact.email,
        contactPhone: contact.phone,
      }),
    });
    const data = await res.json();
    setActivatingId(null);
    if (data.success) {
      setBanner({ type: "success", msg: `✅ ${data.message} for ${contact.name}` });
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, outboundStarted: true, aiStatus: "active" } : c));
    } else {
      setBanner({ type: "error", msg: `⚠️ ${data.error || data.message}` });
    }
    setTimeout(() => setBanner(null), 5000);
  };

  const filtered = contacts.filter(c => {
    const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const mst = stageFilter === "ALL" || c.stage === stageFilter;
    return ms && mst;
  });

  const stages = ["ALL", "NEW", "ENGAGED", "QUALIFIED", "BOOKING", "CLOSING", "WON", "LOST", "NURTURE"];

  return (
    <div style={{ padding: "clamp(20px,3vw,36px)", maxWidth: "1200px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#e2eaf4", margin: "0 0 6px", letterSpacing: "-0.02em" }}>Active Contacts</h1>
        <p style={{ color: "#2d3d50", margin: 0, fontSize: "13px" }}>
          Contacts tagged <code style={{ background: "rgba(20,184,166,0.1)", color: "#14b8a6", padding: "1px 6px", borderRadius: "4px" }}>ai_enabled</code> in GHL are automatically handed to your AI sales team.
        </p>
      </div>

      {/* Banner */}
      {banner && (
        <div style={{
          padding: "12px 18px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px",
          background: banner.type === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${banner.type === "success" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
          color: banner.type === "success" ? "#22c55e" : "#ef4444",
        }}>
          {banner.msg}
        </div>
      )}

      {/* How it works */}
      <div style={{ background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.15)", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#14b8a6", marginBottom: "6px" }}>⚡ Auto-Activation</div>
        <div style={{ fontSize: "12px", color: "#445566", lineHeight: 1.7 }}>
          Any contact tagged <strong style={{ color: "#14b8a6" }}>ai_enabled</strong> in GoHighLevel will have an AI conversation automatically started via the channels you enabled in <strong style={{ color: "#7c9ab8" }}>Settings → Automation</strong> (SMS and/or Email). You can also activate contacts manually below.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap", alignItems: "center" }}>
        {locations.length > 1 && (
          <select value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.08)", color: "#7c9ab8", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, phone…"
          style={{ padding: "8px 14px", background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "9px", color: "#e2eaf4", fontSize: "13px", fontFamily: "inherit", outline: "none", width: "220px" }} />
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {stages.map(s => (
            <button key={s} onClick={() => setStageFilter(s)} style={{
              padding: "6px 11px", borderRadius: "7px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: stageFilter === s ? `${STAGE_COLORS[s] || "rgba(20,184,166"}22` : "rgba(255,255,255,0.03)",
              border: `1px solid ${stageFilter === s ? (STAGE_COLORS[s] || "#14b8a6") : "rgba(255,255,255,0.07)"}`,
              color: stageFilter === s ? (STAGE_COLORS[s] || "#14b8a6") : "#445566",
            }}>{s}</button>
          ))}
        </div>
        <button onClick={load} style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#445566" }}>
          ↻ Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[
          { label: "Total Contacts", value: contacts.length, color: "#14b8a6" },
          { label: "AI Enabled", value: aiCount, color: "#22c55e" },
          { label: "Already Active", value: contacts.filter(c => c.outboundStarted).length, color: "#a78bfa" },
          { label: "High Score (80+)", value: contacts.filter(c => c.score >= 80).length, color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 18px" }}>
            <div style={{ fontSize: "10px", color: "#445566", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{s.label}</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Contact", "AI Status", "Stage", "Agent", "Score", "Last Activity", "Actions"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 16px", color: "#445566", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: "60px", textAlign: "center", color: "#445566" }}>
                <div style={{ fontSize: "24px", marginBottom: "8px", animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</div>
                <div>Loading contacts & checking activation status…</div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "60px", textAlign: "center", color: "#445566" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>👤</div>
                <div style={{ fontSize: "14px", color: "#7c9ab8", marginBottom: "6px" }}>
                  {contacts.length === 0 ? "No contacts found" : "No contacts match your filter"}
                </div>
                <div style={{ fontSize: "12px", color: "#2d3d50" }}>
                  Tag contacts with <code style={{ background: "rgba(20,184,166,0.1)", color: "#14b8a6", padding: "1px 6px", borderRadius: "3px" }}>ai_enabled</code> in GoHighLevel to activate AI conversations.
                </div>
              </td></tr>
            ) : filtered.map(c => {
              const statusInfo = AI_STATUS[c.aiStatus] || AI_STATUS.off;
              const isActivating = activatingId === c.id;
              return (
                <tr key={c.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}>

                  {/* Contact */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#e2eaf4", fontSize: "13px" }}>{c.name}</div>
                    <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "2px" }}>{c.email || c.phone || "—"}</div>
                  </td>

                  {/* AI Status */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusInfo.dot,
                        animation: c.aiStatus === "activating" ? "pulse 1s infinite" : "none" }} />
                      <span style={{ fontSize: "11px", fontWeight: 600, color: statusInfo.color, background: statusInfo.bg, padding: "2px 8px", borderRadius: "5px" }}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </td>

                  {/* Stage */}
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 9px", borderRadius: "5px", fontSize: "11px", fontWeight: 700, background: `${STAGE_COLORS[c.stage] || "#445566"}22`, color: STAGE_COLORS[c.stage] || "#7c9ab8", border: `1px solid ${STAGE_COLORS[c.stage] || "#445566"}44` }}>
                      {c.stage}
                    </span>
                  </td>

                  {/* Agent */}
                  <td style={{ padding: "12px 16px", color: "#7c9ab8", fontSize: "12px" }}>{c.assignedAgent}</td>

                  {/* Score */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <div style={{ width: "44px", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px" }}>
                        <div style={{ height: "100%", width: `${c.score}%`, borderRadius: "2px", background: c.score >= 80 ? "#22c55e" : c.score >= 50 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                      <span style={{ fontSize: "11px", color: "#7c9ab8" }}>{c.score}</span>
                    </div>
                  </td>

                  {/* Last Activity */}
                  <td style={{ padding: "12px 16px", color: "#2d3d50", fontSize: "11px" }}>
                    {c.lastActivity ? new Date(c.lastActivity).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "12px 16px" }}>
                    {c.outboundStarted ? (
                      <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>✓ Active</span>
                    ) : c.isAIEnabled ? (
                      <button onClick={() => manualActivate(c)} disabled={isActivating} style={{
                        padding: "5px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: 700,
                        cursor: isActivating ? "not-allowed" : "pointer", fontFamily: "inherit",
                        background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.3)",
                        color: "#14b8a6", opacity: isActivating ? 0.6 : 1,
                      }}>
                        {isActivating ? "Starting…" : "⚡ Activate"}
                      </button>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#2d3d50" }}>Tag ai_enabled</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div style={{ textAlign: "center", padding: "12px", color: "#2d3d50", fontSize: "11px" }}>
          {filtered.length} of {contacts.length} contacts shown
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
