"use client";

import { useEffect, useState } from "react";

interface Config {
  enabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  aiModel: string;
  maxDelaySec: number;
  minDelaySec: number;
  humanFallbackEnabled: boolean;
  confidenceThreshold: number;
}

interface Location {
  id: string;
  name: string;
}

interface WebhookStatus {
  registered: boolean;
  ghlVerified: boolean;
  ghlWebhookId: string | null;
  url: string;
  expectedUrl: string;
  events: string[];
  lastError: string | null;
}

interface FetchReport {
  step: string;
  status: string;
  detail: string;
  data?: unknown;
}

const AI_MODELS = [
  {
    value: "gpt-4o-mini",
    label: "GPT-4o Mini",
    desc: "Fast & cost-effective. Great for most businesses.",
  },
  {
    value: "gpt-4o",
    label: "GPT-4o",
    desc: "More nuanced. Better for complex sales conversations.",
  },
  {
    value: "gpt-4-turbo",
    label: "GPT-4 Turbo",
    desc: "Maximum intelligence. Best for high-ticket sales.",
  },
];

// ─────────────────────────────────────────────
// Copy Button
// ─────────────────────────────────────────────
function CopyButton({
  text,
  label,
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Clipboard copy failed:", error);
    }
  };

  return (
    <button
      onClick={copy}
      style={{
        padding: "4px 10px",
        borderRadius: "6px",
        border: "1px solid rgba(20,184,166,0.35)",
        background: copied
          ? "rgba(34,197,94,0.1)"
          : "rgba(20,184,166,0.08)",
        color: copied ? "#22c55e" : "#14b8a6",
        fontSize: "11px",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {copied ? "✓ Copied!" : label || "Copy"}
    </button>
  );
}

// ─────────────────────────────────────────────
// Toggle Component
// ─────────────────────────────────────────────
function Toggle({
  value,
  onChange,
  label,
  desc,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid var(--bg-border)",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: desc ? "2px" : 0,
          }}
        >
          {label}
        </div>

        {desc && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            {desc}
          </div>
        )}
      </div>

      <button
        className="toggle-switch"
        onClick={() => onChange(!value)}
      >
        <div className={`toggle-track ${value ? "on" : "off"}`}>
          <div className={`toggle-thumb ${value ? "on" : "off"}`} />
        </div>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function SettingsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [config, setConfig] = useState<Config>({
    enabled: false,
    smsEnabled: true,
    emailEnabled: true,
    aiModel: "gpt-4o-mini",
    maxDelaySec: 3,
    minDelaySec: 1,
    humanFallbackEnabled: true,
    confidenceThreshold: 0.7,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [webhook, setWebhook] = useState<WebhookStatus | null>(null);

  const [webhookLoading, setWebhookLoading] = useState(false);

  const [webhookMsg, setWebhookMsg] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const [webhookGuideOpen, setWebhookGuideOpen] = useState(false);

  const [fetchReport, setFetchReport] = useState<FetchReport[] | null>(
    null
  );

  const [fetchVerdict, setFetchVerdict] = useState("");

  const [fetchLoading, setFetchLoading] = useState(false);

  // ─────────────────────────────────────────────
  // Load Locations
  // ─────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        const locs: Location[] = d.locations || [];

        setLocations(locs);

        if (locs.length > 0) {
          setSelectedId(locs[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // ─────────────────────────────────────────────
  // Load Config + Webhook
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;

    setLoading(true);

    setWebhook(null);
    setFetchReport(null);
    setFetchVerdict("");
    setWebhookMsg(null);

    Promise.all([
      fetch(`/api/automation?locationId=${selectedId}`).then((r) =>
        r.json()
      ),

      fetch(
        `/api/ghl/webhook-settings?locationId=${selectedId}`
      ).then((r) => r.json()),
    ])
      .then(([auto, wh]) => {
        if (auto.config) {
          setConfig(auto.config);
        }

        setWebhook(wh);
      })
      .catch((error) => {
        console.error("Failed loading settings:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedId]);

  // ─────────────────────────────────────────────
  // Register Webhook
  // ─────────────────────────────────────────────
  const registerWebhook = async () => {
    if (!selectedId) return;

    try {
      setWebhookLoading(true);
      setWebhookMsg(null);

      const res = await fetch("/api/ghl/webhook-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationId: selectedId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setWebhookMsg({
          type: "error",
          text: data.error || "Registration failed",
        });

        return;
      }

      setWebhookMsg({
        type: "ok",
        text: `✅ Webhook registered! ID: ${data.webhookId}`,
      });

      const refreshed = await fetch(
        `/api/ghl/webhook-settings?locationId=${selectedId}`
      ).then((r) => r.json());

      setWebhook(refreshed);
    } catch (error) {
      console.error(error);

      setWebhookMsg({
        type: "error",
        text: "Something went wrong while registering webhook.",
      });
    } finally {
      setWebhookLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Fetch Email Test
  // ─────────────────────────────────────────────
  const runFetchTest = async () => {
    if (!selectedId) return;

    try {
      setFetchLoading(true);

      setFetchReport(null);
      setFetchVerdict("");

      const res = await fetch(
        `/api/ghl/fetch-emails?locationId=${selectedId}`
      );

      const data = await res.json();

      setFetchReport(data.report || []);
      setFetchVerdict(data.verdict || "");
    } catch (error) {
      console.error(error);

      setFetchVerdict(
        "❌ Failed to run fetch pipeline diagnostic."
      );
    } finally {
      setFetchLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Save Settings
  // ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedId) return;

    try {
      setSaving(true);

      await fetch("/api/automation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...config,
          locationId: selectedId,
        }),
      });

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────
  // Loading State
  // ─────────────────────────────────────────────
  if (loading && locations.length === 0) {
    return (
      <div style={{ padding: "40px" }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="shimmer"
            style={{
              height: "70px",
              borderRadius: "12px",
              marginBottom: "14px",
            }}
          />
        ))}
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // No Locations
  // ─────────────────────────────────────────────
  if (locations.length === 0) {
    return (
      <div
        style={{
          padding: "clamp(20px,4vw,40px)",
          maxWidth: "640px",
        }}
      >
        <div
          className="glass"
          style={{
            borderRadius: "16px",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "36px",
              marginBottom: "14px",
            }}
          >
            🔧
          </div>

          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            No locations connected
          </h2>

          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "14px",
              marginBottom: "20px",
            }}
          >
            Connect a GoHighLevel account first to configure
            settings.
          </p>

          <a href="/dashboard/locations">
            <button className="btn-primary">
              Connect GHL →
            </button>
          </a>
        </div>
      </div>
    );
  }

  const webhookUrl = webhook?.expectedUrl || "";

  const AI_WORKFLOW_PROMPT =
    "i want outbound emails from ghl to be sent to external app";

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div
      style={{
        padding: "clamp(20px,4vw,40px)",
        maxWidth: "720px",
      }}
    >
      <div
        style={{
          marginBottom: "28px",
        }}
        className="fade-in-up"
      >
        <h1
          style={{
            fontSize: "clamp(22px,4vw,28px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: "6px",
          }}
        >
          Settings
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "14px",
          }}
        >
          Fine-tune how your AI behaves across all channels.
        </p>
      </div>

      {/* EMAIL FETCH REPORT */}
      {fetchReport && fetchReport.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {fetchReport.map((r, i) => {
            const colors: Record<string, string> = {
              ok: "#22c55e",
              fail: "#ef4444",
              warn: "#f59e0b",
              info: "#7c9ab8",
            };

            const color =
              colors[r.status] || "#7c9ab8";

            return (
              <div
                key={i}
                style={{
                  padding: "10px 14px",
                  borderRadius: "9px",
                  background:
                    "rgba(255,255,255,0.02)",
                  border:
                    "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      color,
                      background: `${color}18`,
                      border: `1px solid ${color}30`,
                      borderRadius: "4px",
                      padding: "1px 6px",
                      letterSpacing: "0.06em",
                      flexShrink: 0,
                      marginTop: "1px",
                    }}
                  >
                    {r.status.toUpperCase()}
                  </span>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginBottom: "2px",
                      }}
                    >
                      {r.step}
                    </div>

                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        lineHeight: 1.6,
                      }}
                    >
                      {r.detail}
                    </div>

                    {/* FIXED TYPE ERROR */}
                    {!!r.data &&
                      r.step.includes("sample") && (
                        <pre
                          style={{
                            fontSize: "10px",
                            color: "#445566",
                            marginTop: "6px",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            maxHeight: "160px",
                            overflow: "auto",
                            background:
                              "rgba(0,0,0,0.2)",
                            borderRadius: "6px",
                            padding: "8px",
                          }}
                        >
                          {JSON.stringify(
                            r.data,
                            null,
                            2
                          )}
                        </pre>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SAVE BUTTON */}
      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          justifyContent: "center",
          padding: "15px",
          borderRadius: "12px",
          fontSize: "15px",
          marginTop: "24px",
        }}
      >
        {saving
          ? "Saving…"
          : saved
          ? "✓ Settings Saved!"
          : "💾 Save Settings"}
      </button>
    </div>
  );
}