"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useClientContext } from "../ClientProvider";
import { formatRelativeTime } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────
interface Conversation {
  id: string;
  ghlConversationId: string;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  lastMessageAt: string;
  status: string;
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

interface ThreadResult {
  thread: GHLMessage[];
  source: "ghl" | "local";
  fetchedAt: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────
function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

function msgPreview(conv: Conversation) {
  if (!conv.lastLog) return "No messages yet";
  return (conv.lastLog.aiResponse || conv.lastLog.inputMessage || "").slice(0, 65) + "…";
}

const TYPE_ICON: Record<string, string> = {
  EMAIL: "✉",
  SMS:   "💬",
  CALL:  "📞",
};

// ── Component ─────────────────────────────────────────────────────
export default function ConversationsPage() {
  const { locationId } = useClientContext();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [selected,  setSelected]  = useState<Conversation | null>(null);
  const [filter,    setFilter]    = useState<"all" | "active" | "human">("all");
  const [search,    setSearch]    = useState("");
  const [thread,    setThread]    = useState<GHLMessage[] | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError,   setThreadError]   = useState<string | null>(null);
  const [threadSource,  setThreadSource]  = useState<"ghl" | "local" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Load conversation list ────────────────────────────────────
  const loadConversations = useCallback(async (withSync = false) => {
    if (withSync) setSyncing(true);
    try {
      // Always sync from GHL on load so contact info + cache is up to date
      const url = withSync
        ? `/api/conversations?locationId=${locationId}&sync=true`
        : `/api/conversations?locationId=${locationId}&sync=false`;
      const res  = await fetch(url);
      const data = await res.json();
      setConversations(data.conversations || []);
    } finally {
      setLoading(false);
      if (withSync) setSyncing(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadConversations(true); // initial load syncs from GHL
    const iv = setInterval(() => loadConversations(false), 30000);
    return () => clearInterval(iv);
  }, [loadConversations]);

  // ── Load thread when conversation selected ────────────────────
  const loadThread = useCallback(async (conv: Conversation) => {
    setThreadLoading(true);
    setThread(null);
    setThreadError(null);
    setThreadSource(null);

    try {
      const res = await fetch("/api/conversations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ghlConversationId: conv.ghlConversationId,
          locationId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ThreadResult = await res.json();
      setThread(data.thread || []);
      setThreadSource(data.source);
      if (data.error) setThreadError(data.error);
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

  // Auto-scroll to bottom when thread loads
  useEffect(() => {
    if (thread && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread]);

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = conversations.filter(c => {
    if (filter === "human" && !c.lastLog?.humanTookOver) return false;
    if (filter === "active" && !c.lastLog) return false;
    if (search) {
      const q = search.toLowerCase();
      return [c.contactName, c.contactEmail, c.contactPhone]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  // ── Styles ────────────────────────────────────────────────────
  const S = {
    page: { padding: "32px", maxWidth: "1300px", fontFamily: "inherit" } as React.CSSProperties,
    grid: {
      display: "grid",
      gridTemplateColumns: selected ? "360px 1fr" : "1fr",
      gap: "16px",
      alignItems: "start",
    } as React.CSSProperties,
    card: {
      background: "rgba(10,17,30,0.95)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "16px",
      overflow: "hidden",
    } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        .conv-row:hover { background: rgba(255,255,255,0.025) !important; }
        .conv-row.sel   { background: rgba(20,184,166,0.07) !important; border-left: 2px solid #14b8a6 !important; }
        .msg-bubble { transition: opacity 0.15s; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Conversations
          </h1>
          <p style={{ color: "#445566", margin: 0, fontSize: "13px" }}>
            All lead conversations — including email replies from GHL.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            style={{ padding: "8px 14px", background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "9px", color: "#e2eaf4", fontSize: "13px", fontFamily: "inherit", outline: "none", width: "190px" }}
          />
          {["all", "active", "human"].map(f => (
            <button key={f} onClick={() => setFilter(f as typeof filter)} style={{
              padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: filter === f ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${filter === f ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.07)"}`,
              color: filter === f ? "#14b8a6" : "#445566",
            }}>
              {f === "human" ? "👤 Needs Review" : f === "active" ? "⚡ Active" : `All (${conversations.length})`}
            </button>
          ))}
          <button onClick={() => loadConversations(true)} disabled={syncing} style={{
            padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(20,184,166,0.25)",
            background: syncing ? "rgba(255,255,255,0.04)" : "rgba(20,184,166,0.08)",
            color: syncing ? "#445566" : "#14b8a6", fontWeight: 700, fontSize: "12px",
            cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>
            {syncing ? "⟳ Syncing…" : "⟳ Sync GHL"}
          </button>
        </div>
      </div>

      <div style={S.grid}>
        {/* ── Conversation list ── */}
        <div style={S.card}>
          {loading ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: "72px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#445566" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>💬</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#7c9ab8", marginBottom: "6px" }}>
                {conversations.length === 0 ? "No conversations yet" : "No matches"}
              </div>
              <div style={{ fontSize: "12px", color: "#2d3d50" }}>
                {conversations.length === 0
                  ? 'Click "Sync GHL" to pull from GoHighLevel.'
                  : "Try a different filter or search."}
              </div>
            </div>
          ) : filtered.map((conv, i) => {
            const isSel = selected?.id === conv.id;
            return (
              <div
                key={conv.id}
                className={`conv-row${isSel ? " sel" : ""}`}
                onClick={() => setSelected(isSel ? null : conv)}
                style={{
                  padding: "14px 18px",
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  cursor: "pointer",
                  background: "transparent",
                  borderLeft: "2px solid transparent",
                  transition: "all 0.12s",
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
                        {conv.contactName || conv.contactEmail || conv.contactId.slice(0, 14) + "…"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#2d3d50", marginTop: "1px" }}>
                        {conv.contactEmail || conv.contactPhone || "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "8px" }}>
                    <div style={{ fontSize: "10px", color: "#2d3d50" }}>{formatRelativeTime(conv.lastMessageAt)}</div>
                    {conv.lastLog?.humanTookOver && (
                      <div style={{ fontSize: "9px", color: "#f59e0b", fontWeight: 700, marginTop: "2px" }}>NEEDS REVIEW</div>
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

        {/* ── Thread panel ── */}
        {selected && (
          <div style={{ ...S.card, maxHeight: "85vh", display: "flex", flexDirection: "column", position: "sticky", top: "20px" }}>
            {/* Header */}
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
                <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "8px", fontSize: "11px", color: "#f59e0b", marginBottom: "8px" }}>
                  ⚠ Could not fetch live messages from GHL: {threadError}. Showing local AI logs only.
                </div>
              )}

              {!threadLoading && thread && thread.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "#2d3d50" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>💬</div>
                  <div style={{ fontSize: "13px" }}>No messages found.</div>
                </div>
              )}

              {!threadLoading && thread && thread.map((msg, idx) => {
                const isInbound  = msg.direction === "inbound";
                const isEmail    = msg.messageType?.toUpperCase() === "EMAIL";
                const typeIcon   = TYPE_ICON[msg.messageType?.toUpperCase() ?? ""] ?? "💬";

                return (
                  <div key={msg.id || idx} className="msg-bubble" style={{
                    display: "flex",
                    justifyContent: isInbound ? "flex-start" : "flex-end",
                  }}>
                    <div style={{
                      maxWidth: "80%",
                      background: isInbound
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(20,184,166,0.1)",
                      border: `1px solid ${isInbound ? "rgba(255,255,255,0.07)" : "rgba(20,184,166,0.2)"}`,
                      borderRadius: isInbound ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                      padding: "10px 14px",
                    }}>
                      {/* Subject line for emails */}
                      {isEmail && msg.subject && (
                        <div style={{ fontSize: "10px", fontWeight: 700, color: isInbound ? "#7c9ab8" : "#14b8a6", marginBottom: "4px", letterSpacing: "0.03em" }}>
                          {typeIcon} {msg.subject}
                        </div>
                      )}

                      {/* Sender label */}
                      <div style={{ fontSize: "9px", color: isInbound ? "#445566" : "#14b8a6", fontWeight: 700, marginBottom: "5px", letterSpacing: "0.04em" }}>
                        {isInbound
                          ? `${typeIcon} LEAD${msg.from ? ` · ${msg.from}` : ""}`
                          : `${typeIcon} ${msg.aiLog?.agent?.name || "AI AGENT"}${msg.aiLog?.humanTookOver ? " · HUMAN" : ""}`
                        }
                      </div>

                      {/* Body */}
                      <div style={{ fontSize: "13px", color: isInbound ? "#c8d8e8" : "#e2eaf4", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {msg.body || <span style={{ color: "#445566", fontStyle: "italic" }}>(empty — body may not have indexed yet)</span>}
                      </div>

                      {/* AI metadata */}
                      {msg.aiLog?.intent && (
                        <div style={{ marginTop: "6px", fontSize: "9px", color: "#2d3d50", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: "4px", display: "inline-block" }}>
                          {msg.aiLog.intent.replace(/_/g, " ")}
                          {msg.aiLog.confidence != null ? ` · ${Math.round(msg.aiLog.confidence * 100)}%` : ""}
                        </div>
                      )}

                      {/* Timestamp */}
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
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "9px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.07)", color: "#445566", textDecoration: "none", fontSize: "12px", fontWeight: 600, transition: "all 0.15s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = "rgba(20,184,166,0.3)"; el.style.color = "#14b8a6"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = "rgba(255,255,255,0.07)"; el.style.color = "#445566"; }}
              >
                🔗 Open in GoHighLevel
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
