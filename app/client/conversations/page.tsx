"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useClientContext } from "../ClientProvider";
import { formatRelativeTime } from "@/lib/utils";

// Types
interface Conversation {
  id: string;
  ghlConversationId: string;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  lastMessageAt: string;
  status: string;
  category?: string;
  lastLog?: {
    inputMessage: string;
    aiResponse: string;
    messageType: string;
    humanTookOver: boolean;
    createdAt: string;
    intent?: string | null;
    agent?: { name: string; avatar: string; role: string } | null;
  } | null;
}

interface GHLMessage {
  id: string;
  body: string;
  direction: "inbound" | "outbound";
  messageType: string;
  dateAdded: string;
  attachments: string[];
  subject?: string;
  from?: string;
  aiLog?: {
    intent?: string | null;
    confidence?: number | null;
    humanTookOver?: boolean;
    agent?: { name: string; role: string; avatar: string } | null;
  } | null;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

function msgPreview(conv: Conversation) {
  if (!conv.lastLog) return "No messages yet";
  const text = conv.lastLog.aiResponse || conv.lastLog.inputMessage || "";
  return text.length > 65 ? text.slice(0, 65) + "…" : text;
}

const TYPE_ICON: Record<string, string> = { EMAIL: "✉", SMS: "💬", CALL: "📞" };

/** Clean message body for display — strips unsubscribe links and excess whitespace */
function cleanDisplayBody(body: string): string {
  return body
    // strip unsubscribe URLs (full markdown-style [text](url) or raw URL)
    .replace(/\[.*?unsubscribe.*?\]\(https?:\/\/[^\)]+\)/gi, "")
    .replace(/https?:\/\/\S*unsubscribe\S*/gi, "")
    // strip tracking pixel URLs
    .replace(/https?:\/\/services\.msgsndr\.com\/\S*/gi, "")
    // strip leftover bracket pairs
    .replace(/\[\s*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Determine sender label for a message */
function senderLabel(msg: GHLMessage, icon: string): string {
  if (msg.direction === "inbound") {
    return icon + " LEAD" + (msg.from ? " · " + msg.from : "");
  }
  // Outbound — check if it was AI or GHL workflow
  if (msg.aiLog?.agent?.name) return `${icon} ${msg.aiLog.agent.name}${msg.aiLog.humanTookOver ? " · HUMAN" : ""}`;
  if (msg.aiLog) return `${icon} AI AGENT`;
  return `${icon} GHL / WORKFLOW`;  // outbound but no aiLog = sent by GHL automation, not our AI
}
const CAT_COLOR: Record<string, string> = {
  active: "#22c55e", waiting_reply: "#f59e0b", human_needed: "#ef4444",
  won: "#14b8a6", lost: "#445566", new: "#7c9ab8",
};

export default function ConversationsPage() {
  const { locationId } = useClientContext();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [syncing,       setSyncing]       = useState(false);
  const [selected,      setSelected]      = useState<Conversation | null>(null);
  const [filter,        setFilter]        = useState<"all" | "active" | "human">("all");
  const [search,        setSearch]        = useState("");
  const [thread,        setThread]        = useState<GHLMessage[] | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError,   setThreadError]   = useState<string | null>(null);
  const [threadSource,  setThreadSource]  = useState<"ghl" | "local" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Trigger the missed-message sync (no cron needed)
  // Called on page load so any email replies that missed the webhook are caught
  const triggerSync = useCallback(async () => {
    try {
      await fetch("/api/cron/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
    } catch { /* non-fatal */ }
  }, [locationId]);

  // Load conversation list from cache (with optional GHL refresh)
  const loadConversations = useCallback(async (withSync = false) => {
    if (withSync) setSyncing(true);
    try {
      const url = `/api/conversations?locationId=${locationId}&sync=${withSync}`;
      const res  = await fetch(url);
      const data = await res.json();
      setConversations(data.conversations || []);
    } finally {
      setLoading(false);
      if (withSync) setSyncing(false);
    }
  }, [locationId]);

  useEffect(() => {
    // On mount: refresh conversation cache + scan for missed inbound messages
    loadConversations(true).then(() => triggerSync());
    const iv = setInterval(() => loadConversations(false), 30000);
    return () => clearInterval(iv);
  }, [loadConversations, triggerSync]);

  // Load full thread — fetches live from GHL including inbound email bodies
  const loadThread = useCallback(async (conv: Conversation) => {
    setThreadLoading(true);
    setThread(null);
    setThreadError(null);
    setThreadSource(null);

    try {
      const res = await fetch("/api/conversations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ghlConversationId: conv.ghlConversationId, locationId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Normalise thread items (API returns { thread, source, aiLogs })
      const rawThread = (data.thread || []) as Array<Record<string, unknown>>;
      const normalised: GHLMessage[] = rawThread.map((m, i) => ({
        id:          String(m.id || `msg-${i}`),
        body:        String(m.body || ""),
        direction:   m.direction === "inbound" ? "inbound" : "outbound",
        messageType: String(m.messageType || "SMS"),
        dateAdded:   String(m.dateAdded || m.createdAt || new Date().toISOString()),
        attachments: (m.attachments as string[]) || [],
        subject:     m.subject ? String(m.subject) : undefined,
        from:        m.from    ? String(m.from)    : undefined,
        aiLog:       (m.aiLog as GHLMessage["aiLog"]) || null,
      }));

      setThread(normalised);
      setThreadSource(data.source === "ghl" ? "ghl" : "local");
    } catch (e) {
      setThreadError(String(e));
      setThread([]);
    } finally {
      setThreadLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (selected) loadThread(selected);
  }, [selected, loadThread]);

  useEffect(() => {
    if (thread && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread]);

  // Manual sync button: also triggers the inbound message scan
  const handleManualSync = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.all([loadConversations(true), triggerSync()]);
    } finally {
      setSyncing(false);
    }
  }, [loadConversations, triggerSync]);

  const filtered = conversations.filter(c => {
    if (filter === "human" && !c.lastLog?.humanTookOver) return false;
    if (filter === "active" && !c.lastLog) return false;
    if (search) {
      const q = search.toLowerCase();
      return [c.contactName, c.contactEmail, c.contactPhone].some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const card: React.CSSProperties = {
    background: "rgba(10,17,30,0.95)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "16px",
    overflow: "hidden",
  };

  return (
    <div style={{ padding: "32px", maxWidth: "1300px", fontFamily: "inherit" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        .crow:hover { background: rgba(255,255,255,0.025) !important; }
        .crow.sel   { background: rgba(20,184,166,0.07) !important; border-left: 2px solid #14b8a6 !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Conversations
          </h1>
          <p style={{ color: "#445566", margin: 0, fontSize: "13px" }}>
            Live from GHL — includes email replies from leads.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            style={{ padding: "8px 14px", background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "9px", color: "#e2eaf4", fontSize: "13px", fontFamily: "inherit", outline: "none", width: "190px" }}
          />
          {(["all", "active", "human"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: filter === f ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${filter === f ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.07)"}`,
              color: filter === f ? "#14b8a6" : "#445566",
            }}>
              {f === "human" ? "👤 Needs Review" : f === "active" ? "⚡ Active" : `All (${conversations.length})`}
            </button>
          ))}
          <button onClick={handleManualSync} disabled={syncing} style={{
            padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(20,184,166,0.25)",
            background: syncing ? "rgba(255,255,255,0.04)" : "rgba(20,184,166,0.08)",
            color: syncing ? "#445566" : "#14b8a6", fontWeight: 700, fontSize: "12px",
            cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>
            {syncing ? "⟳ Syncing…" : "⟳ Sync"}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "360px 1fr" : "1fr", gap: "16px", alignItems: "start" }}>

        {/* Conversation list */}
        <div style={card}>
          {loading ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: "72px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#445566" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>💬</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#7c9ab8", marginBottom: "6px" }}>
                {conversations.length === 0 ? "No conversations yet" : "No matches"}
              </div>
              <div style={{ fontSize: "12px", color: "#2d3d50" }}>
                {conversations.length === 0 ? 'Click "Sync" to pull from GoHighLevel.' : "Try a different filter."}
              </div>
            </div>
          ) : filtered.map((conv, i) => {
            const isSel = selected?.id === conv.id;
            const catColor = CAT_COLOR[conv.category || ""] || "#445566";
            return (
              <div
                key={conv.id}
                className={`crow${isSel ? " sel" : ""}`}
                onClick={() => setSelected(isSel ? null : conv)}
                style={{
                  padding: "14px 18px",
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  cursor: "pointer", background: "transparent",
                  borderLeft: "2px solid transparent", transition: "all 0.12s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg,#0d9488,#14b8a6)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: 800, color: "white",
                    }}>
                      {initials(conv.contactName)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: isSel ? "#14b8a6" : "#e2eaf4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conv.contactName || conv.contactEmail || conv.contactId.slice(0, 12) + "…"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#2d3d50", marginTop: "1px" }}>
                        {conv.contactEmail || conv.contactPhone || "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "8px" }}>
                    <div style={{ fontSize: "10px", color: "#2d3d50" }}>{formatRelativeTime(conv.lastMessageAt)}</div>
                    {conv.category && conv.category !== "new" && (
                      <div style={{ fontSize: "9px", color: catColor, fontWeight: 700, marginTop: "2px", textTransform: "uppercase" }}>
                        {conv.category.replace("_", " ")}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "#445566", paddingLeft: "43px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conv.lastLog
                    ? <>{conv.lastLog.humanTookOver ? "👤 " : "🤖 "}{msgPreview(conv)}</>
                    : <span style={{ color: "#2d3d50" }}>Waiting for reply…</span>
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* Thread panel */}
        {selected && (
          <div style={{ ...card, maxHeight: "85vh", display: "flex", flexDirection: "column", position: "sticky", top: "20px" }}>
            {/* Thread header */}
            <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 3px", letterSpacing: "-0.02em" }}>
                    {selected.contactName || "Unknown Contact"}
                  </h2>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {selected.contactEmail && <span style={{ fontSize: "11px", color: "#445566" }}>✉ {selected.contactEmail}</span>}
                    {selected.contactPhone && <span style={{ fontSize: "11px", color: "#445566" }}>📱 {selected.contactPhone}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {threadSource && (
                    <span style={{
                      fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px", letterSpacing: "0.05em",
                      background: threadSource === "ghl" ? "rgba(20,184,166,0.12)" : "rgba(245,158,11,0.1)",
                      color: threadSource === "ghl" ? "#14b8a6" : "#f59e0b",
                    }}>
                      {threadSource === "ghl" ? "✓ LIVE FROM GHL" : "⚠ LOCAL ONLY"}
                    </span>
                  )}
                  <button onClick={() => loadThread(selected)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#445566", cursor: "pointer", fontSize: "12px", padding: "5px 10px", borderRadius: "6px", fontFamily: "inherit" }}>
                    ↻
                  </button>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#445566", cursor: "pointer", fontSize: "18px", padding: "4px" }}>
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {threadLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                  <div style={{ width: "24px", height: "24px", border: "2px solid rgba(20,184,166,0.2)", borderTop: "2px solid #14b8a6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              )}

              {!threadLoading && threadError && threadSource !== "ghl" && (
                <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "8px", fontSize: "11px", color: "#f59e0b" }}>
                  ⚠ Could not reach GHL: {threadError}. Showing local AI logs only.
                </div>
              )}

              {!threadLoading && thread?.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "#2d3d50" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>💬</div>
                  <div style={{ fontSize: "13px" }}>No messages found.</div>
                </div>
              )}

              {!threadLoading && thread?.map((msg, idx) => {
                const isInbound = msg.direction === "inbound";
                const typeKey   = (msg.messageType || "").toUpperCase();
                const isEmail   = typeKey === "EMAIL";
                const icon      = TYPE_ICON[typeKey] ?? "💬";

                return (
                  <div key={msg.id || idx} style={{ display: "flex", justifyContent: isInbound ? "flex-start" : "flex-end" }}>
                    <div style={{
                      maxWidth: "82%",
                      background: isInbound ? "rgba(255,255,255,0.04)" : "rgba(20,184,166,0.1)",
                      border: `1px solid ${isInbound ? "rgba(255,255,255,0.07)" : "rgba(20,184,166,0.2)"}`,
                      borderRadius: isInbound ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                      padding: "10px 14px",
                    }}>
                      {isEmail && msg.subject && (
                        <div style={{ fontSize: "10px", fontWeight: 700, color: isInbound ? "#7c9ab8" : "#14b8a6", marginBottom: "4px" }}>
                          {icon} {msg.subject}
                        </div>
                      )}
                      <div style={{ fontSize: "9px", color: isInbound ? "#445566" : "#14b8a6", fontWeight: 700, marginBottom: "5px", letterSpacing: "0.04em" }}>
                        {senderLabel(msg, icon)}
                      </div>
                      <div style={{ fontSize: "13px", color: isInbound ? "#c8d8e8" : "#e2eaf4", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {cleanDisplayBody(msg.body) || <span style={{ color: "#445566", fontStyle: "italic" }}>(body indexing…)</span>}
                      </div>
                      {msg.aiLog?.intent && (
                        <div style={{ marginTop: "6px", fontSize: "9px", color: "#2d3d50", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: "4px", display: "inline-block" }}>
                          {msg.aiLog.intent.replace(/_/g, " ")}
                          {msg.aiLog.confidence != null ? ` · ${Math.round(msg.aiLog.confidence * 100)}%` : ""}
                        </div>
                      )}
                      <div style={{ fontSize: "9px", color: "#2d3d50", marginTop: "5px" }}>
                        {new Date(msg.dateAdded).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              <a
                href={`https://app.gohighlevel.com/v2/location/${selected.ghlConversationId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "9px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.07)", color: "#445566", textDecoration: "none", fontSize: "12px", fontWeight: 600 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(20,184,166,0.3)"; (e.currentTarget as HTMLElement).style.color = "#14b8a6"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "#445566"; }}
              >
                Open in GoHighLevel ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
