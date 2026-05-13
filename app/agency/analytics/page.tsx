"use client";

import { useEffect, useState, useRef } from "react";

interface Stats {
  totalMessages: number; sentMessages: number; humanFallbacks: number;
  automationRate: number; dropOffRate: number; handoffSuccessRate: number;
  totalLeads: number; qualifiedLeads: number; wonLeads: number; lostLeads: number;
  nurtureLeads: number; bookedLeads: number; qualifyRate: number; closeRate: number;
  bookingRate: number; avgConfidence: number;
  confBuckets: { high: number; medium: number; low: number };
  deltaMessages: number | null; deltaFallbacks: number | null;
  deltaQualified: number | null; deltaWon: number | null;
}
interface AgentStat {
  id: string; name: string; role: string; avatar: string;
  totalMessages: number; humanTakeovers: number; avgConfidence: number;
  autonomyRate: number; leadsAssigned: number; leadsWon: number; conversionRate: number;
}
interface DayData { date: string; messages: number; fallbacks: number; leads: number; }
interface IntentRow { intent: string; count: number; }
interface Location { id: string; name: string; }
interface Subscription {
  plan: string; status: string; trialMessagesUsed: number; trialMessagesLimit: number;
  messagesUsedThisPeriod: number; monthlyMessageLimit: number; trialEndsAt: string;
}

function Delta({ v }: { v: number | null }) {
  if (v === null) return <span style={{ color: "#2d3d50", fontSize: "11px" }}>—</span>;
  const pos = v >= 0;
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, color: pos ? "#22c55e" : "#ef4444",
      background: pos ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
      padding: "2px 6px", borderRadius: "4px", marginLeft: "6px" }}>
      {pos ? "▲" : "▼"} {Math.abs(v)}%
    </span>
  );
}

function KPI({ label, value, sub, color = "#14b8a6", icon, delta, warn }: {
  label: string; value: string | number; sub?: string; color?: string; icon: string;
  delta?: number | null; warn?: boolean;
}) {
  return (
    <div style={{
      background: "rgba(10,17,30,0.9)", borderRadius: "14px", padding: "20px 22px",
      border: warn ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(255,255,255,0.07)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: warn
        ? "radial-gradient(ellipse at 80% 0%, rgba(239,68,68,0.06) 0%, transparent 70%)"
        : "radial-gradient(ellipse at 80% 0%, rgba(20,184,166,0.04) 0%, transparent 70%)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <span style={{ fontSize: "10px", color: "#445566", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: "20px", opacity: 0.45 }}>{icon}</span>
      </div>
      <div style={{ fontSize: "28px", fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}{delta !== undefined && <Delta v={delta ?? null} />}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "6px" }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <h2 style={{ fontSize: "11px", fontWeight: 800, color: "#14b8a6", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontSize: "12px", color: "#2d3d50", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color, suffix = "%", note }: {
  label: string; value: number; max: number; color: string; suffix?: string; note?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontSize: "12px", color: "#7c9ab8" }}>{label}</span>
        <div>
          <span style={{ fontSize: "13px", fontWeight: 700, color }}>{value}{suffix}</span>
          {note && <span style={{ fontSize: "10px", color: "#2d3d50", marginLeft: "6px" }}>{note}</span>}
        </div>
      </div>
      <div style={{ height: "5px", background: "rgba(255,255,255,0.04)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: "3px", transition: "width 1s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
    </div>
  );
}

function DualBarChart({ data }: { data: DayData[] }) {
  const maxMsgs = Math.max(...data.map(d => d.messages), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "110px", paddingBottom: "20px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", height: "100%" }}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", gap: "1px" }}>
            <div title={`${d.messages} messages`} style={{ flex: 3, height: `${Math.max(3, (d.messages / maxMsgs) * 100)}%`, background: "linear-gradient(180deg,#14b8a6,#0d9488)", borderRadius: "2px 2px 0 0", minHeight: "3px" }} />
            {d.fallbacks > 0 && <div title={`${d.fallbacks} fallbacks`} style={{ flex: 1, height: `${Math.max(2, (d.fallbacks / maxMsgs) * 100)}%`, background: "#f59e0b", borderRadius: "2px 2px 0 0", minHeight: "2px" }} />}
          </div>
          <span style={{ fontSize: "8px", color: "#2d3d50", transform: "rotate(-40deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>{d.date}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [intentBreakdown, setIntentBreakdown] = useState<IntentRow[]>([]);
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [locationBreakdown, setLocationBreakdown] = useState<{ id: string; name: string; leads: number; won: number; messages: number; automationRate: number }[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<"all" | string>("all");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ai" | "sales" | "agents" | "locations">("ai");
  const busy = useRef(false);

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      setLocations(d.locations || []);
    });
  }, []);

  useEffect(() => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const p = new URLSearchParams({ days: String(days) });
    if (selectedLoc === "all") {
      p.set("scope", "all");
    } else {
      p.set("locationId", selectedLoc);
      p.set("scope", "single");
    }
    fetch(`/api/analytics?${p}`).then(r => r.json()).then(d => {
      setStats(d.stats); setAgentStats(d.agentStats || []);
      setIntentBreakdown(d.intentBreakdown || []); setDailyData(d.dailyData || []);
      setLocationBreakdown(d.locationBreakdown || []);
      setSub(d.subscription); setLoading(false); busy.current = false;
    }).catch(() => { setLoading(false); busy.current = false; });
  }, [days, selectedLoc]);

  const isTrial = sub?.status === "trialing";
  const usagePct = isTrial
    ? Math.min(100, Math.round(((sub?.trialMessagesUsed || 0) / (sub?.trialMessagesLimit || 50)) * 100))
    : Math.min(100, Math.round(((sub?.messagesUsedThisPeriod || 0) / (sub?.monthlyMessageLimit || 500)) * 100));

  const INTENT_ICONS: Record<string, string> = {
    greeting: "👋", question: "❓", objection: "🛡", buying_signal: "🔥",
    price_inquiry: "💰", scheduling: "📅", complaint: "⚠️", general: "💬",
  };

  const totalIntents = intentBreakdown.reduce((s, i) => s + i.count, 0);

  return (
    <div style={{ padding: "clamp(20px,3vw,36px)", maxWidth: "1180px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "clamp(20px,3.5vw,26px)", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.03em" }}>Agency Analytics</h1>
          <p style={{ color: "#2d3d50", fontSize: "13px", margin: 0 }}>
            {selectedLoc === "all"
              ? `Aggregated across all ${locations.length} location${locations.length !== 1 ? "s" : ""} — no vanity metrics.`
              : `Showing data for: ${locations.find(l => l.id === selectedLoc)?.name || "location"}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {/* Location filter — includes "All Locations" */}
          <select value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: "8px", background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.08)", color: "#7c9ab8", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
            <option value="all">🌐 All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: days === d ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${days === d ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.07)"}`,
              color: days === d ? "#14b8a6" : "#445566",
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Usage bar */}
      {sub && (
        <div style={{ background: "rgba(10,17,30,0.9)", borderRadius: "12px", padding: "14px 20px", marginBottom: "24px", border: isTrial ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: isTrial ? "#f59e0b" : "#445566" }}>
              {isTrial ? "⏳ Trial" : "📊 Monthly"} · {isTrial ? `${sub.trialMessagesUsed}/${sub.trialMessagesLimit}` : `${sub.messagesUsedThisPeriod}/${sub.monthlyMessageLimit}`} messages
            </span>
            <span style={{ fontSize: "11px", color: "#2d3d50" }}>{usagePct}% used</span>
          </div>
          <div style={{ height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${usagePct}%`,
              background: usagePct > 85 ? "linear-gradient(90deg,#dc2626,#ef4444)" : isTrial ? "linear-gradient(90deg,#d97706,#f59e0b)" : "linear-gradient(90deg,#0d9488,#14b8a6)",
              borderRadius: "2px", transition: "width 0.8s ease" }} />
          </div>
          {isTrial && <a href="/pricing" style={{ display: "inline-block", marginTop: "8px", fontSize: "11px", color: "#14b8a6", fontWeight: 600, textDecoration: "none" }}>Upgrade for unlimited →</a>}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "rgba(10,17,30,0.6)", borderRadius: "10px", padding: "4px", border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {([{ key: "ai", label: "🤖 AI Performance" }, { key: "sales", label: "📊 Sales Pipeline" }, { key: "agents", label: "🏆 Agent Comparison" }, { key: "locations", label: "📍 Locations" }] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "7px 16px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", border: "none",
            background: tab === t.key ? "rgba(20,184,166,0.15)" : "transparent",
            color: tab === t.key ? "#14b8a6" : "#445566",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── A: AI PERFORMANCE ── */}
      {tab === "ai" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "12px", marginBottom: "24px" }}>
            <KPI icon="💬" label="Messages Handled" value={loading ? "—" : (stats?.totalMessages ?? 0).toLocaleString()} sub={`${stats?.sentMessages ?? 0} sent by AI`} delta={stats?.deltaMessages} />
            <KPI icon="⚡" label="Automation Rate" value={loading ? "—" : `${stats?.automationRate ?? 0}%`} sub="Resolved without human" color="#22c55e" warn={(stats?.automationRate ?? 100) < 50} />
            <KPI icon="👤" label="Human Fallbacks" value={loading ? "—" : (stats?.humanFallbacks ?? 0).toLocaleString()} sub="Escalated conversations" color="#f59e0b"
              delta={stats?.deltaFallbacks != null ? -stats.deltaFallbacks : null}
              warn={(stats?.humanFallbacks ?? 0) > (stats?.totalMessages ?? 1) * 0.3} />
            <KPI icon="🎯" label="AI Confidence" value={loading ? "—" : `${stats?.avgConfidence ?? 0}%`} sub="Avg before sending" color="#a78bfa" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
            <div style={{ background: "rgba(10,17,30,0.9)", borderRadius: "14px", padding: "22px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <SectionTitle sub="End-to-end AI health">Key Rates</SectionTitle>
              <BarRow label="Automation Rate" value={stats?.automationRate ?? 0} max={100} color="#14b8a6" />
              <BarRow label="Drop-off Rate" value={stats?.dropOffRate ?? 0} max={100} color="#ef4444" note="leads → LOST" />
              <BarRow label="Handoff Success" value={stats?.handoffSuccessRate ?? 0} max={100} color="#22c55e" note="human takeovers → WON" />
            </div>

            <div style={{ background: "rgba(10,17,30,0.9)", borderRadius: "14px", padding: "22px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <SectionTitle sub="How certain the AI was before each reply">Confidence Spread</SectionTitle>
              {stats ? (() => {
                const t = (stats.confBuckets.high + stats.confBuckets.medium + stats.confBuckets.low) || 1;
                return (
                  <>
                    <BarRow label="High ≥75%" value={Math.round((stats.confBuckets.high / t) * 100)} max={100} color="#22c55e" />
                    <BarRow label="Medium 50–74%" value={Math.round((stats.confBuckets.medium / t) * 100)} max={100} color="#f59e0b" />
                    <BarRow label="Low <50%" value={Math.round((stats.confBuckets.low / t) * 100)} max={100} color="#ef4444" />
                    <p style={{ fontSize: "11px", color: "#2d3d50", marginTop: "10px", lineHeight: 1.6 }}>Low-confidence replies are the top cause of human fallbacks. Train your agents on those topics.</p>
                  </>
                );
              })() : <div style={{ color: "#2d3d50", fontSize: "12px" }}>Loading...</div>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
            <div style={{ background: "rgba(10,17,30,0.9)", borderRadius: "14px", padding: "22px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <SectionTitle>Activity Chart</SectionTitle>
                <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "#2d3d50" }}>
                  <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "#14b8a6", borderRadius: "2px", marginRight: "4px" }} />Messages</span>
                  <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "#f59e0b", borderRadius: "2px", marginRight: "4px" }} />Fallbacks</span>
                </div>
              </div>
              {dailyData.length > 0 ? <DualBarChart data={dailyData} /> : <div style={{ height: "110px", display: "flex", alignItems: "center", justifyContent: "center", color: "#2d3d50", fontSize: "12px" }}>No activity yet</div>}
            </div>

            <div style={{ background: "rgba(10,17,30,0.9)", borderRadius: "14px", padding: "22px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <SectionTitle sub="What leads are saying">Lead Intents</SectionTitle>
              {intentBreakdown.length > 0 ? intentBreakdown.map(row => (
                <div key={row.intent} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span style={{ fontSize: "13px" }}>{INTENT_ICONS[row.intent] || "💬"}</span>
                    <span style={{ fontSize: "12px", color: "#7c9ab8", textTransform: "capitalize" }}>{row.intent.replace(/_/g, " ")}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "36px", height: "3px", background: "rgba(255,255,255,0.04)", borderRadius: "2px" }}>
                      <div style={{ height: "100%", width: `${Math.round((row.count / totalIntents) * 100)}%`, background: "#14b8a6", borderRadius: "2px" }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "#445566" }}>{row.count}</span>
                  </div>
                </div>
              )) : <div style={{ color: "#2d3d50", fontSize: "12px", paddingTop: "12px" }}>No intents logged yet</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── B: SALES PIPELINE ── */}
      {tab === "sales" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: "12px", marginBottom: "24px" }}>
            <KPI icon="👤" label="Total Leads" value={loading ? "—" : (stats?.totalLeads ?? 0).toLocaleString()} sub="Entered pipeline" />
            <KPI icon="✅" label="Qualified" value={loading ? "—" : (stats?.qualifiedLeads ?? 0).toLocaleString()} sub={`${stats?.qualifyRate ?? 0}% qualify rate`} color="#a78bfa" delta={stats?.deltaQualified} />
            <KPI icon="🏆" label="Won" value={loading ? "—" : (stats?.wonLeads ?? 0).toLocaleString()} sub={`${stats?.closeRate ?? 0}% close rate`} color="#22c55e" delta={stats?.deltaWon} />
            <KPI icon="📅" label="Booked" value={loading ? "—" : (stats?.bookedLeads ?? 0).toLocaleString()} sub={`${stats?.bookingRate ?? 0}% of qualified`} color="#f59e0b" />
            <KPI icon="🌙" label="In Nurture" value={loading ? "—" : (stats?.nurtureLeads ?? 0).toLocaleString()} sub="Long-term follow-up" color="#3b82f6" />
            <KPI icon="❌" label="Lost" value={loading ? "—" : (stats?.lostLeads ?? 0).toLocaleString()} sub="Did not convert" color="#ef4444" warn={(stats?.lostLeads ?? 0) > (stats?.totalLeads ?? 1) * 0.4} />
          </div>

          {/* Funnel */}
          <div style={{ background: "rgba(10,17,30,0.9)", borderRadius: "14px", padding: "28px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "14px" }}>
            <SectionTitle sub="How leads flow through your sales process">Conversion Funnel</SectionTitle>
            {stats && stats.totalLeads > 0 ? (() => {
              const funnel = [
                { label: "Leads In", value: stats.totalLeads, color: "#7c9ab8" },
                { label: "Engaged", value: Math.max(stats.qualifiedLeads, Math.round(stats.totalLeads * 0.7)), color: "#3b82f6" },
                { label: "Qualified", value: stats.qualifiedLeads, color: "#a78bfa" },
                { label: "Booked", value: stats.bookedLeads, color: "#f59e0b" },
                { label: "Won", value: stats.wonLeads, color: "#22c55e" },
              ];
              const maxVal = funnel[0].value || 1;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {funnel.map((step, i) => {
                    const pct = Math.round((step.value / maxVal) * 100);
                    const drop = i > 0 && funnel[i - 1].value > 0 ? Math.round(((funnel[i - 1].value - step.value) / funnel[i - 1].value) * 100) : 0;
                    return (
                      <div key={step.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "72px", fontSize: "11px", color: "#445566", textAlign: "right", flexShrink: 0 }}>{step.label}</div>
                        <div style={{ flex: 1, height: "26px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: step.color, opacity: 0.8, borderRadius: "4px", display: "flex", alignItems: "center", paddingLeft: "8px", transition: "width 1s ease" }}>
                            {pct > 8 && <span style={{ fontSize: "11px", fontWeight: 700, color: "white" }}>{step.value.toLocaleString()}</span>}
                          </div>
                        </div>
                        <div style={{ width: "48px", fontSize: "11px", color: "#2d3d50", flexShrink: 0 }}>
                          {i > 0 && drop > 0 && <span style={{ color: "#ef4444" }}>−{drop}%</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })() : (
              <div style={{ textAlign: "center", padding: "32px", color: "#2d3d50", fontSize: "13px" }}>No pipeline data yet for this period.</div>
            )}
          </div>

          <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: "12px", padding: "14px 18px" }}>
            <div style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700, marginBottom: "4px" }}>📌 What you won't see here</div>
            <div style={{ fontSize: "12px", color: "#445566", lineHeight: 1.7 }}>Revenue figures live in GoHighLevel — we track lead stages, not deal values. For revenue reporting, use your GHL dashboard. NexusReply's job is to get leads to WON; the financial record stays in GHL.</div>
          </div>
        </div>
      )}

      {/* ── C: AGENT COMPARISON ── */}
      {tab === "agents" && (
        <div>
          <SectionTitle sub="Performance of each AI agent. Use this to refine their prompts continuously.">Agent Leaderboard</SectionTitle>

          {loading ? (
            <div style={{ color: "#2d3d50", fontSize: "13px", padding: "40px 0" }}>Loading...</div>
          ) : agentStats.length === 0 ? (
            <div style={{ background: "rgba(10,17,30,0.9)", borderRadius: "14px", padding: "48px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>🤖</div>
              <div style={{ fontSize: "14px", color: "#445566" }}>No agent activity in this period yet.</div>
            </div>
          ) : (
            <>
              {/* Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "12px", marginBottom: "24px" }}>
                {[...agentStats].sort((a, b) => b.conversionRate - a.conversionRate).map((a, rank) => (
                  <div key={a.id} style={{ background: "rgba(10,17,30,0.9)", borderRadius: "14px", padding: "20px", border: rank === 0 ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
                    {rank === 0 && <div style={{ position: "absolute", top: "12px", right: "12px" }}>🏆</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>{a.avatar}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: "#e2eaf4", fontSize: "14px" }}>{a.name}</div>
                        <div style={{ fontSize: "10px", color: "#445566", textTransform: "uppercase", letterSpacing: "0.06em" }}>{a.role}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "Messages", value: a.totalMessages.toLocaleString(), color: "#14b8a6" },
                        { label: "Autonomy", value: `${a.autonomyRate}%`, color: a.autonomyRate > 70 ? "#22c55e" : "#f59e0b" },
                        { label: "Confidence", value: `${a.avgConfidence}%`, color: "#a78bfa" },
                        { label: "Win Rate", value: `${a.conversionRate}%`, color: a.conversionRate > 20 ? "#22c55e" : "#7c9ab8" },
                      ].map(m => (
                        <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "10px" }}>
                          <div style={{ fontSize: "9px", color: "#2d3d50", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{m.label}</div>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    {a.humanTakeovers > 0 && <div style={{ marginTop: "10px", fontSize: "11px", color: "#2d3d50" }}>{a.humanTakeovers} escalation{a.humanTakeovers !== 1 ? "s" : ""} · {a.leadsAssigned} leads</div>}
                  </div>
                ))}
              </div>

              {/* Table */}
              <div style={{ background: "rgba(10,17,30,0.9)", borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "14px" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#14b8a6", letterSpacing: "0.1em", textTransform: "uppercase" }}>Side-by-Side</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "540px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        {["Agent", "Role", "Messages", "Autonomy ↑", "Confidence ↑", "Leads", "Won", "Win Rate ↑"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#2d3d50", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...agentStats].sort((a, b) => b.conversionRate - a.conversionRate).map((a, i) => (
                        <tr key={a.id} style={{ borderBottom: i < agentStats.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}>
                          <td style={{ padding: "11px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: "7px" }}><span style={{ fontSize: "15px" }}>{a.avatar}</span><span style={{ fontWeight: 600, color: "#e2eaf4" }}>{a.name}</span></div></td>
                          <td style={{ padding: "11px 14px", color: "#445566", fontSize: "11px" }}>{a.role}</td>
                          <td style={{ padding: "11px 14px", color: "#14b8a6", fontWeight: 600 }}>{a.totalMessages}</td>
                          <td style={{ padding: "11px 14px" }}><span style={{ color: a.autonomyRate >= 70 ? "#22c55e" : a.autonomyRate >= 40 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>{a.autonomyRate}%</span></td>
                          <td style={{ padding: "11px 14px", color: "#a78bfa", fontWeight: 600 }}>{a.avgConfidence}%</td>
                          <td style={{ padding: "11px 14px", color: "#7c9ab8" }}>{a.leadsAssigned}</td>
                          <td style={{ padding: "11px 14px", color: "#22c55e", fontWeight: 600 }}>{a.leadsWon}</td>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <div style={{ width: "36px", height: "4px", background: "rgba(255,255,255,0.04)", borderRadius: "2px" }}>
                                <div style={{ height: "100%", width: `${Math.min(a.conversionRate, 100)}%`, background: a.conversionRate >= 20 ? "#22c55e" : "#f59e0b", borderRadius: "2px" }} />
                              </div>
                              <span style={{ fontWeight: 700, color: "#e2eaf4" }}>{a.conversionRate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: "12px", padding: "14px 18px" }}>
                <div style={{ fontSize: "12px", color: "#a78bfa", fontWeight: 700, marginBottom: "4px" }}>💡 How to improve agents</div>
                <div style={{ fontSize: "12px", color: "#445566", lineHeight: 1.7 }}>
                  <strong style={{ color: "#7c9ab8" }}>Low autonomy</strong> = agent lacks confidence on common topics — tighten its system prompt. <strong style={{ color: "#7c9ab8" }}>Low win rate</strong> = closing logic needs strengthening. Go to <a href="/agency/agents" style={{ color: "#14b8a6", textDecoration: "none" }}>AI Sales Team</a> to edit prompts, or ask your admin to update the global template.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── D: LOCATIONS BREAKDOWN ── */}
      {tab === "locations" && (
        <div>
          <SectionTitle sub="Performance comparison across all your connected locations">Location Breakdown</SectionTitle>

          {locationBreakdown.length === 0 ? (
            <div style={{ background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "40px", textAlign: "center", color: "#2d3d50" }}>
              {selectedLoc !== "all"
                ? "Switch to 'All Locations' to see the location breakdown."
                : "No location data yet. Connect locations and activate AI to see metrics here."}
            </div>
          ) : (
            <>
              {/* Summary KPIs for all-locations view */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "12px", marginBottom: "24px" }}>
                <KPI icon="📍" label="Total Locations" value={locationBreakdown.length} sub="Connected & tracked" />
                <KPI icon="🔥" label="Total Leads" value={locationBreakdown.reduce((s, l) => s + l.leads, 0).toLocaleString()} sub="Across all locations" color="#f59e0b" />
                <KPI icon="🏆" label="Total Won" value={locationBreakdown.reduce((s, l) => s + l.won, 0).toLocaleString()} sub="Closed deals" color="#22c55e" />
                <KPI icon="💬" label="Total Messages" value={locationBreakdown.reduce((s, l) => s + l.messages, 0).toLocaleString()} sub="AI handled" color="#8b5cf6" />
              </div>

              {/* Location comparison table */}
              <div style={{ background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", overflow: "hidden", marginBottom: "20px" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Location", "AI Messages", "Leads", "Won", "Automation Rate", "Win Rate"].map(h => (
                          <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "#445566", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {locationBreakdown
                        .sort((a, b) => b.leads - a.leads)
                        .map((loc, i) => {
                          const winRate = loc.leads > 0 ? Math.round((loc.won / loc.leads) * 100) : 0;
                          return (
                            <tr key={loc.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: loc.messages > 0 ? "#22c55e" : "#2d3d50", flexShrink: 0 }} />
                                  <span style={{ fontWeight: 600, color: "#e2eaf4" }}>{loc.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#7c9ab8" }}>{loc.messages.toLocaleString()}</td>
                              <td style={{ padding: "12px 16px", color: "#7c9ab8" }}>{loc.leads.toLocaleString()}</td>
                              <td style={{ padding: "12px 16px", color: "#22c55e", fontWeight: 600 }}>{loc.won.toLocaleString()}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <div style={{ width: "60px", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                                    <div style={{ height: "100%", width: `${loc.automationRate}%`, background: loc.automationRate >= 70 ? "#22c55e" : loc.automationRate >= 40 ? "#f59e0b" : "#ef4444", borderRadius: "2px" }} />
                                  </div>
                                  <span style={{ color: loc.automationRate >= 70 ? "#22c55e" : loc.automationRate >= 40 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>{loc.automationRate}%</span>
                                </div>
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <div style={{ width: "60px", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                                    <div style={{ height: "100%", width: `${winRate}%`, background: winRate >= 20 ? "#22c55e" : "#f59e0b", borderRadius: "2px" }} />
                                  </div>
                                  <span style={{ color: "#e2eaf4", fontWeight: 700 }}>{winRate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top performer callout */}
              {locationBreakdown.length > 1 && (() => {
                const top = [...locationBreakdown].sort((a, b) =>
                  (b.leads > 0 ? b.won / b.leads : 0) - (a.leads > 0 ? a.won / a.leads : 0)
                )[0];
                const low = [...locationBreakdown].sort((a, b) => a.automationRate - b.automationRate)[0];
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "12px", padding: "14px 18px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#22c55e", marginBottom: "4px" }}>🏆 Top Performer</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#e2eaf4" }}>{top.name}</div>
                      <div style={{ fontSize: "12px", color: "#445566", marginTop: "4px" }}>
                        Best win rate · {top.won} closed from {top.leads} leads
                      </div>
                    </div>
                    <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "12px", padding: "14px 18px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", marginBottom: "4px" }}>⚠️ Needs Attention</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#e2eaf4" }}>{low.name}</div>
                      <div style={{ fontSize: "12px", color: "#445566", marginTop: "4px" }}>
                        Lowest automation rate · {low.automationRate}% — review AI setup
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
