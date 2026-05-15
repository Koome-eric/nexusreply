"use client";

import { useEffect, useState, useCallback } from "react";
import { useClientContext } from "../ClientProvider";

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

interface WebhookStatus {
  webhookUrl: string;
  ghlLocationId: string;
  locationName: string;
  webhookEvents: string[];
  registration: {
    isActive: boolean;
    ghlWebhookId: string | null;
    lastError: string | null;
    events: string[];
    url: string;
  } | null;
}

export default function ClientSettingsPage() {
  const { locationId } = useClientContext();

  const [config, setConfig] = useState<Config>({
    enabled: false,
    smsEnabled: true,
    emailEnabled: true,
    aiModel: "gpt-4o-mini",
    maxDelaySec: 3,
    minDelaySec: 1,
    humanFallbackEnabled: true,
    confidenceThreshold: 0.7
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Webhook states
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [webhookRetrying, setWebhookRetrying] = useState(false);
  const [webhookRetryResult, setWebhookRetryResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [confirmingManual, setConfirmingManual] = useState(false);
  const [manualConfirmed, setManualConfirmed] = useState(false);

  const [copied, setCopied] = useState<"url" | "locId" | null>(null);

  useEffect(() => {
    loadSettings();
    loadWebhookStatus();
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/client/automation");
      const data = await res.json();
      if (data.config) setConfig(data.config);
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookStatus = useCallback(async () => {
    try {
      setWebhookLoading(true);
      // Pass locationId so the API can resolve correctly for client role
      const res = await fetch(`/api/ghl/webhook-setup?locationId=${encodeURIComponent(locationId)}`);
      const data = await res.json();
      setWebhookStatus(data);
    } catch (err) {
      console.error("Failed to load webhook status", err);
    } finally {
      setWebhookLoading(false);
    }
  }, [locationId]);

  const retryWebhookRegistration = async () => {
    try {
      setWebhookRetrying(true);
      setWebhookRetryResult(null);

      const res = await fetch("/api/ghl/webhook-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", locationId }),
      });

      const data = await res.json();

      if (data.success) {
        setWebhookRetryResult({
          success: true,
          message: `✅ Webhook registered successfully. ID: ${data.webhookId}`,
        });
      } else {
        setWebhookRetryResult({
          success: false,
          message: data.error || "Auto-registration failed — use the manual guide below.",
        });
      }

      await loadWebhookStatus();
    } catch (err) {
      setWebhookRetryResult({ success: false, message: "Unexpected error while retrying." });
    } finally {
      setWebhookRetrying(false);
    }
  };

  const confirmManualWebhook = async () => {
    try {
      setConfirmingManual(true);
      const res = await fetch("/api/ghl/webhook-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-active", locationId }),
      });
      const data = await res.json();
      if (data.success) {
        setManualConfirmed(true);
        await loadWebhookStatus();
      }
    } catch { /* ignore */ } finally {
      setConfirmingManual(false);
    }
  };

  const copyToClipboard = async (
    text: string,
    type: "url" | "locId"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);

      setTimeout(() => {
        setCopied(null);
      }, 2000);
    } catch (err) {
      console.error("Clipboard failed", err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await fetch("/api/client/automation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({
    value,
    onChange,
    label,
    desc,
  }: {
    value: boolean;
    onChange: (v: boolean) => void;
    label: string;
    desc?: string;
  }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#e2eaf4",
            marginBottom: desc ? "2px" : 0,
          }}
        >
          {label}
        </div>

        {desc && (
          <div
            style={{
              fontSize: "12px",
              color: "#7c9ab8",
            }}
          >
            {desc}
          </div>
        )}
      </div>

      <button
        onClick={() => onChange(!value)}
        style={{
          width: "44px",
          height: "24px",
          borderRadius: "12px",
          border: "none",
          background: value ? "#14b8a6" : "rgba(255,255,255,0.1)",
          position: "relative",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <div
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "white",
            position: "absolute",
            top: "3px",
            left: value ? "23px" : "3px",
            transition: "all 0.2s",
          }}
        />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div style={{ padding: "40px" }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: "70px",
              borderRadius: "12px",
              marginBottom: "14px",
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "clamp(20px,4vw,40px)",
        maxWidth: "700px",
      }}
    >
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "clamp(22px,4vw,28px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: "6px",
            color: "#e2eaf4",
          }}
        >
          Settings
        </h1>

        <p
          style={{
            color: "#7c9ab8",
            fontSize: "14px",
          }}
        >
          Control how your AI sales team communicates with leads.
        </p>
      </div>

      {/* AUTOMATION CHANNELS */}
      <div
        style={{
          background: "rgba(13,21,37,0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#14b8a6",
            letterSpacing: "0.06em",
            marginBottom: "14px",
          }}
        >
          AUTOMATION CHANNELS
        </div>

        <Toggle
          value={config.smsEnabled}
          onChange={(v) =>
            setConfig({
              ...config,
              smsEnabled: v,
            })
          }
          label="SMS Automation"
          desc="Allow AI to send text messages to leads"
        />

        <Toggle
          value={config.emailEnabled}
          onChange={(v) =>
            setConfig({
              ...config,
              emailEnabled: v,
            })
          }
          label="Email Automation"
          desc="Allow AI to send emails to leads"
        />
      </div>

      {/* AI BEHAVIOR */}
      <div
        style={{
          background: "rgba(13,21,37,0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#14b8a6",
            letterSpacing: "0.06em",
            marginBottom: "14px",
          }}
        >
          AI BEHAVIOR
        </div>

        <Toggle
          value={config.humanFallbackEnabled}
          onChange={(v) =>
            setConfig({
              ...config,
              humanFallbackEnabled: v,
            })
          }
          label="Human Fallback"
          desc="Create tasks when AI confidence is low"
        />

        <div style={{ paddingTop: "14px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "7px",
            }}
          >
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "#e2eaf4",
              }}
            >
              Confidence Threshold
            </label>

            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#14b8a6",
              }}
            >
              {Math.round(config.confidenceThreshold * 100)}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.confidenceThreshold}
            onChange={(e) =>
              setConfig({
                ...config,
                confidenceThreshold: parseFloat(e.target.value),
              })
            }
            style={{
              width: "100%",
              accentColor: "#14b8a6",
            }}
          />
        </div>
      </div>

      {/* TIMING */}
      <div
        style={{
          background: "rgba(13,21,37,0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#14b8a6",
            letterSpacing: "0.06em",
            marginBottom: "6px",
          }}
        >
          HUMAN-LIKE TIMING
        </div>

        <p
          style={{
            fontSize: "12px",
            color: "#7c9ab8",
            marginBottom: "16px",
          }}
        >
          Random delay before sending — so replies feel natural.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px",
          }}
        >
          {[
            {
              label: "MIN DELAY (sec)",
              key: "minDelaySec" as const,
              min: 0,
              max: 10,
            },
            {
              label: "MAX DELAY (sec)",
              key: "maxDelaySec" as const,
              min: 1,
              max: 30,
            },
          ].map((f) => (
            <div key={f.key}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#7c9ab8",
                  marginBottom: "6px",
                }}
              >
                {f.label}
              </label>

              <input
                type="number"
                min={f.min}
                max={f.max}
                value={config[f.key]}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    [f.key]: parseInt(e.target.value) || f.min,
                  })
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#e2eaf4",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* GHL WEBHOOK */}
      <div
        style={{
          background: "rgba(13,21,37,0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#14b8a6",
            letterSpacing: "0.06em",
            marginBottom: "14px",
          }}
        >
          GHL WEBHOOK DIAGNOSTICS
        </div>

        {webhookLoading ? (
          <div
            style={{
              height: "90px",
              borderRadius: "12px",
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        ) : webhookStatus ? (
          <>
            {/* STATUS */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: webhookStatus.registration?.isActive
                    ? "#22c55e"
                    : "#ef4444",
                  boxShadow: webhookStatus.registration?.isActive
                    ? "0 0 8px rgba(34,197,94,0.6)"
                    : "0 0 8px rgba(239,68,68,0.6)",
                }}
              />

              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: webhookStatus.registration?.isActive
                    ? "#22c55e"
                    : "#ef4444",
                }}
              >
                {webhookStatus.registration?.isActive
                  ? "Webhook Active"
                  : "Webhook Not Registered"}
              </span>
            </div>

            {/* ERROR */}
            {webhookStatus.registration?.lastError &&
              !webhookStatus.registration?.isActive && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: "10px",
                    padding: "12px",
                    marginBottom: "16px",
                    color: "#f87171",
                    fontSize: "12px",
                  }}
                >
                  ⚠ {webhookStatus.registration.lastError}
                </div>
              )}

            {/* RETRY RESULT */}
            {webhookRetryResult && (
              <div
                style={{
                  background: webhookRetryResult.success
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(239,68,68,0.08)",
                  border: webhookRetryResult.success
                    ? "1px solid rgba(34,197,94,0.2)"
                    : "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "10px",
                  padding: "12px",
                  marginBottom: "16px",
                  color: webhookRetryResult.success
                    ? "#22c55e"
                    : "#f87171",
                  fontSize: "12px",
                }}
              >
                {webhookRetryResult.message}
              </div>
            )}

            {/* RETRY BUTTON */}
            {!webhookStatus.registration?.isActive && (
              <button
                onClick={retryWebhookRegistration}
                disabled={webhookRetrying}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "1px solid rgba(20,184,166,0.3)",
                  background: "rgba(20,184,166,0.08)",
                  color: "#14b8a6",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: webhookRetrying ? "not-allowed" : "pointer",
                  marginBottom: "18px",
                }}
              >
                {webhookRetrying
                  ? "Retrying..."
                  : "↺ Retry Auto-Registration"}
              </button>
            )}

            {/* MANUAL REGISTRATION */}
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#7c9ab8",
                  marginBottom: "14px",
                }}
              >
                📋 Manual Registration (if auto-register failed)
              </div>

              {/* Explanation callout */}
              <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", fontSize: "12px", color: "#f59e0b", lineHeight: 1.7 }}>
                <strong>Why is this needed?</strong> Paste this URL into a GHL Workflow Webhook action triggered by Customer Replied. When a lead replies to an email, GHL fires the webhook and NexusReply AI automatically responds. Takes about 2 minutes to set up.
              </div>

              {/* Step-by-step */}
              {[
                { n: 1, title: "Open GoHighLevel Workflows", body: "In your GHL sub-account, go to Automation → Workflows and create a new workflow (or open an existing one)." },
                { n: 2, title: "Set the trigger to \"Customer Replied\"", body: 'Click "+ Add Trigger", search for "Customer Replied" and select it. Set the filter to Reply Type: Email.' },
                { n: 3, title: 'Add a "Webhook" action', body: 'Click "+ Add Action", search for "Webhook" and select it. Set Method to POST.' },
                { n: 4, title: "Paste the Webhook URL below", body: null },
                { n: 5, title: "Leave Custom Data empty", body: "NexusReply uses the standard contact data GHL sends automatically — no custom fields needed." },
                { n: 6, title: "Save the action and publish the workflow", body: "Click Save in the Webhook action, then publish the workflow. NexusReply will now receive email replies and respond via AI." },
                { n: 7, title: "Confirm below", body: "Click \"I\'ve Done This\" so NexusReply marks your webhook as active." },
              ].map(step => (
                <div key={step.n} style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0, background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800, color: "#14b8a6" }}>
                    {step.n}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#c8d8e8", marginBottom: "4px" }}>{step.title}</div>
                    {step.body && <div style={{ fontSize: "11px", color: "#7c9ab8", lineHeight: 1.6 }}>{step.body}</div>}

                    {/* Step 4: URL copy */}
                    {step.n === 4 && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                        <code style={{ flex: 1, background: "rgba(20,184,166,0.06)", padding: "9px 12px", borderRadius: "8px", color: "#14b8a6", fontSize: "12px", wordBreak: "break-all" }}>
                          {webhookStatus.webhookUrl}
                        </code>
                        <button onClick={() => copyToClipboard(webhookStatus.webhookUrl, "url")} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(20,184,166,0.3)", background: copied === "url" ? "rgba(20,184,166,0.15)" : "transparent", color: copied === "url" ? "#22c55e" : "#14b8a6", cursor: "pointer", fontSize: "12px", fontWeight: 700, fontFamily: "inherit", flexShrink: 0 }}>
                          {copied === "url" ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                    )}

                    {/* Step 6: Events */}
                    {step.n === 6 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                        {(webhookStatus?.webhookEvents ?? []).map(event => (
                          <span key={event} style={{ padding: "4px 10px", borderRadius: "6px", background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "#14b8a6", fontSize: "11px", fontFamily: "monospace" }}>
                            {event}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* GHL Location ID for reference */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "10px 12px", marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", color: "#445566", fontWeight: 600, marginBottom: "5px" }}>YOUR GHL LOCATION ID (for reference)</div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <code style={{ flex: 1, fontSize: "12px", color: "#7c9ab8", wordBreak: "break-all" }}>{webhookStatus.ghlLocationId}</code>
                  <button onClick={() => copyToClipboard(webhookStatus.ghlLocationId, "locId")} style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: copied === "locId" ? "rgba(34,197,94,0.1)" : "transparent", color: copied === "locId" ? "#22c55e" : "#7c9ab8", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", flexShrink: 0 }}>
                    {copied === "locId" ? "✓" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Confirm button */}
              {!webhookStatus.registration?.isActive && (
                <button
                  onClick={confirmManualWebhook}
                  disabled={confirmingManual || manualConfirmed}
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: manualConfirmed ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg,#0d9488,#14b8a6)", color: manualConfirmed ? "#22c55e" : "white", fontSize: "13px", fontWeight: 700, cursor: (confirmingManual || manualConfirmed) ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  {manualConfirmed ? "✓ Webhook Marked Active" : confirmingManual ? "Saving…" : "✅ I've Done This — Mark Webhook as Active"}
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ color: "#7c9ab8", fontSize: "13px" }}>
            Could not load webhook diagnostics.
          </div>
        )}
      </div>

      {/* SYNC SETUP — alternative to Vercel cron (free) */}
      <div
        style={{
          background: "rgba(13,21,37,0.9)",
          border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "24px",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.06em", marginBottom: "14px" }}>
          MISSED MESSAGE SYNC
        </div>
        <p style={{ fontSize: "12px", color: "#7c9ab8", marginBottom: "16px", lineHeight: 1.7, margin: "0 0 14px" }}>
          The app automatically scans for missed email/SMS replies every time you open Conversations.
          For continuous background syncing (catches replies even when the app is closed), set up a GHL Workflow trigger — it&apos;s free and runs every 5 minutes.
        </p>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px 16px", marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "10px" }}>SYNC URL (add to GHL Workflow)</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <code style={{ flex: 1, background: "rgba(245,158,11,0.06)", padding: "9px 12px", borderRadius: "8px", color: "#f59e0b", fontSize: "12px", wordBreak: "break-all" }}>
              {typeof window !== "undefined" ? window.location.origin : ""}/api/cron/sync?secret={"{CRON_SECRET}"}
            </code>
          </div>
          <div style={{ fontSize: "10px", color: "#445566", marginTop: "6px" }}>Replace {"{CRON_SECRET}"} with your CRON_SECRET env var value.</div>
        </div>

        <div style={{ fontSize: "11px", color: "#7c9ab8", fontWeight: 700, marginBottom: "8px" }}>GHL WORKFLOW SETUP (2 minutes)</div>
        {[
          "In GoHighLevel → Automations → Workflows, create a new workflow.",
          "Set the trigger to \"Recurring\" with a 5-minute interval.",
          'Add a "Webhook" action with method GET and the Sync URL above.',
          "Activate the workflow. Done — email replies will now sync automatically.",
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "flex-start" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#f59e0b" }}>{i + 1}</div>
            <div style={{ fontSize: "12px", color: "#7c9ab8", lineHeight: 1.6 }}>{step}</div>
          </div>
        ))}
      </div>

      {/* SAVE */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          padding: "15px",
          borderRadius: "12px",
          border: "none",
          background: saving
            ? "rgba(20,184,166,0.5)"
            : "linear-gradient(135deg,#0d9488,#14b8a6)",
          color: "white",
          fontSize: "15px",
          fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {saving
          ? "Saving..."
          : saved
          ? "✓ Settings Saved!"
          : "💾 Save Settings"}
      </button>
    </div>
  );
}