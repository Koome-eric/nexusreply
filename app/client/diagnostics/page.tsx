"use client";
import { useState, useEffect } from "react";
import { useClientContext } from "../ClientProvider";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  data?: Record<string, unknown>;
}

interface DiagResult {
  results: TestResult[];
  summary: { passed: number; failed: number; warned: number; total: number };
  location: { name: string; ghlLocationId: string };
}

const STATUS_CONFIG = {
  pass: { icon: "✓", color: "#22c55e", bg: "rgba(34,197,94,0.08)",    border: "rgba(34,197,94,0.2)",    label: "PASS" },
  fail: { icon: "✗", color: "#ef4444", bg: "rgba(239,68,68,0.08)",    border: "rgba(239,68,68,0.2)",    label: "FAIL" },
  warn: { icon: "⚠", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",   border: "rgba(245,158,11,0.2)",   label: "WARN" },
  skip: { icon: "–", color: "#64748b", bg: "rgba(100,116,139,0.06)",  border: "rgba(100,116,139,0.15)", label: "SKIP" },
};

const FIX_HINTS: Record<string, string> = {
  "Token":        "→ Ask your account manager to reconnect the GHL integration — your API key may be expired or revoked.",
  "Location":     "→ Ask your account manager to verify the Location ID in Settings matches the one in GoHighLevel.",
  "Conversation": "→ Check with your account manager that the API key has the conversations.readonly scope in GHL.",
  "Message":      "→ Make sure there is at least one conversation with messages in this GHL location.",
  "Email body":   "→ Send a fresh email to a lead, have them reply, then re-run the diagnostic.",
  "Webhook":      "→ The diagnostic tried to auto-register the webhook but GHL rejected it. Ask your account manager to manually add it in GHL → Settings → Integrations → Webhooks.",
  "Email reply fetch": "→ The sync path (cron job) is skipping email replies because GHL returns empty body in the messages list. The fix is in ghl-sync.ts — see the code patch provided.",
  "Contact data": "→ The conversation cache is missing contact details. This is a known issue with searchGHLConversations not fetching contact info. Apply the ghl-sync.ts patch to fix.",
};

// Tests marked as "critical" get a highlighted border
const CRITICAL_TESTS = ["8.", "8a."];

export default function ClientDiagnosticsPage() {
  const { locationId, locationName } = useClientContext();

  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState<DiagResult | null>(null);
  const [error,    setError]    = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [lastRun,  setLastRun]  = useState<string | null>(null);

  useEffect(() => { runDiagnostic(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runDiagnostic = async () => {
    setRunning(true);
    setResult(null);
    setError("");
    setExpanded(null);

    try {
      const res = await fetch("/api/ghl/diagnose", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Diagnostic failed");
      setResult(data);
      setLastRun(new Date().toLocaleTimeString());
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  };

  const allPass     = result && result.summary.failed === 0 && result.summary.warned === 0;
  const hasFailures = result && result.summary.failed > 0;
  const hasWarnings = result && result.summary.warned > 0 && !hasFailures;

  const overallStatus = !result ? "idle"
    : allPass     ? "pass"
    : hasFailures ? "fail"
    : "warn";

  const statusDot = { idle: "#14b8a6", pass: "#22c55e", fail: "#ef4444", warn: "#f59e0b" }[overallStatus];

  // Separate critical tests from standard tests for display
  const criticalResults = result?.results.filter(r => CRITICAL_TESTS.some(p => r.name.startsWith(p))) ?? [];
  const standardResults = result?.results.filter(r => !CRITICAL_TESTS.some(p => r.name.startsWith(p))) ?? [];

  return (
    <div style={{
      minHeight:  "100vh",
      background: "#080d18",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      color:      "#c8d8e8",
      padding:    "clamp(20px, 4vw, 40px)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e3040; border-radius: 3px; }
        @keyframes scan {
          0%   { transform: translateY(-100%); opacity: 0.12; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,0.35)} 50%{box-shadow:0 0 0 10px rgba(20,184,166,0)} }
        @keyframes pulse-green  { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.3)} 50%{box-shadow:0 0 0 8px rgba(34,197,94,0)} }
        @keyframes pulse-red    { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
        @keyframes criticalGlow { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.15)} 50%{box-shadow:0 0 16px rgba(239,68,68,0.12)} }
        .test-card { transition: all 0.15s; }
        .test-card.clickable { cursor: pointer; }
        .test-card.clickable:hover { filter: brightness(1.06); }
        .run-btn { transition: all 0.2s; cursor: pointer; }
        .run-btn:hover:not(:disabled) { background: #14b8a6 !important; color: #080d18 !important; }
        .run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .critical-section { animation: criticalGlow 3s ease infinite; }
      `}</style>

      {/* Scanline */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, right: 0, height: "2px",
          background: "linear-gradient(transparent, rgba(20,184,166,0.07), transparent)",
          animation: "scan 9s linear infinite",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "820px", margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: running ? "#f59e0b" : statusDot,
              animation: running
                ? "pulse 1s infinite"
                : overallStatus === "pass" ? "pulse-green 3s infinite"
                : overallStatus === "fail" ? "pulse-red 2s infinite"
                : "none",
              transition: "background 0.4s",
            }} />
            <span style={{ fontSize: "11px", color: "#445566", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {locationName} · Connection Health
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: "#e2eaf4", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            GHL Pipeline Diagnostic
          </h1>
          <p style={{ color: "#445566", fontSize: "13px", margin: 0 }}>
            Live checks against your GoHighLevel account — including the email reply fetch path.
          </p>
        </div>

        {/* ── Status hero card ── */}
        <div style={{
          background:   "rgba(10,20,35,0.9)",
          border:       `1px solid ${running ? "rgba(20,184,166,0.2)" : overallStatus === "pass" ? "rgba(34,197,94,0.2)" : overallStatus === "fail" ? "rgba(239,68,68,0.2)" : overallStatus === "warn" ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)"}`,
          borderRadius: "14px",
          padding:      "22px 24px",
          marginBottom: "20px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
          flexWrap:     "wrap",
          gap:          "16px",
          animation:    "fadeIn 0.3s ease",
        }}>
          <div>
            <div style={{ fontSize: "13px", color: "#445566", marginBottom: "6px" }}>Current Status</div>
            <div style={{
              fontSize: "18px", fontWeight: 700,
              color: running ? "#f59e0b" : overallStatus === "pass" ? "#22c55e" : overallStatus === "fail" ? "#ef4444" : overallStatus === "warn" ? "#f59e0b" : "#445566",
            }}>
              {running ? "Running checks…"
                : !result ? "Not yet run"
                : allPass ? "✓ All Systems Operational"
                : hasFailures ? "✗ Issues Detected"
                : "⚠ Warnings Present"}
            </div>
            {lastRun && !running && (
              <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "4px" }}>Last checked at {lastRun}</div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {result && (
              <div style={{ display: "flex", gap: "12px" }}>
                {[
                  { label: "PASS", count: result.summary.passed, color: "#22c55e" },
                  { label: "FAIL", count: result.summary.failed, color: "#ef4444" },
                  { label: "WARN", count: result.summary.warned, color: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "22px", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
                    <div style={{ fontSize: "9px", color: "#445566", letterSpacing: "0.1em", marginTop: "2px" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <button
              className="run-btn"
              onClick={runDiagnostic}
              disabled={running}
              style={{
                padding:      "9px 22px",
                background:   "transparent",
                border:       "1px solid #14b8a6",
                borderRadius: "8px",
                color:        "#14b8a6",
                fontSize:     "13px",
                fontWeight:   600,
                fontFamily:   "inherit",
                letterSpacing: "0.04em",
                display:      "flex",
                alignItems:   "center",
                gap:          "8px",
              }}
            >
              {running ? (
                <>
                  <div style={{
                    width: "12px", height: "12px",
                    border: "2px solid rgba(20,184,166,0.3)",
                    borderTop: "2px solid #14b8a6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Running…
                </>
              ) : <>▶ Re-run</>}
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "10px", padding: "14px 18px", marginBottom: "20px",
            color: "#ef4444", fontSize: "13px",
          }}>
            ✗ {error}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {running && !result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} style={{
                background: "rgba(10,20,35,0.8)", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "10px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px",
              }}>
                <div style={{ width: "48px", height: "22px", borderRadius: "4px", background: "rgba(255,255,255,0.04)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: "12px", width: `${50 + i * 6}%`, background: "rgba(255,255,255,0.04)", borderRadius: "4px", marginBottom: "6px" }} />
                  <div style={{ height: "10px", width: "40%",            background: "rgba(255,255,255,0.03)", borderRadius: "4px" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Test results ── */}
        {result && (
          <div style={{ animation: "fadeIn 0.35s ease" }}>

            {/* Standard tests 1–7 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {standardResults.map((test, i) => <TestCard key={i} test={test} index={i} expanded={expanded} setExpanded={setExpanded} />)}
            </div>

            {/* Critical section: Test 8 */}
            {criticalResults.length > 0 && (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  marginBottom: "10px", marginTop: "8px",
                }}>
                  <div style={{ height: "1px", flex: 1, background: "rgba(239,68,68,0.2)" }} />
                  <span style={{
                    fontSize: "9px", color: "#ef4444", letterSpacing: "0.15em",
                    fontWeight: 700, textTransform: "uppercase",
                  }}>★ Critical: Email Reply Fetch Path</span>
                  <div style={{ height: "1px", flex: 1, background: "rgba(239,68,68,0.2)" }} />
                </div>
                <div
                  className="critical-section"
                  style={{
                    display: "flex", flexDirection: "column", gap: "8px",
                    border: "1px solid rgba(239,68,68,0.12)", borderRadius: "12px",
                    padding: "12px",
                    background: "rgba(239,68,68,0.02)",
                  }}
                >
                  {criticalResults.map((test, i) => (
                    <TestCard
                      key={`c${i}`}
                      test={test}
                      index={standardResults.length + i}
                      expanded={expanded}
                      setExpanded={setExpanded}
                      isCritical
                    />
                  ))}
                </div>

                {/* Explanation callout */}
                <div style={{
                  marginTop: "12px",
                  background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)",
                  borderRadius: "10px", padding: "14px 18px",
                  fontSize: "11px", color: "#7c9ab8", lineHeight: 1.8,
                }}>
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>Why this test exists: </span>
                  When a lead replies to an email, GHL fires a webhook with an empty <code style={{ color: "#c8d8e8" }}>body</code> field — the real content lives at
                  {" "}<code style={{ color: "#c8d8e8" }}>GET /conversations/messages/email/:id</code>.
                  The cron sync job (<code style={{ color: "#c8d8e8" }}>ghl-sync.ts</code>) reads <code style={{ color: "#c8d8e8" }}>m.body</code> directly and skips
                  the email entirely because it&apos;s blank. This test simulates that exact path to confirm whether your email replies are being silently dropped.
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Fix guide (failures) ── */}
        {result && hasFailures && (
          <div style={{
            marginTop: "24px",
            background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: "12px", padding: "20px", animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444", marginBottom: "14px", letterSpacing: "0.06em" }}>
              ⟩ WHAT TO FIX
            </div>
            {result.results.filter(r => r.status === "fail").map((r, i) => {
              const hint = Object.entries(FIX_HINTS).find(([k]) => r.name.includes(k))?.[1] ?? "→ Contact your account manager for assistance.";
              return (
                <div key={i} style={{ marginBottom: "12px", fontSize: "12px", color: "#7c9ab8", lineHeight: 1.7 }}>
                  <span style={{ color: "#ef4444" }}>✗ {r.name}:</span><br />
                  {hint}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Warning guide ── */}
        {result && hasWarnings && (
          <div style={{
            marginTop: "24px",
            background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)",
            borderRadius: "12px", padding: "20px", animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b", marginBottom: "14px", letterSpacing: "0.06em" }}>
              ⟩ WARNINGS
            </div>
            {result.results.filter(r => r.status === "warn").map((r, i) => {
              const hint = Object.entries(FIX_HINTS).find(([k]) => r.name.includes(k))?.[1] ?? "→ Contact your account manager if this persists.";
              return (
                <div key={i} style={{ marginBottom: "12px", fontSize: "12px", color: "#7c9ab8", lineHeight: 1.7 }}>
                  <span style={{ color: "#f59e0b" }}>⚠ {r.name}:</span><br />
                  {hint}
                </div>
              );
            })}
            <div style={{ marginTop: "4px", fontSize: "11px", color: "#2d3d50" }}>
              Warnings don&apos;t prevent the AI from working — the fallback sync handles them automatically.
            </div>
          </div>
        )}

        {/* ── All pass ── */}
        {result && allPass && (
          <div style={{
            marginTop: "24px",
            background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)",
            borderRadius: "12px", padding: "20px",
            fontSize: "12px", color: "#445566", lineHeight: 1.8,
            animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ color: "#22c55e", fontWeight: 700, marginBottom: "10px" }}>
              ✓ Email &amp; SMS pipeline fully operational
            </div>
            <div style={{ marginLeft: "12px" }}>
              <div>✓ Authentication with GoHighLevel is active</div>
              <div>✓ Your location is reachable and confirmed</div>
              <div>✓ Conversations can be listed and read</div>
              <div>✓ Email body fetch is working correctly</div>
              <div>✓ Email replies are being fetched via the sync path</div>
              <div>✓ Contact details are cached in the conversation cache</div>
              <div>✓ Inbound lead replies will reach the AI agents</div>
            </div>
          </div>
        )}

        {/* ── Tip ── */}
        {!result && !running && !error && (
          <div style={{
            marginTop: "20px",
            background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.1)",
            borderRadius: "10px", padding: "16px 20px",
            fontSize: "12px", color: "#445566", lineHeight: 1.7,
          }}>
            <div style={{ color: "#14b8a6", fontWeight: 600, marginBottom: "6px" }}>⟩ How to use</div>
            <div>1. Have a lead reply to one of your sent emails in GoHighLevel.</div>
            <div>2. Click <strong style={{ color: "#c8d8e8" }}>▶ Re-run</strong> to check the pipeline.</div>
            <div>3. Test 8 is the critical check — it simulates the exact path the cron sync uses to fetch email bodies.</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "36px", fontSize: "10px", color: "#1e3040", textAlign: "center" }}>
          NexusReply · GHL Diagnostic · Tests run against live GoHighLevel API
        </div>
      </div>
    </div>
  );
}

// ── TestCard sub-component ──────────────────────────────────────────
function TestCard({
  test,
  index,
  expanded,
  setExpanded,
  isCritical = false,
}: {
  test: TestResult;
  index: number;
  expanded: number | null;
  setExpanded: (i: number | null) => void;
  isCritical?: boolean;
}) {
  const cfg    = STATUS_CONFIG[test.status];
  const isOpen = expanded === index;

  return (
    <div
      className={`test-card${test.data ? " clickable" : ""}`}
      onClick={() => test.data && setExpanded(isOpen ? null : index)}
      style={{
        background:   isOpen ? cfg.bg : "rgba(10,20,35,0.8)",
        border:       `1px solid ${isOpen ? cfg.border : isCritical && test.status === "fail" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "10px",
        overflow:     "hidden",
        transition:   "all 0.2s",
        cursor:       test.data ? "pointer" : "default",
      }}
    >
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Status badge */}
        <div style={{
          width: "48px", height: "22px", borderRadius: "4px",
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "9px", fontWeight: 700, color: cfg.color, letterSpacing: "0.08em",
          flexShrink: 0,
        }}>
          {cfg.label}
        </div>

        {/* Name + message */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#c8d8e8", marginBottom: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
            {test.name}
            {isCritical && <span style={{ fontSize: "9px", color: "#ef4444", letterSpacing: "0.06em" }}>★ CRITICAL</span>}
          </div>
          <div style={{
            fontSize: "11px",
            color: test.status === "fail" ? "#ef4444" : test.status === "warn" ? "#f59e0b" : "#445566",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {test.message}
          </div>
        </div>

        {/* Expand chevron */}
        {test.data && (
          <div style={{
            color: "#2d3d50", fontSize: "12px",
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "none",
            flexShrink: 0,
          }}>▾</div>
        )}
      </div>

      {/* Raw data drawer */}
      {isOpen && test.data && (
        <div style={{
          borderTop: `1px solid ${cfg.border}`,
          padding:   "14px 18px",
          background: "rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: "10px", color: "#445566", marginBottom: "8px", letterSpacing: "0.08em" }}>
            DETAIL
          </div>
          <pre style={{
            margin: 0, fontSize: "11px", color: "#7c9ab8",
            fontFamily: "inherit", whiteSpace: "pre-wrap",
            wordBreak: "break-all", lineHeight: 1.7,
          }}>
            {JSON.stringify(test.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
