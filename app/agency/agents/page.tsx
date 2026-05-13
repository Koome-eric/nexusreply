"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const ROLES = [
  { value: "SDR", label: "Lead Qualifier (SDR)", icon: "🤝", desc: "Engages cold leads, builds rapport, qualifies" },
  { value: "SETTER", label: "Appointment Setter", icon: "📅", desc: "Books calls and meetings with warm leads" },
  { value: "CLOSER", label: "Sales Closer", icon: "🔥", desc: "Handles pricing, objections, drives purchase" },
  { value: "FOLLOWUP", label: "Follow-Up / Nurture", icon: "🌙", desc: "Re-engages cold leads, keeps pipeline warm" },
  { value: "CUSTOM", label: "Custom Role", icon: "⚙️", desc: "Define your own role and mission" },
];

const TONES = ["friendly", "professional", "luxury", "casual", "aggressive", "consultative"];

const PIPELINE_STAGES = ["NEW", "ENGAGED", "QUALIFIED", "BOOKING", "CLOSING", "WON", "LOST", "NURTURE"];

const INTENT_OPTIONS = [
  "greeting", "question", "buying_signal", "price_inquiry",
  "scheduling", "objection", "complaint", "general",
];

interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  systemPrompt: string;
  tone: string;
  isActive: boolean;
  order: number;
  triggerIntents: string[];
  triggerStages: string[];
  triggerKeywords: string[];
  _count?: { assignedLeads: number; messageLogs: number };
}

interface Location { id: string; name: string }

function AgentsContent() {
  const params = useSearchParams();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocId, setSelectedLocId] = useState(params.get("locationId") || "");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const MAX_AGENTS = 6; // Agency cap

  const emptyAgent = (): Partial<Agent> => ({
    name: "", role: "SDR", avatar: "🤖", systemPrompt: "", tone: "friendly",
    isActive: true, order: agents.length, triggerIntents: [], triggerStages: [], triggerKeywords: [],
  });

  const [form, setForm] = useState<Partial<Agent>>(emptyAgent());
  const [keywordInput, setKeywordInput] = useState("");

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
    fetch(`/api/agents?locationId=${selectedLocId}`).then(r => r.json()).then(d => {
      setAgents(d.agents || []);
      setLoading(false);
    });
  }, [selectedLocId]);

  const openNew = () => { setForm(emptyAgent()); setEditing(null); setShowForm(true); };
  const openEdit = (agent: Agent) => { setForm({ ...agent }); setEditing(agent); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name || !form.systemPrompt) { alert("Name and prompt are required."); return; }
    setSaving(true);
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id: editing?.id, locationId: selectedLocId }),
    });
    setSaving(false);
    setShowForm(false);
    fetch(`/api/agents?locationId=${selectedLocId}`).then(r => r.json()).then(d => setAgents(d.agents || []));
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Delete this agent? Leads assigned to it will lose their agent assignment.")) return;
    setDeleting(agentId);
    await fetch("/api/agents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    setAgents(agents.filter(a => a.id !== agentId));
    setDeleting(null);
  };

  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    setForm(f => ({ ...f, triggerKeywords: [...(f.triggerKeywords || []), keywordInput.toLowerCase().trim()] }));
    setKeywordInput("");
  };

  const toggleArrayItem = (field: "triggerIntents" | "triggerStages", value: string) => {
    setForm(f => {
      const arr = f[field] || [];
      return { ...f, [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] };
    });
  };

  const autoFillPrompt = () => {
    const role = ROLES.find(r => r.value === form.role);
    const templates: Record<string, string> = {
      SDR: `You are ${form.name || "Alex"}, a friendly sales development representative.\n\nYOUR MISSION: Engage cold leads, build rapport, and qualify them.\n\nRULES:\n- Ask ONE qualifying question at a time\n- Never discuss pricing\n- Keep messages SHORT and conversational\n- Sound like a real human`,
      SETTER: `You are ${form.name || "Sarah"}, a professional appointment setter.\n\nYOUR MISSION: Convert qualified leads into booked calls.\n\nRULES:\n- Push toward a specific booking action\n- Offer specific times: "I have Tuesday 2pm or Thursday 10am"\n- Create gentle urgency`,
      CLOSER: `You are ${form.name || "Marcus"}, a confident sales closer.\n\nYOUR MISSION: Handle pricing questions and drive purchase decisions.\n\nRULES:\n- Lead with VALUE before price\n- Handle objections with empathy\n- Close clearly: "Based on everything, [Plan] sounds like the right fit — want to get started?"`,
      FOLLOWUP: `You are ${form.name || "Luna"}, a warm follow-up specialist.\n\nYOUR MISSION: Re-engage cold leads.\n\nRULES:\n- Be casual, short, and non-pushy\n- Provide value in every message\n- Never guilt-trip for not responding`,
    };
    if (templates[form.role || "SDR"]) {
      setForm(f => ({ ...f, systemPrompt: templates[f.role || "SDR"] }));
    }
  };

  const IS: React.CSSProperties = { width: "100%", background: "#0d1525", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "9px", padding: "11px 14px", color: "#e2eaf4", fontSize: "14px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color 0.2s" };

  if (!selectedLocId && locations.length === 0) {
    return (
      <div style={{ padding: "40px", maxWidth: "600px" }}>
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "48px", textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "14px" }}>🤖</div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>No locations connected</h2>
          <p style={{ color: "#7c9ab8", fontSize: "14px", marginBottom: "20px" }}>Connect a GoHighLevel account first to build your AI sales team.</p>
          <a href="/agency/locations"><button style={{ padding: "11px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Connect GHL →</button></a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(20px,4vw,40px)", maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "5px" }}>AI Sales Team</h1>
          <p style={{ color: "#7c9ab8", fontSize: "14px" }}>Build and train your AI agents. Each agent plays a specific role in closing your leads.</p>
        </div>
        <button onClick={openNew} style={{ padding: "11px 22px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontWeight: 700, fontSize: "14px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(20,184,166,0.3)", whiteSpace: "nowrap" }}>
          + New Agent
        </button>
      </div>

      {/* Location selector */}
      {locations.length > 1 && (
        <div style={{ marginBottom: "22px" }}>
          <select style={{ ...IS, maxWidth: "320px" }} value={selectedLocId} onChange={e => setSelectedLocId(e.target.value)}
            onFocus={(e) => (e.target as HTMLSelectElement).style.borderColor = "#14b8a6"}
            onBlur={(e) => (e.target as HTMLSelectElement).style.borderColor = "rgba(20,184,166,0.2)"}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      {/* Pipeline flow visual */}
      {!loading && agents.length > 0 && (
        <div style={{ marginBottom: "28px", background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px 22px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#445566", letterSpacing: "0.05em", marginBottom: "14px" }}>YOUR SALES PIPELINE FLOW</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
            {agents.filter(a => a.isActive).sort((a, b) => a.order - b.order).map((agent, i, arr) => (
              <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <div style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "10px", padding: "10px 16px", textAlign: "center", minWidth: "100px" }}>
                  <div style={{ fontSize: "22px", marginBottom: "4px" }}>{agent.avatar}</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#e2eaf4" }}>{agent.name}</div>
                  <div style={{ fontSize: "10px", color: "#14b8a6" }}>{agent.role}</div>
                </div>
                {i < arr.length - 1 && <div style={{ color: "#445566", fontSize: "18px" }}>→</div>}
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <div style={{ color: "#445566", fontSize: "18px" }}>→</div>
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "10px", padding: "10px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", marginBottom: "4px" }}>💰</div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e" }}>SALE</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agents grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "14px" }}>
          {[1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height: "200px", borderRadius: "14px" }} />)}
        </div>
      ) : agents.length === 0 ? (
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "56px", textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "14px" }}>👥</div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>No agents yet</h3>
          <p style={{ color: "#7c9ab8", fontSize: "14px", marginBottom: "22px" }}>Create your first AI agent to start automating your sales pipeline.</p>
          <button onClick={openNew} style={{ padding: "11px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Create First Agent</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "14px" }}>
          {agents.map(agent => (
            <div key={agent.id} style={{ background: "rgba(13,21,37,0.9)", border: `1px solid ${agent.isActive ? "rgba(20,184,166,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: "14px", padding: "22px", transition: "all 0.2s", opacity: agent.isActive ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>{agent.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: "#e2eaf4" }}>{agent.name}</div>
                    <div style={{ fontSize: "11px", color: "#14b8a6", fontWeight: 600 }}>{agent.role}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => openEdit(agent)} style={{ padding: "5px 10px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#7c9ab8", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>Edit</button>
                  <button onClick={() => handleDelete(agent.id)} disabled={deleting === agent.id} style={{ padding: "5px 8px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#445566", cursor: "pointer", fontSize: "13px" }}>🗑</button>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "#7c9ab8", lineHeight: 1.55, marginBottom: "14px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {agent.systemPrompt}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "10px", color: "#7c9ab8", background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: "5px" }}>
                  👥 {agent._count?.assignedLeads || 0} leads
                </span>
                <span style={{ fontSize: "10px", color: "#7c9ab8", background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: "5px" }}>
                  💬 {agent._count?.messageLogs || 0} replies
                </span>
                <span style={{ fontSize: "10px", color: agent.isActive ? "#22c55e" : "#445566", background: agent.isActive ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)", padding: "3px 8px", borderRadius: "5px" }}>
                  {agent.isActive ? "● Active" : "● Paused"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ background: "#0d1525", border: "1px solid rgba(20,184,166,0.25)", borderRadius: "18px", padding: "32px", maxWidth: "660px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700 }}>{editing ? "Edit Agent" : "Create New Agent"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#445566", cursor: "pointer", fontSize: "20px" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Name + Avatar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "7px", letterSpacing: "0.05em" }}>AGENT NAME *</label>
                  <input type="text" placeholder='e.g. "Alex" or "Sarah"' value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={IS}
                    onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                    onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "7px", letterSpacing: "0.05em" }}>AVATAR</label>
                  <input type="text" placeholder="🤖" value={form.avatar || ""} onChange={e => setForm(f => ({ ...f, avatar: e.target.value }))} style={{ ...IS, textAlign: "center", fontSize: "22px" }}
                    onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                    onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"} />
                </div>
              </div>

              {/* Role */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "10px", letterSpacing: "0.05em" }}>ROLE</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "8px" }}>
                  {ROLES.map(r => (
                    <button key={r.value} onClick={() => setForm(f => ({ ...f, role: r.value }))}
                      style={{ padding: "10px 12px", borderRadius: "9px", border: `1px solid ${form.role === r.value ? "#14b8a6" : "rgba(255,255,255,0.08)"}`, background: form.role === r.value ? "rgba(20,184,166,0.08)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <div style={{ fontSize: "15px", marginBottom: "3px" }}>{r.icon}</div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: form.role === r.value ? "#14b8a6" : "#e2eaf4" }}>{r.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* System prompt */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#7c9ab8", letterSpacing: "0.05em" }}>AGENT INSTRUCTIONS *</label>
                  <button onClick={autoFillPrompt} style={{ fontSize: "11px", color: "#14b8a6", background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                    Auto-fill template
                  </button>
                </div>
                <textarea value={form.systemPrompt || ""} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                  placeholder="Describe this agent's personality, mission, rules, and how they should handle conversations..."
                  style={{ ...IS, minHeight: "160px", resize: "vertical" as const }}
                  onFocus={(e) => (e.target as HTMLTextAreaElement).style.borderColor = "#14b8a6"}
                  onBlur={(e) => (e.target as HTMLTextAreaElement).style.borderColor = "rgba(20,184,166,0.2)"} />
              </div>

              {/* Trigger intents */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "8px", letterSpacing: "0.05em" }}>ACTIVATE WHEN INTENT IS</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {INTENT_OPTIONS.map(intent => (
                    <button key={intent} onClick={() => toggleArrayItem("triggerIntents", intent)}
                      style={{ padding: "5px 12px", borderRadius: "7px", border: `1px solid ${(form.triggerIntents || []).includes(intent) ? "#14b8a6" : "rgba(255,255,255,0.08)"}`, background: (form.triggerIntents || []).includes(intent) ? "rgba(20,184,166,0.1)" : "transparent", color: (form.triggerIntents || []).includes(intent) ? "#14b8a6" : "#7c9ab8", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                      {intent}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trigger stages */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "8px", letterSpacing: "0.05em" }}>ACTIVATE AT PIPELINE STAGE</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {PIPELINE_STAGES.map(stage => (
                    <button key={stage} onClick={() => toggleArrayItem("triggerStages", stage)}
                      style={{ padding: "5px 12px", borderRadius: "7px", border: `1px solid ${(form.triggerStages || []).includes(stage) ? "#8b5cf6" : "rgba(255,255,255,0.08)"}`, background: (form.triggerStages || []).includes(stage) ? "rgba(139,92,246,0.1)" : "transparent", color: (form.triggerStages || []).includes(stage) ? "#8b5cf6" : "#7c9ab8", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                      {stage}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "8px", letterSpacing: "0.05em" }}>TRIGGER KEYWORDS</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input type="text" placeholder='e.g. "price", "cost", "book"' value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                    style={{ ...IS, flex: 1 }}
                    onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                    onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"} />
                  <button onClick={addKeyword} style={{ padding: "11px 16px", borderRadius: "9px", border: "none", background: "rgba(20,184,166,0.15)", color: "#14b8a6", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" }}>Add</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(form.triggerKeywords || []).map(kw => (
                    <span key={kw} style={{ padding: "4px 10px", borderRadius: "6px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                      {kw}
                      <button onClick={() => setForm(f => ({ ...f, triggerKeywords: (f.triggerKeywords || []).filter(k => k !== kw) }))} style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: "13px", padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#e2eaf4" }}>Agent Active</div>
                  <div style={{ fontSize: "12px", color: "#445566" }}>Inactive agents won&apos;t be assigned to new leads</div>
                </div>
                <button className="toggle-switch" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
                  <div className={`toggle-track ${form.isActive ? "on" : "off"}`}><div className={`toggle-thumb ${form.isActive ? "on" : "off"}`} /></div>
                </button>
              </div>

              {/* Save */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ flex: 1, padding: "13px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontWeight: 700, fontSize: "14px", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.8 : 1 }}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create Agent"}
                </button>
                <button onClick={() => setShowForm(false)} style={{ padding: "13px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#7c9ab8", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function AgentsPage() {
  return <Suspense fallback={<div style={{ padding: "40px", color: "#7c9ab8" }}>Loading...</div>}><AgentsContent /></Suspense>;
}
