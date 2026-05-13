"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useClientContext } from "../ClientProvider";

interface ChatMessage {
  id: string;
  agentName: string;
  agentRole: string;
  agentAvatar: string;
  message: string;
  messageType: string;
  contactName?: string | null;
  isRead: boolean;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  SDR: "#14b8a6", SETTER: "#f59e0b", CLOSER: "#22c55e",
  FOLLOWUP: "#3b82f6", SYSTEM: "#a78bfa", OWNER: "#e2eaf4",
};

const TYPE_ICONS: Record<string, string> = {
  update: "📊", alert: "🚨", question: "❓", progress: "📈", summary: "📋",
};

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function groupByDate(msgs: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  let lastDate = "";
  for (const m of msgs) {
    const d = new Date(m.createdAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (d !== lastDate) { groups.push({ date: d, messages: [] }); lastDate = d; }
    groups[groups.length - 1].messages.push(m);
  }
  return groups;
}

export default function TeamChatPage() {
  const { locationId } = useClientContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [agents, setAgents] = useState<{ id: string; name: string; role: string; avatar: string }[]>([]);
  const [targetAgent, setTargetAgent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollBottom = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);

  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/agents?locationId=${locationId}`).then(r => r.json()).then(d => setAgents(d.agents || []));
  }, [locationId]);

  const loadMessages = useCallback(() => {
    if (!locationId) return;
    const p = new URLSearchParams({ locationId });
    fetch(`/api/team-chat?${p}`).then(r => r.json()).then(d => {
      setMessages(d.messages || []);
      setLoading(false);
      scrollBottom();
    }).catch(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Poll for new messages every 15s
  useEffect(() => {
    const iv = setInterval(loadMessages, 15000);
    return () => clearInterval(iv);
  }, [loadMessages]);

  const send = async () => {
    const txt = input.trim();
    if (!txt || sending || !locationId) return;
    setSending(true);
    setInput("");
    const res = await fetch("/api/team-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: txt, locationId, targetAgent: targetAgent || undefined }),
    });
    const data = await res.json();
    if (data.messages) {
      setMessages(prev => [...prev, ...data.messages]);
      scrollBottom();
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const requestUpdate = async () => {
    if (!locationId) return;
    const res = await fetch("/api/team-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId }),
    });
    const data = await res.json();
    if (data.message) { setMessages(prev => [...prev, data.message]); scrollBottom(); }
  };

  const groups = groupByDate(messages);
  const quickPrompts = [
    "What's happening with the pipeline today?",
    "Any hot leads I should know about?",
    "How many leads did we qualify this week?",
    "What objections are you seeing most?",
    "Give me a quick status update",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", maxWidth: "860px", margin: "0 auto", padding: "0 16px" }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              AI Sales Team
            </h1>
            <p style={{ color: "#2d3d50", fontSize: "12px", margin: 0 }}>
              {agents.length > 0 ? `${agents.map(a => a.name).join(", ")} — your AI team` : "Your agents report here in real time"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={requestUpdate} style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.3)", color: "#14b8a6",
            }}>
              📊 Get Update
            </button>
          </div>
        </div>

        {/* Agent roster */}
        {agents.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
            {agents.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", borderRadius: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "13px" }}>{a.avatar}</span>
                <span style={{ fontSize: "11px", color: "#7c9ab8", fontWeight: 500 }}>{a.name}</span>
                <span style={{ fontSize: "9px", color: ROLE_COLORS[a.role] || "#445566", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{a.role}</span>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#2d3d50", fontSize: "13px" }}>Loading team chat...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>💬</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#7c9ab8", marginBottom: "8px" }}>Your team is ready</div>
            <div style={{ fontSize: "13px", color: "#2d3d50", marginBottom: "20px" }}>Click "Get Update" or ask your team anything below.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {quickPrompts.map(p => (
                <button key={p} onClick={() => setInput(p)} style={{ padding: "7px 14px", borderRadius: "20px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "#14b8a6" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.date}>
              {/* Date divider */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 16px" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
                <span style={{ fontSize: "10px", color: "#2d3d50", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{group.date}</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
              </div>

              {group.messages.map((msg, i) => {
                const isOwner = msg.agentRole === "OWNER";
                const color = ROLE_COLORS[msg.agentRole] || "#14b8a6";
                const showAvatar = i === 0 || group.messages[i - 1].agentRole !== msg.agentRole;

                return (
                  <div key={msg.id} style={{ display: "flex", gap: "10px", marginBottom: "4px", flexDirection: isOwner ? "row-reverse" : "row", padding: "0 4px" }}>
                    {/* Avatar */}
                    <div style={{ width: "34px", flexShrink: 0 }}>
                      {showAvatar && (
                        <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: isOwner ? "rgba(226,234,244,0.08)" : `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                          {msg.agentAvatar}
                        </div>
                      )}
                    </div>

                    {/* Bubble */}
                    <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isOwner ? "flex-end" : "flex-start" }}>
                      {showAvatar && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexDirection: isOwner ? "row-reverse" : "row" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color }}>{msg.agentName}</span>
                          {!isOwner && <span style={{ fontSize: "9px", color: "#2d3d50", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{msg.agentRole}</span>}
                          {!isOwner && msg.messageType !== "update" && <span style={{ fontSize: "11px" }}>{TYPE_ICONS[msg.messageType]}</span>}
                        </div>
                      )}
                      <div style={{
                        padding: "10px 14px", borderRadius: isOwner ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                        background: isOwner ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.04)",
                        border: isOwner ? "1px solid rgba(20,184,166,0.2)" : "1px solid rgba(255,255,255,0.06)",
                        fontSize: "13px", color: "#c8d6e5", lineHeight: 1.6,
                      }}>
                        {msg.message}
                        {msg.contactName && (
                          <div style={{ marginTop: "6px", fontSize: "10px", color: "#445566" }}>re: {msg.contactName}</div>
                        )}
                      </div>
                      <span style={{ fontSize: "10px", color: "#2d3d50", marginTop: "3px", padding: "0 2px" }}>{timeAgo(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick prompts (above input) ── */}
      {messages.length > 0 && (
        <div style={{ display: "flex", gap: "6px", paddingBottom: "10px", overflowX: "auto", flexShrink: 0 }}>
          {quickPrompts.slice(0, 3).map(p => (
            <button key={p} onClick={() => setInput(p)} style={{ padding: "5px 12px", borderRadius: "20px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#445566", whiteSpace: "nowrap", flexShrink: 0 }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", paddingBottom: "16px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          {agents.length > 1 && (
            <select value={targetAgent} onChange={e => setTargetAgent(e.target.value)}
              style={{ padding: "10px 10px", borderRadius: "10px", background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.08)", color: "#7c9ab8", fontSize: "11px", fontFamily: "inherit", cursor: "pointer", flexShrink: 0, height: "44px" }}>
              <option value="">Any agent</option>
              {agents.map(a => <option key={a.id} value={a.role}>{a.name}</option>)}
            </select>
          )}
          <div style={{ flex: 1, position: "relative" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask your team anything... (Enter to send)"
              rows={1}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px", resize: "none",
                background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2eaf4", fontSize: "13px", fontFamily: "inherit", outline: "none",
                lineHeight: 1.5, boxSizing: "border-box",
              }}
            />
          </div>
          <button onClick={send} disabled={!input.trim() || sending} style={{
            padding: "11px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
            cursor: input.trim() && !sending ? "pointer" : "default", fontFamily: "inherit",
            background: input.trim() && !sending ? "linear-gradient(135deg,#0d9488,#14b8a6)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", color: input.trim() && !sending ? "white" : "#2d3d50",
            flexShrink: 0, transition: "all 0.15s",
          }}>
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
