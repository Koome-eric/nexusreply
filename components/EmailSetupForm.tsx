"use client";
import { useState, useEffect, useRef } from "react";

interface EmailProviderData {
  provider:     string;
  fromName:     string;
  fromEmail:    string;
  replyTo:      string;
  resendApiKey: string;
  smtpHost:     string;
  smtpPort:     string;
  smtpUser:     string;
  smtpPass:     string;
  smtpSecure:   boolean;
  verified:     boolean;
  lastTestedAt: string | null;
  lastError:    string | null;
}

const EMPTY: EmailProviderData = {
  provider: "resend", fromName: "", fromEmail: "", replyTo: "",
  resendApiKey: "", smtpHost: "", smtpPort: "587", smtpUser: "",
  smtpPass: "", smtpSecure: false, verified: false,
  lastTestedAt: null, lastError: null,
};

// ── Animated status dot ──────────────────────────────────────────
function StatusDot({ status }: { status: "idle" | "saving" | "testing" | "ok" | "error" }) {
  const MAP = {
    idle:    { color: "#334155", pulse: false },
    saving:  { color: "#f59e0b", pulse: true  },
    testing: { color: "#3b82f6", pulse: true  },
    ok:      { color: "#22c55e", pulse: false },
    error:   { color: "#ef4444", pulse: false },
  };
  const { color, pulse } = MAP[status];
  return (
    <span style={{
      display:      "inline-block",
      width:        "8px",
      height:       "8px",
      borderRadius: "50%",
      background:   color,
      boxShadow:    pulse ? `0 0 0 0 ${color}40` : "none",
      animation:    pulse ? "ripple 1.2s ease-out infinite" : "none",
      transition:   "background 0.3s",
    }} />
  );
}

// ── Provider tab button ──────────────────────────────────────────
function ProviderTab({
  id, label, icon, desc, active, onClick,
}: { id: string; label: string; icon: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex:         1,
      padding:      "16px 12px",
      background:   active ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
      border:       `1.5px solid ${active ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: "12px",
      cursor:       "pointer",
      textAlign:    "left",
      transition:   "all 0.2s",
    }}>
      <div style={{ fontSize: "22px", marginBottom: "6px" }}>{icon}</div>
      <div style={{ fontSize: "13px", fontWeight: 700, color: active ? "#14b8a6" : "#c8d8e8", marginBottom: "3px" }}>{label}</div>
      <div style={{ fontSize: "11px", color: "#445566", lineHeight: 1.4 }}>{desc}</div>
    </button>
  );
}

// ── Field ────────────────────────────────────────────────────────
function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <label style={{
        display: "block", fontSize: "11px", fontWeight: 700,
        color: "#445566", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px",
      }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "5px" }}>{hint}</div>}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", monospace,
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; monospace?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      style={{
        width:        "100%",
        padding:      "10px 14px",
        background:   "rgba(255,255,255,0.04)",
        border:       "1px solid rgba(255,255,255,0.1)",
        borderRadius: "9px",
        color:        "#e2eaf4",
        fontSize:     "13px",
        fontFamily:   monospace ? "'IBM Plex Mono', monospace" : "inherit",
        outline:      "none",
        boxSizing:    "border-box",
        transition:   "border 0.2s",
      }}
      onFocus={e => (e.target.style.borderColor = "rgba(20,184,166,0.5)")}
      onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
    />
  );
}

// ── Main component ────────────────────────────────────────────────
export default function EmailSetupPage({
  locationId,
}: { locationId: string }) {
  const [form, setForm]       = useState<EmailProviderData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState<"idle" | "saving" | "testing" | "ok" | "error">("idle");
  const [msg, setMsg]         = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showApiKey, setShowApiKey]     = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: keyof EmailProviderData) => (v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  function flash(type: "ok" | "error", text: string) {
    setMsg({ type, text });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(null), 5000);
  }

  // Load existing config
  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/email-provider?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => {
        if (d.provider) {
          setForm({
            ...EMPTY,
            ...d.provider,
            smtpPort:    String(d.provider.smtpPort || 587),
            resendApiKey: d.provider.resendApiKey || "",
            smtpPass:    d.provider.smtpPass || "",
            replyTo:     d.provider.replyTo || "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [locationId]);

  const handleSave = async () => {
    if (!form.fromEmail) { flash("error", "Sender email is required"); return; }
    if (form.provider === "resend" && !form.resendApiKey) { flash("error", "Resend API key is required"); return; }
    if (form.provider === "smtp" && (!form.smtpHost || !form.smtpUser || !form.smtpPass)) {
      flash("error", "SMTP host, username, and password are required"); return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/email-provider", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locationId, smtpPort: Number(form.smtpPort) || 587 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("idle");
      flash("ok", "Settings saved. Send a test email to verify your connection.");
    } catch (err) {
      setStatus("error");
      flash("error", String(err));
    }
  };

  const handleTest = async () => {
    if (!testEmail) { flash("error", "Enter an email address to send the test to"); return; }
    if (!form.fromEmail) { flash("error", "From Email is required"); return; }
    if (form.provider === "resend" && !form.resendApiKey) { flash("error", "Resend API key is required"); return; }
    if (form.provider === "smtp" && (!form.smtpHost || !form.smtpUser || !form.smtpPass)) {
      flash("error", "SMTP host, username, and password are all required"); return;
    }
    setStatus("testing");
    try {
      const res = await fetch("/api/email-provider/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locationId, testEmail, smtpPort: Number(form.smtpPort) || 587 }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Test failed — check your settings");
      setStatus("ok");
      setForm(f => ({ ...f, verified: true, lastError: null }));
      flash("ok", `✅ Test email sent to ${testEmail} — check your inbox!`);
      setShowTestInput(false);
    } catch (err) {
      setStatus("error");
      const msg = String(err).replace(/^Error:\s*/, "");
      flash("error", msg);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "60px", textAlign: "center", color: "#2d3d50", fontSize: "13px" }}>
        <div style={{ fontSize: "24px", marginBottom: "8px", animation: "spin 1s linear infinite", display: "inline-block" }}>⚙</div>
        <div>Loading email settings…</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes ripple {
          0%   { box-shadow: 0 0 0 0 currentColor; opacity:0.8; }
          70%  { box-shadow: 0 0 0 8px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .ep-input:focus { border-color: rgba(20,184,166,0.5) !important; }
        .ep-btn { transition: all 0.18s; cursor: pointer; }
        .ep-btn:hover:not(:disabled) { filter: brightness(1.12); }
        .ep-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ep-reveal { cursor: pointer; user-select: none; }
        .ep-reveal:hover { color: #14b8a6; }
      `}</style>

      <div style={{ padding: "clamp(20px,3vw,36px)", maxWidth: "680px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "clamp(18px,2.5vw,24px)", fontWeight: 800, color: "#e2eaf4", margin: "0 0 5px", letterSpacing: "-0.02em" }}>
              Email Connection
            </h1>
            <p style={{ color: "#2d3d50", margin: 0, fontSize: "13px" }}>
              Connect your sending email so AI agents reply from your real address.
            </p>
          </div>

          {/* Verified badge */}
          {form.verified && (
            <div style={{
              display: "flex", alignItems: "center", gap: "7px",
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: "8px", padding: "6px 12px", flexShrink: 0,
              animation: "fadeUp 0.4s ease",
            }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#22c55e" }}>CONNECTED</span>
            </div>
          )}
        </div>

        {/* Flash message */}
        {msg && (
          <div style={{
            padding: "12px 16px", borderRadius: "10px", marginBottom: "20px",
            fontSize: "13px", animation: "fadeUp 0.3s ease",
            background: msg.type === "ok" ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
            border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            color:  msg.type === "ok" ? "#22c55e" : "#ef4444",
            wordBreak: "break-word", lineHeight: 1.6,
          }}>
            {msg.text}
          </div>
        )}

        {/* Last error from DB */}
        {!msg && form.lastError && (
          <div style={{
            padding: "12px 16px", borderRadius: "10px", marginBottom: "20px",
            fontSize: "12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
          }}>
            Last error: {form.lastError}
          </div>
        )}

        {/* Provider selection */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#445566", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
            Sending Method
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <ProviderTab
              id="resend" label="Resend" icon="⚡"
              desc="Fastest setup. Just paste an API key."
              active={form.provider === "resend"}
              onClick={() => set("provider")("resend")}
            />
            <ProviderTab
              id="smtp" label="Custom SMTP" icon="🔧"
              desc="Use Gmail, Outlook, or any mail server."
              active={form.provider === "smtp"}
              onClick={() => set("provider")("smtp")}
            />
          </div>
        </div>

        {/* Sender identity (both providers) */}
        <div style={{
          background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px", padding: "20px 22px", marginBottom: "16px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#14b8a6", marginBottom: "16px", letterSpacing: "0.04em" }}>
            Sender Identity
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Field label="Display Name" hint="Who leads see as the sender">
              <Input value={form.fromName} onChange={set("fromName")} placeholder="Sarah from Apex Realty" />
            </Field>
            <Field label="From Email *" hint="Must match your verified domain">
              <Input value={form.fromEmail} onChange={set("fromEmail")} placeholder="sarah@apexrealty.com" type="email" />
            </Field>
          </div>
          <Field label="Reply-To (optional)" hint="Where replies go if different from sender">
            <Input value={form.replyTo} onChange={set("replyTo")} placeholder="inbox@apexrealty.com" type="email" />
          </Field>
        </div>

        {/* Resend config */}
        {form.provider === "resend" && (
          <div style={{
            background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px", padding: "20px 22px", marginBottom: "16px",
            animation: "fadeUp 0.25s ease",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#14b8a6", marginBottom: "4px", letterSpacing: "0.04em" }}>
              Resend API Key
            </div>
            <div style={{ fontSize: "12px", color: "#2d3d50", marginBottom: "14px" }}>
              Get a free API key at{" "}
              <a href="https://resend.com" target="_blank" rel="noopener noreferrer"
                style={{ color: "#14b8a6", textDecoration: "none" }}>
                resend.com
              </a>
              {" "}— free tier includes 3,000 emails/month.
            </div>
            <Field label="API Key *">
              <div style={{ position: "relative" }}>
                <Input
                  value={form.resendApiKey}
                  onChange={set("resendApiKey")}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                  type={showApiKey ? "text" : "password"}
                  monospace
                />
                <span
                  className="ep-reveal"
                  onClick={() => setShowApiKey(s => !s)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#445566" }}
                >
                  {showApiKey ? "hide" : "show"}
                </span>
              </div>
            </Field>

            {/* Resend guide */}
            <div style={{
              background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.1)",
              borderRadius: "10px", padding: "14px 16px", fontSize: "12px", color: "#445566", lineHeight: 1.7,
            }}>
              <div style={{ color: "#14b8a6", fontWeight: 700, marginBottom: "6px" }}>Quick Setup (2 min)</div>
              <div>1. Go to <a href="https://resend.com" target="_blank" rel="noopener noreferrer" style={{ color: "#14b8a6" }}>resend.com</a> and create a free account</div>
              <div>2. Add your domain under Domains → Add Domain</div>
              <div>3. Copy your API key from the API Keys section</div>
              <div>4. Paste it above and click Save</div>
            </div>
          </div>
        )}

        {/* SMTP config */}
        {form.provider === "smtp" && (
          <div style={{
            background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px", padding: "20px 22px", marginBottom: "16px",
            animation: "fadeUp 0.25s ease",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#14b8a6", marginBottom: "16px", letterSpacing: "0.04em" }}>
              SMTP Settings
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0 16px" }}>
              <Field label="SMTP Host *">
                <Input value={form.smtpHost} onChange={set("smtpHost")} placeholder="smtp.gmail.com" monospace />
              </Field>
              <Field label="Port">
                <Input value={form.smtpPort} onChange={set("smtpPort")} placeholder="587" />
              </Field>
            </div>
            <Field label="Username *" hint="Usually your email address">
              <Input value={form.smtpUser} onChange={set("smtpUser")} placeholder="you@gmail.com" />
            </Field>
            <Field label="Password / App Password *">
              <div style={{ position: "relative" }}>
                <Input
                  value={form.smtpPass}
                  onChange={set("smtpPass")}
                  placeholder="••••••••••••••••"
                  type={showSmtpPass ? "text" : "password"}
                  monospace
                />
                <span
                  className="ep-reveal"
                  onClick={() => setShowSmtpPass(s => !s)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#445566" }}
                >
                  {showSmtpPass ? "hide" : "show"}
                </span>
              </div>
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <button
                onClick={() => set("smtpSecure")(!form.smtpSecure)}
                style={{
                  width: "40px", height: "22px", borderRadius: "11px", border: "none", cursor: "pointer",
                  background: form.smtpSecure ? "#14b8a6" : "rgba(255,255,255,0.1)", transition: "background 0.2s",
                  position: "relative", flexShrink: 0,
                }}
              >
                <div style={{
                  width: "16px", height: "16px", borderRadius: "50%", background: "#fff",
                  position: "absolute", top: "3px",
                  left: form.smtpSecure ? "21px" : "3px", transition: "left 0.2s",
                }} />
              </button>
              <span style={{ fontSize: "13px", color: "#7c9ab8" }}>Use SSL/TLS (port 465)</span>
            </div>

            {/* Gmail tip */}
            <div style={{
              background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.1)",
              borderRadius: "10px", padding: "14px 16px", marginTop: "14px", fontSize: "12px", color: "#445566", lineHeight: 1.7,
            }}>
              <div style={{ color: "#14b8a6", fontWeight: 700, marginBottom: "6px" }}>Using Gmail?</div>
              <div>Host: <code style={{ color: "#7c9ab8" }}>smtp.gmail.com</code> · Port: <code style={{ color: "#7c9ab8" }}>587</code></div>
              <div>Use an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: "#14b8a6" }}>App Password</a> (not your Google password)</div>
              <div style={{ marginTop: "4px" }}>Google Account → Security → App Passwords</div>
            </div>
          </div>
        )}

        {/* Actions row */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "20px" }}>
          {/* Save */}
          <button
            className="ep-btn"
            onClick={handleSave}
            disabled={status === "saving" || status === "testing"}
            style={{
              padding: "10px 22px", borderRadius: "9px", border: "none",
              background: "#14b8a6", color: "#080d18", fontWeight: 700,
              fontSize: "13px", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <StatusDot status={status === "saving" ? "saving" : "idle"} />
            {status === "saving" ? "Saving…" : "Save Settings"}
          </button>

          {/* Test email trigger */}
          <button
            className="ep-btn"
            onClick={() => setShowTestInput(s => !s)}
            disabled={status === "saving" || status === "testing"}
            style={{
              padding: "10px 18px", borderRadius: "9px",
              background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
              color: "#7c9ab8", fontWeight: 600, fontSize: "13px", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <StatusDot status={status === "testing" ? "testing" : status === "ok" ? "ok" : status === "error" ? "error" : "idle"} />
            {status === "testing" ? "Sending test…" : "Send Test Email"}
          </button>
        </div>

        {/* Test email input — slides in */}
        {showTestInput && (
          <div style={{
            background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px", padding: "18px 20px", marginBottom: "16px",
            animation: "fadeUp 0.2s ease",
          }}>
            <div style={{ fontSize: "12px", color: "#445566", marginBottom: "10px" }}>
              Send a test email to confirm your connection is working:
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                onKeyDown={e => e.key === "Enter" && handleTest()}
                style={{
                  flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "9px",
                  color: "#e2eaf4", fontSize: "13px", fontFamily: "inherit", outline: "none",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(20,184,166,0.5)")}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              <button
                className="ep-btn"
                onClick={handleTest}
                disabled={status === "testing" || !testEmail}
                style={{
                  padding: "10px 18px", borderRadius: "9px", border: "none",
                  background: "rgba(20,184,166,0.15)", color: "#14b8a6",
                  fontWeight: 700, fontSize: "13px", fontFamily: "inherit", flexShrink: 0,
                }}
              >
                {status === "testing" ? "Sending…" : "Send →"}
              </button>
            </div>
          </div>
        )}

        {/* Status footer */}
        {form.lastTestedAt && (
          <div style={{ fontSize: "11px", color: "#2d3d50" }}>
            Last verified: {new Date(form.lastTestedAt).toLocaleString(undefined, {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </div>
        )}
      </div>
    </>
  );
}
