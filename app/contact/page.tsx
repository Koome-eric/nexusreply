"use client";
import { useState } from "react";
import Link         from "next/link";

type Field = { label: string; key: string; type?: string; placeholder: string; required?: boolean; span?: boolean };

const FIELDS: Field[] = [
  { label: "Your Name",    key: "name",    placeholder: "Jane Smith",               required: true  },
  { label: "Email Address",key: "email",   placeholder: "jane@yourcompany.com",     required: true, type: "email" },
  { label: "Company",      key: "company", placeholder: "Agency / Business name"                    },
  { label: "Subject",      key: "subject", placeholder: "e.g. Billing, Integration, Feature Request" },
  { label: "Message",      key: "message", placeholder: "Tell us what's on your mind — we read every message personally.", required: true, span: true },
];

export default function ContactPage() {
  const [form, setForm]     = useState<Record<string,string>>({ name:"", email:"", company:"", subject:"", message:"" });
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setStatus("sending");
    setErrMsg("");
    try {
      const res  = await fetch("/api/contact", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrMsg(String(err).replace(/^Error:\s*/, ""));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px", color: "#e2eaf4",
    fontSize: "14px", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060c14", color: "#e2eaf4", fontFamily: "var(--font-sora,sans-serif)" }}>
      {/* Ambient */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(20,184,166,0.12) 0%, transparent 60%)", pointerEvents: "none" }} />

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, padding: "0 clamp(20px,5vw,64px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", background: "rgba(6,12,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", height: "60px" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "9px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>⚡</div>
          <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.03em" }}>NexusReply</span>
        </Link>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/docs"    style={{ textDecoration: "none", fontSize: "13px", color: "#7c9ab8", padding: "7px 14px" }}>Docs</Link>
          <Link href="/pricing" style={{ textDecoration: "none", fontSize: "13px", color: "#7c9ab8", padding: "7px 14px" }}>Pricing</Link>
          <Link href="/login">
            <button style={{ padding: "7px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#7c9ab8", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>Sign In</button>
          </Link>
        </div>
      </nav>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "680px", margin: "0 auto", padding: "clamp(48px,8vw,96px) clamp(20px,5vw,40px) 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.25)", borderRadius: "100px", padding: "5px 16px", marginBottom: "20px", fontSize: "11px", fontWeight: 700, color: "#14b8a6", letterSpacing: "0.07em" }}>
            GET IN TOUCH
          </div>
          <h1 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 800, margin: "0 0 16px", letterSpacing: "-0.04em", lineHeight: 1.1 }}>
            We&apos;d love to<br />
            <span style={{ background: "linear-gradient(135deg,#14b8a6,#5eead4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              hear from you
            </span>
          </h1>
          <p style={{ color: "#7c9ab8", fontSize: "16px", lineHeight: 1.7, margin: 0 }}>
            Have a question, feature request, or just want to say hello?<br />
            We read every message and respond within 24 hours.
          </p>
        </div>

        {/* Contact cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "36px" }}>
          {[
            { icon: "💬", label: "General Support", desc: "Questions about features, setup, or your account" },
            { icon: "🐛", label: "Report a Bug",    desc: "Something broken? Let us know and we'll fix it fast" },
            { icon: "💡", label: "Feature Request", desc: "Have an idea that would help you close more deals?" },
            { icon: "🤝", label: "Partnership",     desc: "Agency partnerships, integrations, or reseller programs" },
          ].map(c => (
            <div key={c.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px", cursor: "pointer", transition: "border-color 0.2s" }}
              onClick={() => setForm(f => ({ ...f, subject: c.label }))}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(20,184,166,0.3)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)"}
            >
              <div style={{ fontSize: "20px", marginBottom: "6px" }}>{c.icon}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#c8d8e8", marginBottom: "3px" }}>{c.label}</div>
              <div style={{ fontSize: "11px", color: "#445566", lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        {/* Form or success */}
        {status === "sent" ? (
          <div style={{ textAlign: "center", padding: "60px 32px", background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "16px", animation: "fadeUp 0.4s ease" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#14b8a6", margin: "0 0 10px" }}>Message received!</h2>
            <p style={{ color: "#7c9ab8", fontSize: "14px", lineHeight: 1.7, margin: "0 0 28px" }}>
              Thanks for reaching out, {form.name.split(" ")[0]}. We&apos;ll get back to you at<br />
              <strong style={{ color: "#c8d8e8" }}>{form.email}</strong> within 24 hours.
            </p>
            <Link href="/">
              <button style={{ padding: "10px 24px", borderRadius: "9px", border: "none", background: "rgba(20,184,166,0.15)", color: "#14b8a6", fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                ← Back to Home
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ background: "rgba(10,17,30,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "clamp(24px,4vw,36px)" }}>

            {status === "error" && (
              <div style={{ padding: "12px 16px", borderRadius: "9px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "13px", marginBottom: "20px", lineHeight: 1.6 }}>
                ✗ {errMsg || "Something went wrong. Please try again."}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {FIELDS.map(f => (
                <div key={f.key} style={{ gridColumn: f.span ? "1 / -1" : undefined }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#445566", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
                    {f.label}{f.required && <span style={{ color: "#14b8a6", marginLeft: "3px" }}>*</span>}
                  </label>
                  {f.key === "message" ? (
                    <textarea
                      value={form.message}
                      onChange={set("message")}
                      placeholder={f.placeholder}
                      rows={5}
                      style={{ ...inputStyle, resize: "vertical", minHeight: "120px" }}
                      onFocus={e => (e.target.style.borderColor = "rgba(20,184,166,0.5)")}
                      onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  ) : (
                    <input
                      type={f.type || "text"}
                      value={form[f.key] || ""}
                      onChange={set(f.key)}
                      placeholder={f.placeholder}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = "rgba(20,184,166,0.5)")}
                      onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#2d3d50" }}>
                We respond within 24 hours on business days.
              </p>
              <button
                onClick={handleSubmit}
                disabled={status === "sending" || !form.name || !form.email || !form.message}
                style={{
                  padding: "12px 28px", borderRadius: "10px", border: "none",
                  background: "linear-gradient(135deg,#0d9488,#14b8a6)",
                  color: "white", fontWeight: 700, fontSize: "14px",
                  cursor: status === "sending" ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: (!form.name || !form.email || !form.message) ? 0.5 : 1,
                  transition: "all 0.2s", display: "flex", alignItems: "center", gap: "8px",
                }}
                onMouseEnter={e => { if (status !== "sending") (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
              >
                {status === "sending" ? (
                  <>
                    <div style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Sending…
                  </>
                ) : "Send Message →"}
              </button>
            </div>
          </div>
        )}

        {/* Footer note */}
        <p style={{ textAlign: "center", marginTop: "32px", fontSize: "12px", color: "#2d3d50" }}>
          Prefer email?{" "}
          <a href="mailto:support@nexusreply.com" style={{ color: "#14b8a6", textDecoration: "none" }}>
            support@nexusreply.com
          </a>
        </p>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        textarea { resize: vertical; }
      `}</style>
    </div>
  );
}
