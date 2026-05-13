"use client";

import { useEffect, useState } from "react";

interface Branding {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
}

const DEFAULT: Branding = {
  appName: "NexusReply",
  primaryColor: "#14b8a6",
  secondaryColor: "#0f172a",
  accentColor: "#8b5cf6",
  logoUrl: "",
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg-card)", border: "1px solid var(--bg-border)",
  borderRadius: "8px", padding: "10px 14px", color: "var(--text-primary)", fontSize: "14px",
  outline: "none", fontFamily: "inherit",
};

export default function BrandingPage() {
  const [branding, setBranding] = useState<Branding>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((d) => {
        if (d.branding) setBranding({ ...DEFAULT, ...d.branding });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const res = await fetch("/api/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Save failed"); }
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  const up = (k: keyof Branding, v: string) => setBranding((p) => ({ ...p, [k]: v }));

  if (loading) return <div style={{ padding: "40px", color: "var(--text-muted)" }}>Loading branding settings…</div>;

  return (
    <div style={{ padding: "32px", maxWidth: "720px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
          🎨 White-Label Branding
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          Customize how your clients experience the platform. All connected client accounts inherit this branding.
        </p>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#f87171" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Preview Bar */}
      <div style={{ background: branding.secondaryColor, borderRadius: "12px", padding: "16px 20px", marginBottom: "28px", display: "flex", alignItems: "center", gap: "14px", border: "1px solid rgba(255,255,255,0.08)" }}>
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt="logo" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "contain", background: "white" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: branding.primaryColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>⚡</div>
        )}
        <div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#e2eaf4" }}>{branding.appName || "NexusReply"}</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>Live preview</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          {[branding.primaryColor, branding.accentColor, branding.secondaryColor].map((c, i) => (
            <div key={i} style={{ width: "24px", height: "24px", borderRadius: "50%", background: c, border: "2px solid rgba(255,255,255,0.15)" }} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* App Name */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "14px", padding: "20px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "10px" }}>APP NAME</label>
          <input
            type="text"
            value={branding.appName}
            onChange={(e) => up("appName", e.target.value)}
            placeholder="NexusReply"
            style={inputStyle}
            maxLength={40}
          />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
            This is displayed in the sidebar, browser tab, and email notifications to clients.
          </p>
        </div>

        {/* Logo URL */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "14px", padding: "20px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "10px" }}>LOGO URL</label>
          <input
            type="url"
            value={branding.logoUrl}
            onChange={(e) => up("logoUrl", e.target.value)}
            placeholder="https://yoursite.com/logo.png"
            style={inputStyle}
          />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
            Host your logo on any public URL (e.g. Cloudinary, Vercel Blob, S3). Recommended: 200×200px PNG with transparency.
          </p>
        </div>

        {/* Colors */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "14px", padding: "20px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "16px" }}>BRAND COLORS</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
            {([
              { key: "primaryColor", label: "Primary", desc: "Buttons, links, highlights" },
              { key: "accentColor", label: "Accent", desc: "Badges, tags, secondary actions" },
              { key: "secondaryColor", label: "Background", desc: "Sidebar and header background" },
            ] as { key: keyof Branding; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <div key={key}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>{label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="color"
                    value={branding[key]}
                    onChange={(e) => up(key, e.target.value)}
                    style={{ width: "44px", height: "44px", border: "none", borderRadius: "8px", cursor: "pointer", padding: "2px", background: "transparent" }}
                  />
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--text-primary)" }}>{branding[key]}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "12px 28px", borderRadius: "10px", border: "none",
              background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white",
              fontSize: "14px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: saving ? 0.8 : 1,
            }}
          >
            {saving ? "Saving…" : "💾 Save Branding"}
          </button>
          {saved && <span style={{ fontSize: "13px", color: "#22c55e" }}>✓ Saved successfully</span>}
        </div>

        {/* Info box */}
        <div style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "12px", padding: "14px 18px" }}>
          <div style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 600, marginBottom: "4px" }}>ℹ️ How branding works</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            Your branding is applied to all client dashboards automatically. Clients invited to your locations will see your logo, app name, and colors instead of NexusReply defaults.
            Color changes take effect on next page load.
          </div>
        </div>
      </div>
    </div>
  );
}
