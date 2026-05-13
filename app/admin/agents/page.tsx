"use client";

import { useState, useEffect } from "react";

const ROLES = ["SDR", "SETTER", "CLOSER", "FOLLOWUP", "CUSTOM"];

const ROLE_META: Record<string, { icon: string; label: string; desc: string; color: string }> = {
  SDR:      { icon: "🤝", label: "Lead Qualifier",       desc: "Handles new & early-stage leads. Qualifies, builds rapport, never discusses pricing.", color: "#14b8a6" },
  SETTER:   { icon: "📅", label: "Appointment Setter",   desc: "Takes qualified leads and books calls. Handles light objections.", color: "#f59e0b" },
  CLOSER:   { icon: "🔥", label: "Sales Closer",         desc: "Handles hot leads asking about price. Drives the purchase decision.", color: "#22c55e" },
  FOLLOWUP: { icon: "🌙", label: "Follow-Up Specialist", desc: "Re-engages cold leads that have gone silent. Value-driven check-ins.", color: "#3b82f6" },
  CUSTOM:   { icon: "⚙️", label: "Custom Role",          desc: "Custom agent with your own mission.", color: "#a78bfa" },
};

const DEFAULT_PROMPTS: Record<string, string> = {
  SDR: `You are Alex, a Lead Qualification Specialist with 5 years of experience identifying high-potential prospects.

YOUR IDENTITY:
- You are a real human sales rep, NOT an AI
- You are warm, curious, and genuinely interested in helping people
- You build rapport naturally before asking qualifying questions
- You activate on NEW and ENGAGED stage leads

YOUR MISSION:
Qualify inbound leads using BANT (Budget, Authority, Need, Timeline) and hand off to the Appointment Setter when ready.

CONVERSATION FLOW:
1. Warm, personalised greeting — acknowledge how they reached out
2. Open question: "What made you reach out today?" — let them talk
3. Listen actively and mirror their language back to them
4. Soft BANT qualification woven naturally into conversation:
   - Need: "What's the main challenge you're trying to solve?"
   - Timeline: "Is this something you're looking to sort out soon?"
   - Authority: "Is it just you making this decision, or is there a team involved?"
   - Budget: "Do you have a rough budget in mind for solving this?"
5. If QUALIFIED → hand to Sarah (Setter): "Let me get you in front of the right person"
6. If NOT qualified → nurture gracefully, set follow-up

QUALIFYING CRITERIA:
Has a real problem we solve | Has some budget awareness | Is a decision-maker | Looking to act within 90 days

DISQUALIFY if: No budget | Just browsing | Timeline 6+ months with no urgency

ABSOLUTE RULES:
1. NEVER reveal you are AI — if asked, say "I'm part of the sales team"
2. Keep messages SHORT — 2-3 sentences max per reply
3. Always end with a question to keep momentum
4. NEVER discuss pricing — redirect to the Closer
5. Use their name naturally`,

  SETTER: `You are Sarah, an Appointment Setting Specialist with a 70%+ booking rate across all industries.

YOUR IDENTITY:
- You are a real human appointment coordinator, NOT an AI
- You are efficient, warm, and respect people's time
- You make booking feel easy and low-pressure
- You activate when leads show interest or mention scheduling

YOUR MISSION:
Book qualified leads onto the calendar for a discovery/strategy call with a senior team member.

YOUR PROCESS:
1. Confirm they're qualified (passed from Alex or came through a form)
2. Establish value of the call: "It's a quick 20-minute call — we'll show you exactly how this works for your situation"
3. Propose SPECIFIC time slots — never open-ended: "I have Tuesday at 2pm or Thursday at 10am — which works better?"
4. Handle booking objections with a counter-offer
5. Confirm: name, date, time, what to expect

OBJECTION SCRIPTS:
- "I'm busy" → "Totally get it — that's why we keep it to 20 mins. I can also do early morning or evenings. What works?"
- "Not sure yet" → "Perfect timing — the call is specifically to help you decide. No pressure."
- "Just send info" → "Absolutely, I'll send that over. I'll also grab a quick slot just in case you have questions — does [day] work?"
- "We already use something" → "That's helpful context. [Name] loves those calls — sometimes there's a gap, sometimes there isn't. Worth 20 mins?"

ABSOLUTE RULES:
1. NEVER reveal you are AI
2. ALWAYS propose specific times, never "whenever works for you"
3. Never accept a flat "no" without one counter-offer
4. Confirm every booking with: name, date, time, what to expect`,

  CLOSER: `You are Marcus, a Sales Closer with 20 years closing high-ticket deals across SaaS, services, and coaching.

YOUR IDENTITY:
- You are a real human senior sales professional, NOT an AI
- You are confident, calm, direct, and genuinely want to help
- You activate on leads with price_inquiry or buying_signal intents

YOUR MISSION:
Convert warm, interested leads into paying clients. You are the last step before the sale.

CLOSING TECHNIQUES:
1. Assumptive: "So when would you like to get started?"
2. Summary: Recap their problem + your solution, then ask for decision
3. Alternative: Give 2 options that both lead to yes ("Monthly or quarterly?")
4. Silence: Ask the closing question, then STOP TALKING

OBJECTION HANDLING:
- "Too expensive" → "I hear you. Can I ask — what's the cost of NOT solving this problem over the next 6 months?"
- "Need to think" → "Of course. What's the one thing giving you pause right now?"
- "Need to ask my partner" → "Makes sense. Would it help if I put together a quick summary they could review?"
- "Seen competitors" → "Smart to compare. What are the main things you're evaluating on?"
- "Not the right time" → "I get that. What would need to change for the timing to work?"

PRICING RULES:
- Never drop price without asking what their budget is first
- Always anchor to value before discussing cost
- Offer payment plans before discounts

ABSOLUTE RULES:
1. NEVER reveal you are AI
2. NEVER be desperate, pushy, or needy
3. Sound human — use contractions, ask follow-ups
4. Always end with a clear, specific next step`,

  FOLLOWUP: `You are Luna, a Lead Nurture Specialist who masters the art of re-engaging cold and silent leads.

YOUR IDENTITY:
- You are a real human relationship manager, NOT an AI
- You are patient, empathetic, and never pushy
- You play the long game — relationships over quick wins
- You activate after 24+ hours of lead silence or when stage is NURTURE

YOUR MISSION:
Warm up cold leads, bring silent prospects back into the active pipeline, and create micro-commitments over time.

FOLLOW-UP SEQUENCE:
Day 1 (24h silence): Soft check-in
"Hey [Name], just wanted to circle back — how are things going with [their problem]?"

Day 3: Value add
Share a relevant insight, quick tip, or case study that applies to their situation.

Day 7: Direct but gentle
"Is this still something on your radar? No pressure — just want to make sure I'm not dropping the ball."

Day 14: The break-up message
"I don't want to keep bothering you. If now isn't the right time, I completely understand. If anything changes, I'm here."

WHAT NEVER TO DO:
- Never say "Just following up" — it adds zero value
- Never reference how long ago they last replied
- Never send the same message twice
- Never be passive-aggressive or guilt-trip

ABSOLUTE RULES:
1. NEVER reveal you are AI
2. NEVER be desperate or pushy
3. Shorter is always better — respect their inbox
4. If they say stop, stop immediately and professionally
5. Add value in every single touchpoint`,
};

interface GlobalAgent {
  id: string; name: string; role: string; avatar: string;
  description?: string; systemPrompt: string; tone: string;
  version: number; isActive: boolean; performanceScore?: number; trainingNotes?: string;
}

const TA: React.CSSProperties = {
  width: "100%", background: "#060b12", border: "1px solid rgba(236,72,153,0.15)",
  borderRadius: "10px", padding: "12px 14px", color: "#e2eaf4", fontSize: "13px",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  resize: "vertical" as const, lineHeight: 1.65,
};
const INP: React.CSSProperties = { ...TA, resize: "none" as const, minHeight: "unset" };

function AgentCard({ agent, meta, isActive, deleting, onSelect, onDelete }: {
  agent: GlobalAgent; meta: { icon: string; label: string; desc: string; color: string };
  isActive: boolean; deleting: boolean; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{
        padding: "12px 14px", borderRadius: "12px",
        border: `1px solid ${isActive ? "rgba(236,72,153,0.4)" : "rgba(255,255,255,0.06)"}`,
        background: isActive ? "rgba(236,72,153,0.07)" : "rgba(10,17,30,0.8)",
        transition: "all 0.15s",
      }}>
        {/* Top row */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", cursor: "pointer", marginBottom: "10px" }} onClick={onSelect}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
            background: `${meta.color}18`, border: `1px solid ${meta.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
          }}>
            {agent.avatar || meta.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: isActive ? "#ec4899" : "#e2eaf4" }}>{agent.name}</span>
              <span style={{ fontSize: "9px", color: meta.color, background: `${meta.color}15`, padding: "1px 6px", borderRadius: "4px", fontWeight: 700, textTransform: "uppercase" }}>{agent.role}</span>
              <span style={{ fontSize: "9px", color: "#2d3d50" }}>v{agent.version}</span>
              {!agent.isActive && <span style={{ fontSize: "9px", color: "#445566", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: "4px" }}>INACTIVE</span>}
            </div>
            <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.desc}</div>
          </div>
          {agent.performanceScore != null && (
            <div style={{ fontSize: "12px", fontWeight: 800, color: agent.performanceScore >= 80 ? "#22c55e" : "#f59e0b", flexShrink: 0 }}>{agent.performanceScore}%</div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={onSelect} style={{
            flex: 1, padding: "6px", borderRadius: "7px", fontSize: "11px", fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
            background: isActive ? "rgba(236,72,153,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${isActive ? "rgba(236,72,153,0.25)" : "rgba(255,255,255,0.07)"}`,
            color: isActive ? "#ec4899" : "#7c9ab8",
          }}>
            👁 {isActive ? "Currently Editing" : "View & Edit"}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} disabled={deleting} style={{
            padding: "6px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: 600,
            cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444",
          }}>
            {deleting ? "…" : "🗑 Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<GlobalAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GlobalAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"prompt" | "notes" | "settings">("prompt");

  const reload = async () => {
    const d = await fetch("/api/admin/agents").then(r => r.json());
    setAgents(d.agents || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch("/api/admin/agents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    if (data.success) {
      const updated = { ...editing, version: editing.version + 1 };
      setAgents(prev => prev.map(a => a.id === editing.id ? updated : a));
      setEditing(updated);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Delete this global agent template? This cannot be undone.")) return;
    setDeleting(agentId);
    const res = await fetch("/api/admin/agents", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    const d = await res.json();
    if (d.success) { if (editing?.id === agentId) setEditing(null); await reload(); }
    setDeleting(null);
  };

  const handlePush = async () => {
    if (!editing) return;
    if (!confirm(`Push ${editing.name}'s prompt to ALL users with a default ${editing.role} agent?`)) return;
    setPushing(true);
    const res = await fetch("/api/admin/agents", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: editing.id }),
    });
    const d = await res.json();
    if (d.success) { setPushResult(`✅ Pushed to ${d.usersUpdated} agents`); setTimeout(() => setPushResult(null), 4000); }
    setPushing(false);
  };

  const handleCreate = async (role: string) => {
    const names: Record<string, string> = { SDR: "Alex", SETTER: "Sarah", CLOSER: "Marcus", FOLLOWUP: "Luna" };
    const avatars: Record<string, string> = { SDR: "🤝", SETTER: "📅", CLOSER: "🔥", FOLLOWUP: "🌙" };
    const res = await fetch("/api/admin/agents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: names[role] || "New Agent", role,
        avatar: avatars[role] || "⚙️",
        systemPrompt: DEFAULT_PROMPTS[role] || "",
        tone: "friendly", version: 1, isActive: true,
        description: ROLE_META[role]?.desc || "",
      }),
    });
    const data = await res.json();
    if (data.agent || data.success) { await reload(); }
  };

  const loadDefaultPrompt = (role: string) => {
    if (!editing || !DEFAULT_PROMPTS[role]) return;
    if (editing.systemPrompt.trim() && !confirm("Replace current prompt with the default template?")) return;
    setEditing({ ...editing, systemPrompt: DEFAULT_PROMPTS[role] });
  };

  const defaultRoles = ["SDR", "SETTER", "CLOSER", "FOLLOWUP"];
  const defaultAgents = agents.filter(a => defaultRoles.includes(a.role));
  const customAgents = agents.filter(a => !defaultRoles.includes(a.role));

  return (
    <div style={{ padding: "clamp(16px,3vw,32px)", display: "grid", gridTemplateColumns: editing ? "300px 1fr" : "1fr", gap: "20px", minHeight: "100%", alignItems: "start" }}>

      {/* ── LEFT: List ── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Agent Training</h1>
            <p style={{ color: "#445566", fontSize: "12px", margin: 0 }}>Train & deploy global agent templates across all users.</p>
          </div>
          <button onClick={() => handleCreate("CUSTOM")} style={{
            padding: "8px 14px", borderRadius: "8px", border: "none",
            background: "linear-gradient(135deg,#be185d,#ec4899)", color: "white",
            fontWeight: 700, fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
          }}>+ New Agent</button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: "90px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />)}
          </div>
        ) : (
          <>
            {/* Default agents section */}
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#ec4899", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
              Your 4 Default Agents
            </div>

            {defaultRoles.map(role => {
              const meta = ROLE_META[role];
              const existing = agents.find(a => a.role === role);
              if (!existing) {
                // Seed card
                return (
                  <div key={role} style={{ marginBottom: "8px", padding: "12px 14px", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.01)" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span style={{ fontSize: "22px", opacity: 0.4 }}>{meta.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", color: "#445566", fontWeight: 600 }}>
                          {role === "SDR" ? "Alex" : role === "SETTER" ? "Sarah" : role === "CLOSER" ? "Marcus" : "Luna"} — {meta.label}
                        </div>
                        <div style={{ fontSize: "11px", color: "#2d3d50" }}>Not created yet — click to seed with default prompt</div>
                      </div>
                      <button onClick={() => handleCreate(role)} style={{
                        padding: "5px 12px", borderRadius: "7px", border: "1px solid rgba(236,72,153,0.3)",
                        background: "transparent", color: "#ec4899", fontSize: "11px", fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                      }}>Create</button>
                    </div>
                  </div>
                );
              }
              return (
                <AgentCard key={existing.id} agent={existing} meta={meta}
                  isActive={editing?.id === existing.id} deleting={deleting === existing.id}
                  onSelect={() => { setEditing(existing); setActiveTab("prompt"); setSaved(false); }}
                  onDelete={() => handleDelete(existing.id)} />
              );
            })}

            {/* Custom agents */}
            {customAgents.length > 0 && (
              <>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#445566", letterSpacing: "0.1em", textTransform: "uppercase", margin: "20px 0 10px" }}>
                  Custom Agents
                </div>
                {customAgents.map(agent => (
                  <AgentCard key={agent.id} agent={agent} meta={ROLE_META[agent.role] || ROLE_META.CUSTOM}
                    isActive={editing?.id === agent.id} deleting={deleting === agent.id}
                    onSelect={() => { setEditing(agent); setActiveTab("prompt"); setSaved(false); }}
                    onDelete={() => handleDelete(agent.id)} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* ── RIGHT: Editor ── */}
      {editing && (
        <div style={{ background: "rgba(6,11,18,0.98)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column", gap: "0", position: "sticky", top: "20px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "28px" }}>{editing.avatar}</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#e2eaf4", margin: 0 }}>{editing.name}</h2>
                  <span style={{ fontSize: "10px", color: "#ec4899", background: "rgba(236,72,153,0.1)", padding: "2px 7px", borderRadius: "4px", fontWeight: 700 }}>v{editing.version}</span>
                  <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700, background: editing.isActive ? "rgba(34,197,94,0.1)" : "rgba(100,100,100,0.08)", color: editing.isActive ? "#22c55e" : "#445566" }}>
                    {editing.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "3px" }}>{ROLE_META[editing.role]?.label} · {ROLE_META[editing.role]?.desc}</div>
              </div>
            </div>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: "#445566", cursor: "pointer", fontSize: "18px" }}>✕</button>
          </div>

          {/* Quick fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px", gap: "10px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Name</label>
              <input style={INP} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Role</label>
              <select style={{ ...INP, cursor: "pointer" }} value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Avatar</label>
              <input style={{ ...INP, textAlign: "center", fontSize: "20px" }} value={editing.avatar} onChange={e => setEditing({ ...editing, avatar: e.target.value })} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "3px", marginBottom: "14px", background: "rgba(0,0,0,0.4)", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
            {(["prompt", "notes", "settings"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "6px 14px", borderRadius: "7px", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: "12px", fontWeight: activeTab === tab ? 700 : 400,
                background: activeTab === tab ? "rgba(236,72,153,0.15)" : "transparent",
                color: activeTab === tab ? "#ec4899" : "#445566", textTransform: "capitalize",
              }}>{tab}</button>
            ))}
          </div>

          {/* PROMPT */}
          {activeTab === "prompt" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#445566", textTransform: "uppercase", letterSpacing: "0.07em" }}>System Prompt (Agent Brain)</label>
                {DEFAULT_PROMPTS[editing.role] && (
                  <button onClick={() => loadDefaultPrompt(editing.role)} style={{
                    fontSize: "11px", color: "#ec4899", background: "rgba(236,72,153,0.08)",
                    border: "1px solid rgba(236,72,153,0.2)", borderRadius: "6px",
                    padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                  }}>
                    ↺ Load {ROLE_META[editing.role]?.icon} Default Template
                  </button>
                )}
              </div>
              <textarea style={{ ...TA, minHeight: "340px" }}
                value={editing.systemPrompt}
                onChange={e => setEditing({ ...editing, systemPrompt: e.target.value })}
                placeholder="Write this agent's complete identity, mission, rules, and techniques..."
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "11px", color: "#2d3d50", lineHeight: 1.5 }}>
                  💡 Include exact phrases, objection scripts, and do-not-say rules.
                </div>
                <span style={{ fontSize: "10px", color: "#2d3d50", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "5px", padding: "3px 8px" }}>
                  {editing.systemPrompt.length.toLocaleString()} chars
                </span>
              </div>
            </div>
          )}

          {/* NOTES */}
          {activeTab === "notes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Training Notes (Internal)</label>
                <textarea style={{ ...TA, minHeight: "200px" }}
                  value={editing.trainingNotes || ""}
                  onChange={e => setEditing({ ...editing, trainingNotes: e.target.value })}
                  placeholder="What changed in this version, A/B test results, observations..."
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Performance Score (0–100)</label>
                <input type="number" min={0} max={100} style={INP}
                  value={editing.performanceScore || ""}
                  onChange={e => setEditing({ ...editing, performanceScore: parseFloat(e.target.value) || undefined })}
                  placeholder="e.g. 87" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Description (visible to users)</label>
                <input style={INP} value={editing.description || ""}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  placeholder="e.g. Handles new leads, qualifies budget and need" />
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Tone</label>
                <select style={{ ...INP, cursor: "pointer" }} value={editing.tone} onChange={e => setEditing({ ...editing, tone: e.target.value })}>
                  {["friendly","professional","luxury","casual","aggressive","consultative","empathetic"].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#e2eaf4" }}>Active</div>
                  <div style={{ fontSize: "11px", color: "#2d3d50" }}>Inactive agents won't be offered to new users</div>
                </div>
                <button onClick={() => setEditing({ ...editing, isActive: !editing.isActive })} style={{
                  width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                  background: editing.isActive ? "#14b8a6" : "rgba(255,255,255,0.1)", position: "relative",
                }}>
                  <div style={{ position: "absolute", top: "3px", left: editing.isActive ? "22px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                </button>
              </div>

              {/* CSV Upload */}
              <div style={{ padding: "14px", background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.15)", borderRadius: "11px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#14b8a6", marginBottom: "6px" }}>📂 CSV Training Upload</div>
                <div style={{ fontSize: "11px", color: "#445566", marginBottom: "10px", lineHeight: 1.6 }}>
                  Columns: <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>question,answer</code> or <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>objection,response</code>
                </div>
                <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                  <a href="/templates/agent-training-faq.csv" download style={{ fontSize: "10px", color: "#14b8a6", textDecoration: "none", background: "rgba(20,184,166,0.1)", padding: "4px 9px", borderRadius: "5px", border: "1px solid rgba(20,184,166,0.2)" }}>↓ FAQ Template</a>
                  <a href="/templates/agent-training-objections.csv" download style={{ fontSize: "10px", color: "#14b8a6", textDecoration: "none", background: "rgba(20,184,166,0.1)", padding: "4px 9px", borderRadius: "5px", border: "1px solid rgba(20,184,166,0.2)" }}>↓ Objections Template</a>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input type="file" accept=".csv" id="csv-upload" style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !editing) return;
                      const fd = new FormData();
                      fd.append("file", file); fd.append("agentId", editing.id); fd.append("mode", "append");
                      const res = await fetch("/api/admin/agents/upload", { method: "POST", body: fd });
                      const data = await res.json();
                      if (data.success) { alert(`✅ Imported! ${data.faqsAdded} FAQs, ${data.objectionsAdded} objections. Now v${data.newVersion}.`); reload(); }
                      else alert("❌ " + data.error);
                      e.target.value = "";
                    }}
                  />
                  <label htmlFor="csv-upload" style={{ padding: "6px 14px", background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", borderRadius: "7px", color: "#14b8a6", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                    Upload CSV
                  </label>
                  <span style={{ fontSize: "10px", color: "#2d3d50" }}>Appends to prompt</span>
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "rgba(236,72,153,0.04)", border: "1px solid rgba(236,72,153,0.12)", borderRadius: "10px" }}>
                <div style={{ fontSize: "11px", color: "#ec4899", fontWeight: 700, marginBottom: "3px" }}>⚠️ Global Template</div>
                <div style={{ fontSize: "11px", color: "#445566" }}>Save updates the template. Use "Push to All Users" to propagate to existing user agents of this role.</div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, minWidth: "130px", padding: "11px", borderRadius: "10px", border: "none",
              background: saved ? "rgba(34,197,94,0.12)" : "linear-gradient(135deg,#be185d,#ec4899)",
              color: saved ? "#22c55e" : "white", fontWeight: 700, fontSize: "13px",
              cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1,
              outline: saved ? "1px solid rgba(34,197,94,0.3)" : "none",
            }}>
              {saving ? "Saving…" : saved ? `✓ Saved (v${editing.version})` : "💾 Save & Deploy"}
            </button>
            <button onClick={handlePush} disabled={pushing} style={{
              flex: 1, minWidth: "90px", padding: "11px", borderRadius: "10px",
              border: "1px solid rgba(236,72,153,0.25)", background: "transparent",
              color: pushResult ? "#22c55e" : "#ec4899", fontWeight: 700, fontSize: "11px",
              cursor: pushing ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: pushing ? 0.6 : 1,
            }}>
              {pushing ? "…" : pushResult || "📡 Push to All Users"}
            </button>
            <button onClick={() => handleDelete(editing.id)} disabled={deleting === editing.id} style={{
              padding: "11px 14px", borderRadius: "10px",
              border: "1px solid rgba(239,68,68,0.2)", background: "transparent",
              color: "#ef4444", fontWeight: 700, fontSize: "11px", cursor: "pointer", fontFamily: "inherit",
            }}>
              {deleting === editing.id ? "…" : "🗑"}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }`}</style>
    </div>
  );
}
