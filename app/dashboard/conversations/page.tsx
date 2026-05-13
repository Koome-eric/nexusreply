"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────
type Category = "all" | "active" | "waiting_reply" | "human_needed" | "won" | "new";

interface ThreadMessage {
  id: string;
  body: string;
  direction: string;
  messageType: string;
  dateAdded: string;
  attachments: string[];
  aiLog?: {
    intent?: string | null;
    confidence?: number | null;
    humanTookOver?: boolean;
    agent?: { name: string; role: string; avatar: string } | null;
  } | null;
}

interface Conversation {
  id: string;
  ghlConversationId: string;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  lastMessageAt: string;
  status: string;
  category: "active" | "waiting_reply" | "human_needed" | "won" | "lost" | "new";
  totalMessages: number;
  lead?: {
    stage: string; score: number; outboundStarted: boolean;
    messageCount: number; outboundChannel?: string | null;
    lastReplyAt?: string | null;
    assignedAgent?: { name: string; avatar: string; role: string } | null;
  } | null;
  lastLog?: {
    inputMessage: string; aiResponse: string; messageType: string;
    humanTookOver: boolean; createdAt: string; intent?: string | null;
    agent?: { name: string; avatar: string; role: string } | null;
  } | null;
}

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function formatDate(d: string) {
  const date = new Date(d), today = new Date(), yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function getChannelIcon(type: string) {
  const t = (type || "").toUpperCase();
  if (t === "EMAIL") return "✉️";
  if (t === "SMS") return "💬";
  if (t.includes("INSTAGRAM") || t === "IG") return "📸";
  if (t.includes("FACEBOOK") || t === "FB") return "👤";
  if (t.includes("WHATSAPP")) return "📱";
  return "💬";
}
function getChannelLabel(type: string) {
  const t = (type || "").toUpperCase();
  if (t === "EMAIL") return "Email";
  if (t === "SMS") return "SMS";
  if (t.includes("INSTAGRAM")) return "Instagram";
  if (t.includes("FACEBOOK")) return "Facebook";
  if (t.includes("WHATSAPP")) return "WhatsApp";
  return type || "SMS";
}

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  active:        { label: "Active",        color: "#22c55e", bg: "rgba(34,197,94,0.1)",    icon: "⚡" },
  waiting_reply: { label: "Waiting Reply", color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   icon: "⏳" },
  human_needed:  { label: "Human Needed",  color: "#ef4444", bg: "rgba(239,68,68,0.1)",    icon: "👤" },
  won:           { label: "Won",           color: "#22c55e", bg: "rgba(34,197,94,0.08)",   icon: "🏆" },
  lost:          { label: "Lost",          color: "#445566", bg: "rgba(100,116,139,0.08)", icon: "✗"  },
  new:           { label: "New",           color: "#14b8a6", bg: "rgba(20,184,166,0.1)",   icon: "🆕" },
};
const STAGE_COLORS: Record<string, string> = {
  NEW: "#445566", ENGAGED: "#3b82f6", QUALIFIED: "#a78bfa",
  BOOKING: "#f59e0b", CLOSING: "#ec4899", WON: "#22c55e",
  LOST: "#ef4444", NURTURE: "#14b8a6",
};

// ── Thread View ───────────────────────────────────────────────────
function ThreadView({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [source, setSource] = useState<string>("local");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ghlConversationId: conv.ghlConversationId, locationId: null }),
    })
      .then(r => r.json())
      .then(data => { setThread(data.thread || []); setSource(data.source || "local"); })
      .catch(() => setThread([]))
      .finally(() => { setLoading(false); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 120); });
  }, [conv.ghlConversationId]);

  const meta = CATEGORY_META[conv.category] || CATEGORY_META.active;

  // Group by date
  const grouped: { date: string; messages: ThreadMessage[] }[] = [];
  thread.forEach(msg => {
    const d = formatDate(msg.dateAdded);
    const last = grouped[grouped.length - 1];
    if (last?.date === d) last.messages.push(msg);
    else grouped.push({ date: d, messages: [msg] });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-surface,rgba(10,17,30,0.95))", border: "1px solid var(--bg-border,rgba(255,255,255,0.07))", borderRadius: "16px", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: `${meta.color}18`, border: `1.5px solid ${meta.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 800, color: meta.color, flexShrink: 0 }}>
            {(conv.contactName || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#e2eaf4", marginBottom: "3px" }}>
              {conv.contactName || conv.contactEmail || "Unknown Contact"}
            </div>
            <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
              {conv.contactEmail && <span style={{ fontSize: "11px", color: "#445566" }}>✉ {conv.contactEmail}</span>}
              {conv.contactPhone && <span style={{ fontSize: "11px", color: "#445566" }}>📱 {conv.contactPhone}</span>}
              <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "5px", background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>
              {conv.lead?.stage && <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "5px", background: `${STAGE_COLORS[conv.lead.stage]||"#445566"}20`, color: STAGE_COLORS[conv.lead.stage]||"#7c9ab8" }}>{conv.lead.stage}</span>}
              {source === "ghl" && <span style={{ fontSize: "9px", color: "#22c55e", padding: "1px 5px", borderRadius: "4px", background: "rgba(34,197,94,0.08)" }}>● live from GHL</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
          <a href={`https://app.gohighlevel.com/v2/location/${conv.ghlConversationId}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.08)", color: "#445566", textDecoration: "none", fontSize: "11px", fontWeight: 600 }}>🔗 GHL</a>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#445566", cursor: "pointer", fontSize: "18px", padding: "4px" }}>✕</button>
        </div>
      </div>

      {/* Stats bar */}
      {conv.lead && (
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          {[
            { label: "Score", value: `${conv.lead.score||0}%`, color: (conv.lead.score||0)>=70?"#22c55e":"#f59e0b" },
            { label: "Messages", value: conv.totalMessages, color: "#14b8a6" },
            { label: "Agent", value: conv.lead.assignedAgent ? `${conv.lead.assignedAgent.avatar} ${conv.lead.assignedAgent.name}` : "—", color: "#a78bfa" },
            { label: "Channel", value: conv.lead.outboundChannel ? `${getChannelIcon(conv.lead.outboundChannel)} ${getChannelLabel(conv.lead.outboundChannel)}` : "—", color: "#7c9ab8" },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, padding: "7px 10px", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontSize: "9px", color: "#2d3d50", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>{s.label}</div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: "48px", borderRadius: "12px", background: i%2?"rgba(255,255,255,0.03)":"rgba(20,184,166,0.04)", marginLeft: i%2?"0":"20%", marginRight: i%2?"20%":"0", animation: "pulse 1.5s infinite" }} />)}
          </div>
        ) : thread.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: "28px", marginBottom: "10px" }}>💬</div>
            <div style={{ fontSize: "13px", color: "#445566", fontWeight: 600, marginBottom: "4px" }}>No messages yet</div>
            <div style={{ fontSize: "11px", color: "#2d3d50" }}>Outbound message may have been sent — waiting for the lead to reply.</div>
          </div>
        ) : (
          <>
            {grouped.map(group => (
              <div key={group.date}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "14px 0 10px" }}>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
                  <span style={{ fontSize: "10px", color: "#2d3d50", fontWeight: 600, letterSpacing: "0.05em" }}>{group.date}</span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
                </div>
                {group.messages.map(msg => {
                  const isOut   = msg.direction === "outbound";
                  const isEmail = (msg.messageType||"").toUpperCase() === "EMAIL";
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: isOut ? "row-reverse" : "row", alignItems: "flex-end", gap: "7px", marginBottom: "9px" }}>
                      {/* Avatar */}
                      {!isOut && (
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(68,85,102,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#7c9ab8", flexShrink: 0 }}>
                          {(conv.contactName||"?")[0].toUpperCase()}
                        </div>
                      )}
                      {isOut && msg.aiLog?.agent && (
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(20,184,166,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>
                          {msg.aiLog.agent.avatar||"🤖"}
                        </div>
                      )}

                      <div style={{ maxWidth: "74%", display: "flex", flexDirection: "column", alignItems: isOut ? "flex-end" : "flex-start" }}>
                        {isOut && msg.aiLog?.agent && (
                          <div style={{ fontSize: "10px", color: "#14b8a6", fontWeight: 700, marginBottom: "2px" }}>{msg.aiLog.agent.name}</div>
                        )}
                        <div style={{ padding: isEmail ? "11px 13px" : "9px 13px", borderRadius: isOut ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isOut ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${isOut?"rgba(20,184,166,0.25)":"rgba(255,255,255,0.08)"}`, fontSize: "13px", lineHeight: 1.6, color: isOut ? "#e2eaf4" : "#b0c4d8", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                          {isEmail && (
                            <div style={{ fontSize: "9px", fontWeight: 700, color: isOut ? "#14b8a6" : "#7c9ab8", marginBottom: "5px", letterSpacing: "0.05em" }}>
                              {getChannelIcon(msg.messageType)} EMAIL
                            </div>
                          )}
                          {msg.body}
                          {(msg.attachments||[]).length > 0 && (
                            <div style={{ marginTop: "5px", fontSize: "11px", color: "#445566" }}>📎 {msg.attachments.length} attachment{msg.attachments.length > 1 ? "s" : ""}</div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "5px", alignItems: "center", marginTop: "3px", flexDirection: isOut ? "row-reverse" : "row" }}>
                          <span style={{ fontSize: "10px", color: "#2d3d50" }}>{formatTime(msg.dateAdded)}</span>
                          {!isEmail && <span style={{ fontSize: "9px", color: "#2d3d50" }}>{getChannelIcon(msg.messageType)} {getChannelLabel(msg.messageType)}</span>}
                          {msg.aiLog?.intent && <span style={{ fontSize: "9px", color: "#3b82f6", background: "rgba(59,130,246,0.08)", padding: "1px 5px", borderRadius: "4px" }}>{msg.aiLog.intent.replace(/_/g," ")}</span>}
                          {msg.aiLog?.humanTookOver && <span style={{ fontSize: "9px", color: "#ef4444" }}>⚠ human review</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {conv.lastLog?.humanTookOver && (
        <div style={{ padding: "9px 16px", flexShrink: 0, borderTop: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>⚠️</span>
          <div style={{ fontSize: "12px", color: "#ef4444" }}><strong>Human review needed.</strong> AI confidence was low — check this conversation in GoHighLevel.</div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counts, setCounts]   = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [filter, setFilter]   = useState<Category>("all");
  const [search, setSearch]   = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations?sync=false");
      const data = await res.json();
      setConversations(data.conversations || []);
      setCounts(data.counts || {});
    } finally { setLoading(false); }
  }, []);

  const syncFromGHL = async () => {
    setSyncing(true);
    try { await fetch("/api/conversations?sync=true"); await load(); }
    finally { setSyncing(false); }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const filtered = conversations.filter(c => {
    const matchCat    = filter === "all" || c.category === filter;
    const matchSearch = !search || [c.contactName, c.contactEmail, c.contactPhone]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const FILTERS: { key: Category; label: string; icon: string }[] = [
    { key: "all",           label: `All (${counts.all||0})`,                  icon: "💬" },
    { key: "active",        label: `Active (${counts.active||0})`,             icon: "⚡" },
    { key: "waiting_reply", label: `Waiting (${counts.waiting_reply||0})`,     icon: "⏳" },
    { key: "human_needed",  label: `Human (${counts.human_needed||0})`,        icon: "👤" },
    { key: "new",           label: `New (${counts.new||0})`,                   icon: "🆕" },
    { key: "won",           label: `Won (${counts.won||0})`,                   icon: "🏆" },
  ];

  return (
    <div style={{ padding: "24px 28px", height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", flexWrap: "wrap", gap: "12px", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: "clamp(20px,3vw,24px)", fontWeight: 800, color: "var(--text-primary,#e2eaf4)", margin: "0 0 3px", letterSpacing: "-0.02em" }}>Conversations</h1>
          <p style={{ color: "var(--text-muted,#445566)", margin: 0, fontSize: "12px" }}>Live AI conversations — inbound &amp; outbound, SMS &amp; email. Auto-refreshes every 30s.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…"
            style={{ padding: "8px 13px", background: "var(--bg-surface,rgba(10,17,30,0.9))", border: "1px solid var(--bg-border,rgba(255,255,255,0.08))", borderRadius: "9px", color: "var(--text-primary,#e2eaf4)", fontSize: "13px", fontFamily: "inherit", outline: "none", width: "190px" }} />
          <button onClick={syncFromGHL} disabled={syncing} style={{ padding: "8px 14px", borderRadius: "9px", border: "1px solid var(--bg-border,rgba(255,255,255,0.08))", background: syncing ? "rgba(255,255,255,0.04)" : "rgba(20,184,166,0.1)", color: syncing ? "#445566" : "#14b8a6", fontWeight: 700, fontSize: "12px", cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {syncing ? "⟳ Syncing…" : "⟳ Sync GHL"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap", flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "6px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: filter===f.key?"rgba(20,184,166,0.12)":"rgba(255,255,255,0.03)", border: `1px solid ${filter===f.key?"rgba(20,184,166,0.4)":"rgba(255,255,255,0.07)"}`, color: filter===f.key?"#14b8a6":"#445566" }}>
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "320px 1fr" : "1fr", gap: "14px", flex: 1, minHeight: 0 }}>

        {/* List */}
        <div style={{ background: "var(--bg-surface,rgba(10,17,30,0.9))", border: "1px solid var(--bg-border,rgba(255,255,255,0.07))", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: "68px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>💬</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#7c9ab8", marginBottom: "5px" }}>
                {conversations.length === 0 ? "No conversations yet" : `No ${filter==="all"?"":filter.replace("_"," ")} conversations`}
              </div>
              <div style={{ fontSize: "11px", color: "#2d3d50" }}>
                {conversations.length === 0 ? "Click \"Sync GHL\" to pull conversations from GoHighLevel." : "Try a different filter."}
              </div>
            </div>
          ) : (
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filtered.map((conv, i) => {
                const meta = CATEGORY_META[conv.category] || CATEGORY_META.active;
                const isSel = selected?.id === conv.id;
                const channel = conv.lead?.outboundChannel || conv.lastLog?.messageType || "SMS";
                return (
                  <div key={conv.id} onClick={() => setSelected(isSel ? null : conv)}
                    style={{ padding: "12px 15px", borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", cursor: "pointer", transition: "background 0.12s", background: isSel?"rgba(20,184,166,0.07)":"transparent", borderLeft: isSel?"2px solid #14b8a6":"2px solid transparent" }}
                    onMouseEnter={e => { if(!isSel)(e.currentTarget as HTMLDivElement).style.background="rgba(255,255,255,0.02)"; }}
                    onMouseLeave={e => { if(!isSel)(e.currentTarget as HTMLDivElement).style.background="transparent"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "5px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: `${meta.color}18`, border: `1px solid ${meta.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0, fontWeight: 700, color: meta.color }}>
                          {(conv.contactName||"?")[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: isSel?"#14b8a6":"#e2eaf4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {conv.contactName||conv.contactEmail||"Unknown"}
                          </div>
                          <div style={{ fontSize: "10px", color: "#2d3d50" }}>{conv.contactPhone||conv.contactEmail||"—"}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px", flexShrink: 0, marginLeft: "8px" }}>
                        <span style={{ fontSize: "10px", color: "#2d3d50" }}>{timeAgo(conv.lastMessageAt)}</span>
                        <span style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 700, background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>
                      </div>
                    </div>
                    {conv.lastLog && (
                      <div style={{ fontSize: "11px", color: "#445566", marginLeft: "38px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conv.lastLog.humanTookOver?"👤 ":"🤖 "}{conv.lastLog.aiResponse.slice(0,62)}…
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "4px", marginLeft: "38px", marginTop: "4px", flexWrap: "wrap" }}>
                      {conv.lead?.stage && <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: `${STAGE_COLORS[conv.lead.stage]||"#445566"}20`, color: STAGE_COLORS[conv.lead.stage]||"#7c9ab8" }}>{conv.lead.stage}</span>}
                      <span style={{ fontSize: "9px", color: "#2d3d50", padding: "1px 5px", borderRadius: "4px", background: "rgba(255,255,255,0.04)" }}>{getChannelIcon(channel)} {getChannelLabel(channel)}</span>
                      {conv.lead?.assignedAgent && <span style={{ fontSize: "9px", color: "#7c9ab8", padding: "1px 5px", borderRadius: "4px", background: "rgba(255,255,255,0.04)" }}>{conv.lead.assignedAgent.avatar} {conv.lead.assignedAgent.name}</span>}
                      {conv.totalMessages > 0 && <span style={{ fontSize: "9px", color: "#2d3d50" }}>{conv.totalMessages} msgs</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Thread */}
        {selected && (
          <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            <ThreadView conv={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.9}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px}`}</style>
    </div>
  );
}
