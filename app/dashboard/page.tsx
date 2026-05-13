"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

interface Stats { totalMessages: number; sentMessages: number; humanFallbacks: number; automationRate: number }
interface Log { id: string; contactId: string; messageType: string; inputMessage: string; aiResponse: string; status: string; humanTookOver: boolean; confidence: number|null; intent: string|null; agentAction: string|null; createdAt: string }
interface UserData { name?: string; plan?: string; status?: string; trialEndsAt?: string; trialMessagesUsed?: number; trialMessagesLimit?: number; messagesUsed?: number; monthlyLimit?: number; locationCount?: number; locationLimit?: number }

function DashboardContent() {
  const params = useSearchParams();
  const upgraded = params.get("upgraded");
  const newPlan = params.get("plan");

  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics").then(r => r.json()),
      fetch("/api/user").then(r => r.json()),
    ]).then(([analyticsData, userData]) => {
      setStats(analyticsData.stats);
      setLogs(analyticsData.recentLogs || []);
      setUserData(userData.user);
      setLoading(false);
    });
  }, []);

  const isTrial = userData?.status === "trialing";
  const trialDaysLeft = userData?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(userData.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;
  const trialPct = userData?.trialMessagesLimit
    ? Math.min(100, Math.round(((userData.trialMessagesUsed || 0) / userData.trialMessagesLimit) * 100))
    : 0;

  const statCards = [
    { label: "Messages Handled", value: stats?.totalMessages ?? 0, icon: "💬", color: "#14b8a6", sub: "Total AI interactions" },
    { label: "Successfully Sent", value: stats?.sentMessages ?? 0, icon: "✅", color: "#22c55e", sub: `${stats?.automationRate ?? 0}% automation rate` },
    { label: "Human Fallbacks", value: stats?.humanFallbacks ?? 0, icon: "👤", color: "#8b5cf6", sub: "Tasks created for team" },
    { label: "Locations Active", value: userData?.locationCount ?? 0, icon: "📍", color: "#f59e0b", sub: `of ${userData?.locationLimit ?? 1} available` },
  ];

  return (
    <div style={{ padding: "clamp(20px,4vw,40px)", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }} className="fade-in-up">
        <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "6px" }}>
          Command Center
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          {userData?.name ? `Welcome back, ${userData.name.split(" ")[0]}.` : "Welcome back."} Your AI is working around the clock.
        </p>
      </div>

      {/* Upgrade success banner */}
      {upgraded && (
        <div className="fade-in-up" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "12px", padding: "14px 20px", marginBottom: "24px", fontSize: "14px", color: "#22c55e", display: "flex", alignItems: "center", gap: "10px" }}>
          🎉 <strong>Upgrade successful!</strong> You&apos;re now on the {newPlan?.charAt(0).toUpperCase()}{newPlan?.slice(1)} plan. All features unlocked.
        </div>
      )}

      {/* Trial warning */}
      {isTrial && !loading && (
        <div className="fade-in-up" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "14px", padding: "18px 22px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b" }}>FREE TRIAL</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>— {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining</span>
              </div>
              <div style={{ height: "6px", borderRadius: "3px", background: "rgba(245,158,11,0.15)", overflow: "hidden", maxWidth: "320px", marginBottom: "6px" }}>
                <div style={{ height: "100%", width: `${trialPct}%`, background: "linear-gradient(90deg,#f59e0b,#fbbf24)", borderRadius: "3px", transition: "width 0.5s ease" }} />
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {userData?.trialMessagesUsed || 0} of {userData?.trialMessagesLimit || 50} messages used
              </div>
            </div>
            <Link href="/pricing">
              <button className="btn-primary" style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)", boxShadow: "0 4px 16px rgba(245,158,11,0.3)", whiteSpace: "nowrap", fontSize: "13px", padding: "10px 20px" }}>
                Upgrade Now →
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* No location setup banner */}
      {!loading && (userData?.locationCount ?? 0) === 0 && (
        <div className="fade-in-up gradient-border" style={{ borderRadius: "14px", padding: "20px 24px", marginBottom: "24px", background: "rgba(20,184,166,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>🔗 Connect your GoHighLevel account</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Add a location to start automating your sales replies.</div>
          </div>
          <Link href="/dashboard/locations">
            <button className="btn-primary">Connect GHL →</button>
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px", marginBottom: "32px" }}>
        {statCards.map((card, i) => (
          <div key={card.label} className={`glass gradient-border fade-in-up fade-in-up-delay-${i + 1}`} style={{ borderRadius: "16px", padding: "22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em" }}>{card.label.toUpperCase()}</span>
              <span style={{ fontSize: "20px" }}>{card.icon}</span>
            </div>
            {loading
              ? <div className="shimmer" style={{ height: "38px", borderRadius: "6px", width: "70px" }} />
              : <div style={{ fontSize: "34px", fontWeight: 800, letterSpacing: "-0.03em", color: card.color, marginBottom: "5px" }}>{card.value.toLocaleString()}</div>
            }
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent AI conversations */}
      <div className="glass fade-in-up" style={{ borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--bg-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Recent AI Conversations</h2>
          <Link href="/dashboard/conversations" style={{ fontSize: "13px", color: "var(--brand)", textDecoration: "none" }}>View all →</Link>
        </div>

        {loading
          ? <div style={{ padding: "20px" }}>{[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: "60px", borderRadius: "10px", marginBottom: "10px" }} />)}</div>
          : logs.length === 0
          ? <div style={{ padding: "56px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              No AI conversations yet. Connect a GHL account and enable automation to get started.
            </div>
          : logs.map((log, i) => (
            <div key={log.id} style={{ padding: "14px 22px", borderBottom: i < logs.length - 1 ? "1px solid var(--bg-border)" : "none", display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "20px", alignItems: "start", transition: "background 0.15s ease" }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "var(--bg-card)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
              {/* Input */}
              <div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ background: log.messageType === "SMS" ? "rgba(20,184,166,0.15)" : "rgba(139,92,246,0.15)", color: log.messageType === "SMS" ? "var(--brand)" : "#8b5cf6", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>{log.messageType}</span>
                  {log.intent && <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-surface)", padding: "2px 6px", borderRadius: "4px" }}>{log.intent}</span>}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{log.inputMessage.slice(0, 80)}{log.inputMessage.length > 80 ? "…" : ""}</div>
              </div>
              {/* Reply */}
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>AI REPLY {log.agentAction && `· ${log.agentAction.replace("_"," ")}`}</div>
                <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.4 }}>{log.aiResponse.slice(0, 80)}{log.aiResponse.length > 80 ? "…" : ""}</div>
              </div>
              {/* Meta */}
              <div style={{ textAlign: "right", minWidth: "90px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", padding: "3px 7px", borderRadius: "5px", marginBottom: "4px", background: log.humanTookOver ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)", color: log.humanTookOver ? "#f59e0b" : "#22c55e" }}>
                  {log.humanTookOver ? "👤 Human" : "🤖 Sent"}
                </span>
                <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{formatRelativeTime(log.createdAt)}</div>
                {log.confidence != null && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{Math.round(log.confidence * 100)}% conf</div>}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>;
}
