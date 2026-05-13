"use client";
import { useState, useEffect } from "react";

interface Location {
  id: string;
  name: string;
  ghlLocationId: string;
}

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
  pass: { icon: "✓", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", label: "PASS" },
  fail: { icon: "✗", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", label: "FAIL" },
  warn: { icon: "⚠", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", label: "WARN" },
  skip: { icon: "–", color: "#64748b", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.15)", label: "SKIP" },
};

export default function DiagnosePage() {
  const [locations, setLocations]   = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState("");
  const [running, setRunning]       = useState(false);
  const [result, setResult]         = useState<DiagResult | null>(null);
  const [error, setError]           = useState("");
  const [expanded, setExpanded]     = useState<number | null>(null);

  // Load locations
  useEffect(() => {
    fetch("/api/locations")
      .then(r => r.json())
      .then(d => {
        const locs = d.locations || [];
        setLocations(locs);
        if (locs.length > 0) setSelectedLoc(locs[0].id);
      })
      .catch(() => setError("Could not load locations"));
  }, []);

  const runDiagnostic = async () => {
    if (!selectedLoc) return;
    setRunning(true);
    setResult(null);
    setError("");
    setExpanded(null);

    try {
      const res = await fetch("/api/ghl/diagnose", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: selectedLoc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Diagnostic failed");
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  };

  const allPass = result && result.summary.failed === 0 && result.summary.warned === 0;
  const hasFailures = result && result.summary.failed > 0;

  return (
    <div style={{
      minHeight:  "100vh",
      background: "#080d18",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      color:      "#c8d8e8",
      padding:    "clamp(20px, 4vw, 48px)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e3040; border-radius: 3px; }
        @keyframes scan {
          0%   { transform: translateY(-100%); opacity: 0.15; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-green { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.3)} 50%{box-shadow:0 0 0 8px rgba(34,197,94,0)} }
        .test-card { transition: background 0.15s; cursor: pointer; }
        .test-card:hover { filter: brightness(1.05); }
        .run-btn {
          transition: all 0.2s;
          cursor: pointer;
        }
        .run-btn:hover:not(:disabled) {
          background: #14b8a6 !important;
          color: #080d18 !important;
        }
        .run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .select-box {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px !important;
        }
      `}</style>

      {/* Scanline effect */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 0, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0, height: "2px",
          background: "linear-gradient(transparent, rgba(20,184,166,0.08), transparent)",
          animation: "scan 8s linear infinite",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: running ? "#f59e0b" : result ? (allPass ? "#22c55e" : "#ef4444") : "#14b8a6",
              animation: running ? "pulse-green 1s infinite" : "none",
            }} />
            <span style={{ fontSize: "11px", color: "#445566", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              NexusReply Diagnostic
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(22px, 4vw, 32px)",
            fontWeight: 700,
            color: "#e2eaf4",
            margin: "0 0 6px",
            letterSpacing: "-0.02em",
          }}>
            GHL Email Pipeline Test
          </h1>
          <p style={{ color: "#445566", fontSize: "13px", margin: 0 }}>
            Live test using your stored credentials — no manual input required.
          </p>
        </div>

        {/* Controls */}
        <div style={{
          background: "rgba(10,20,35,0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={{ fontSize: "10px", color: "#445566", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Location
            </label>
            <select
              className="select-box"
              value={selectedLoc}
              onChange={e => setSelectedLoc(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#c8d8e8",
                fontSize: "13px",
                fontFamily: "inherit",
                outline: "none",
              }}
            >
              {locations.length === 0 && <option value="">No locations found</option>}
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <button
            className="run-btn"
            onClick={async () => {
              if (!selectedLoc) return;
              const r = await fetch("/api/ghl/bootstrap", {
                method: "POST", headers: {"Content-Type":"application/json"},
                body: JSON.stringify({ locationId: selectedLoc }),
              });
              const d = await r.json();
              alert("Bootstrap complete:\n\n" + (d.steps || [d.error]).join("\n"));
            }}
            style={{
              padding: "9px 18px", background: "transparent",
              border: "1px solid rgba(20,184,166,0.3)", borderRadius: "8px",
              color: "#14b8a6", fontSize: "13px", fontWeight: 600,
              fontFamily: "inherit", cursor: "pointer", marginTop: "20px",
            }}
          >
            ⚡ Bootstrap Location
          </button>

          <button
            className="run-btn"
            onClick={async () => {
              if (!selectedLoc) return;
              const r = await fetch("/api/ghl/test-conversation", {
                method: "POST", headers: {"Content-Type":"application/json"},
                body: JSON.stringify({ locationId: selectedLoc, testMessage: "Hi, I am interested in your services", send: false }),
              });
              const d = await r.json();
              const checks = Object.values(d.checks || {}).join("\n");
              alert(`Conversation Test:\n\nAgent: ${d.summary?.agentUsed || "none"}\nDecision: ${d.summary?.decision?.intent || "n/a"} / ${d.summary?.decision?.action || "n/a"}\nConfidence: ${d.summary?.decision?.confidence || 0}\n\nAI Reply:\n"${d.summary?.aiReply || "(none)"}"\n\nChecks:\n${checks}`);
            }}
            style={{
              padding: "9px 18px", background: "transparent",
              border: "1px solid rgba(167,139,250,0.3)", borderRadius: "8px",
              color: "#a78bfa", fontSize: "13px", fontWeight: 600,
              fontFamily: "inherit", cursor: "pointer", marginTop: "20px",
            }}
          >
            🤖 Test AI Reply
          </button>

          <button
            className="run-btn"
            onClick={runDiagnostic}
            disabled={running || !selectedLoc}
            style={{
              padding: "9px 24px",
              background: "transparent",
              border: "1px solid #14b8a6",
              borderRadius: "8px",
              color: "#14b8a6",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "inherit",
              letterSpacing: "0.04em",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "20px",
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
            ) : (
              <>▶ Run Diagnostic</>
            )}
          </button>
        </div>

        {/* How to use tip */}
        {!result && !running && (
          <div style={{
            background: "rgba(20,184,166,0.04)",
            border: "1px solid rgba(20,184,166,0.12)",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "24px",
            fontSize: "12px",
            color: "#445566",
            lineHeight: 1.7,
          }}>
            <div style={{ color: "#14b8a6", fontWeight: 600, marginBottom: "6px" }}>
              ⟩ Before running:
            </div>
            <div>1. Have a lead reply to one of your sent emails in GoHighLevel.</div>
            <div>2. Select the location above and click Run Diagnostic.</div>
            <div>3. Test 5 confirms the email body can be fetched from GHL.</div>
            <div>4. Test 7 confirms the full end-to-end flow: email → webhook → AI agent → reply sent.</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "20px",
            color: "#ef4444",
            fontSize: "13px",
          }}>
            ✗ {error}
          </div>
        )}

        {/* Summary bar */}
        {result && (
          <div style={{
            animation: "fadeIn 0.3s ease",
            background: allPass
              ? "rgba(34,197,94,0.06)"
              : hasFailures
                ? "rgba(239,68,68,0.06)"
                : "rgba(245,158,11,0.06)",
            border: `1px solid ${allPass ? "rgba(34,197,94,0.2)" : hasFailures ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
            borderRadius: "10px",
            padding: "14px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: allPass ? "#22c55e" : hasFailures ? "#ef4444" : "#f59e0b" }}>
                {allPass ? "✓ All tests passed — email pipeline is working" :
                 hasFailures ? "✗ Issues found — see details below" :
                 "⚠ Warnings found — pipeline may work with fallback"}
              </div>
              <div style={{ fontSize: "11px", color: "#445566", marginTop: "3px" }}>
                Location: {result.location.name} · GHL ID: {result.location.ghlLocationId}
              </div>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
              {[
                { label: "PASS", count: result.summary.passed, color: "#22c55e" },
                { label: "FAIL", count: result.summary.failed, color: "#ef4444" },
                { label: "WARN", count: result.summary.warned, color: "#f59e0b" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: s.color }}>{s.count}</div>
                  <div style={{ color: "#445566", letterSpacing: "0.08em" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test results */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", animation: "fadeIn 0.4s ease" }}>
            {result.results.map((test, i) => {
              const cfg = STATUS_CONFIG[test.status];
              const isOpen = expanded === i;

              return (
                <div
                  key={i}
                  className="test-card"
                  onClick={() => setExpanded(isOpen ? null : i)}
                  style={{
                    background: isOpen ? cfg.bg : "rgba(10,20,35,0.8)",
                    border: `1px solid ${isOpen ? cfg.border : "rgba(255,255,255,0.06)"}`,
                    borderRadius: "10px",
                    overflow: "hidden",
                    transition: "all 0.2s",
                  }}
                >
                  {/* Row */}
                  <div style={{
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}>
                    {/* Status badge */}
                    <div style={{
                      width: "48px",
                      height: "22px",
                      borderRadius: "4px",
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      fontWeight: 700,
                      color: cfg.color,
                      letterSpacing: "0.08em",
                      flexShrink: 0,
                    }}>
                      {cfg.label}
                    </div>

                    {/* Name + message */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#c8d8e8", marginBottom: "2px" }}>
                        {test.name}
                      </div>
                      <div style={{
                        fontSize: "11px",
                        color: test.status === "fail" ? "#ef4444" : test.status === "warn" ? "#f59e0b" : "#445566",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {test.message}
                      </div>
                    </div>

                    {/* Expand arrow */}
                    {test.data && (
                      <div style={{
                        color: "#2d3d50",
                        fontSize: "12px",
                        transition: "transform 0.2s",
                        transform: isOpen ? "rotate(180deg)" : "none",
                        flexShrink: 0,
                      }}>
                        ▾
                      </div>
                    )}
                  </div>

                  {/* Expanded data */}
                  {isOpen && test.data && (
                    <div style={{
                      borderTop: `1px solid ${cfg.border}`,
                      padding: "14px 18px",
                      background: "rgba(0,0,0,0.3)",
                    }}>
                      <div style={{ fontSize: "10px", color: "#445566", marginBottom: "8px", letterSpacing: "0.08em" }}>
                        RAW DATA
                      </div>
                      <pre style={{
                        margin: 0,
                        fontSize: "11px",
                        color: "#7c9ab8",
                        fontFamily: "inherit",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        lineHeight: 1.7,
                      }}>
                        {JSON.stringify(test.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Fix guide shown if any failures */}
        {result && hasFailures && (
          <div style={{
            marginTop: "24px",
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: "12px",
            padding: "20px",
            animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444", marginBottom: "14px", letterSpacing: "0.06em" }}>
              ⟩ WHAT TO FIX
            </div>
            {result.results.filter(r => r.status === "fail").map((r, i) => (
              <div key={i} style={{ marginBottom: "12px", fontSize: "12px", color: "#7c9ab8", lineHeight: 1.7 }}>
                <span style={{ color: "#ef4444" }}>✗ {r.name}:</span>
                <br />
                {r.name.includes("Token") && "→ Reconnect your GHL integration in Settings → GHL Connection. Your API key may be expired or revoked."}
                {r.name.includes("Location") && "→ Verify the Location ID in Settings matches the one in GHL Dashboard → Settings → Business Info."}
                {r.name.includes("Conversation") && "→ Check your API key has the 'conversations.readonly' scope in GHL. Try regenerating the key."}
                {r.name.includes("Message") && "→ Ensure you have at least one conversation with messages in this GHL location."}
                {r.name.includes("Email body") && "→ The email message ID from GHL is invalid. Send a fresh email to a lead and have them reply, then re-run."}
                {r.name.includes("Webhook") && "→ Auto-registration was attempted. If it failed, go to GoHighLevel → Settings → Integrations → Webhooks. Add your webhook URL and select InboundMessage, ContactCreate, ContactUpdate, ConversationCreate events."}
                {r.name.includes("AI email flow") && "→ Email webhook events are arriving but the AI is not processing them. Check that your /api/ai/process route is reachable and that automation is enabled for this location in Settings."}
              </div>
            ))}
          </div>
        )}

        {/* Success guide */}
        {result && allPass && (
          <div style={{
            marginTop: "24px",
            background: "rgba(34,197,94,0.05)",
            border: "1px solid rgba(34,197,94,0.15)",
            borderRadius: "12px",
            padding: "20px",
            fontSize: "12px",
            color: "#445566",
            lineHeight: 1.8,
            animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ color: "#22c55e", fontWeight: 700, marginBottom: "10px" }}>
              ✓ Email pipeline fully operational
            </div>
            <div>Your app can:</div>
            <div style={{ marginLeft: "12px" }}>
              <div>✓ Token valid and GHL connection live</div>
              <div>✓ Conversations and messages accessible</div>
              <div>✓ Email body fetched via GHL API</div>
              <div>✓ Webhook registered and receiving events</div>
              <div>✓ AI agent processed emails and sent replies</div>
            </div>
            <div style={{ marginTop: "10px", color: "#2d3d50" }}>
              Cron sync at /api/cron/sync runs every minute — any email the webhook misses is caught automatically.
            </div>
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
