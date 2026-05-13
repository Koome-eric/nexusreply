"use client";

import { useState, useEffect } from "react";

interface Profile {
  agencyName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  supportEmail: string;
  website: string;
  phone: string;
  address: string;
  tagline: string;
}

const DEFAULT: Profile = {
  agencyName: "", logoUrl: "", primaryColor: "#14b8a6",
  secondaryColor: "#0f172a", accentColor: "#8b5cf6",
  supportEmail: "", website: "", phone: "", address: "", tagline: "",
};

const IS: React.CSSProperties = {
  width: "100%", background: "#0d1525", border: "1px solid rgba(20,184,166,0.15)",
  borderRadius: "8px", padding: "10px 14px", color: "#e2eaf4", fontSize: "14px",
  outline: "none", fontFamily: "inherit",
};
const LS: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8",
  marginBottom: "7px", letterSpacing: "0.05em",
};

export default function AgencyProfilePage() {
  const [form, setForm] = useState<Profile>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/agency-profile")
      .then(r => r.json())
      .then(d => {
        if (d.profile) setForm({ ...DEFAULT, ...d.profile });
        setLoading(false);
      });
  }, []);

  const up = (k: keyof Profile, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError("");
    const res = await fetch("/api/agency-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Save failed");
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  const brand = form.primaryColor || "#14b8a6";

  if (loading) return <div style={{ padding: "40px", color: "#445566" }}>Loading…</div>;

  return (
    <div style={{ padding: "32px", maxWidth: "760px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#e2eaf4", marginBottom: "6px" }}>🏢 Agency Profile</h1>
        <p style={{ fontSize: "14px", color: "#445566" }}>
          This information appears as the branding on your clients' dashboards. They see your agency identity, not NexusReply.
        </p>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#f87171" }}>⚠️ {error}</div>}

      {/* Live preview */}
      <div style={{ background: form.secondaryColor || "#0f172a", borderRadius: "14px", padding: "16px 20px", marginBottom: "28px", display: "flex", alignItems: "center", gap: "14px", border: "1px solid rgba(255,255,255,0.07)" }}>
        {form.logoUrl ? (
          <img src={form.logoUrl} alt="logo" style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "contain", background: "white" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🏢</div>
        )}
        <div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#e2eaf4" }}>{form.agencyName || "Your Agency Name"}</div>
          {form.tagline && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{form.tagline}</div>}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          {[brand, form.accentColor, form.secondaryColor].map((c, i) => (
            <div key={i} style={{ width: "22px", height: "22px", borderRadius: "50%", background: c, border: "2px solid rgba(255,255,255,0.12)" }} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Identity section */}
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "22px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#7c9ab8", marginBottom: "16px", letterSpacing: "0.04em" }}>IDENTITY</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={LS}>AGENCY NAME</label>
              <input type="text" value={form.agencyName} onChange={e => up("agencyName", e.target.value)} placeholder="Apex Growth Agency" style={IS} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={LS}>TAGLINE</label>
              <input type="text" value={form.tagline} onChange={e => up("tagline", e.target.value)} placeholder="We close more deals with AI" style={IS} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={LS}>LOGO URL</label>
              <input type="url" value={form.logoUrl} onChange={e => up("logoUrl", e.target.value)} placeholder="https://yoursite.com/logo.png" style={IS} />
              <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "5px" }}>Host on Cloudinary, S3, or any public URL. Recommended: 200×200px PNG.</div>
            </div>
          </div>
        </div>

        {/* Brand Colors */}
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "22px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#7c9ab8", marginBottom: "16px", letterSpacing: "0.04em" }}>BRAND COLORS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px" }}>
            {([
              { key: "primaryColor", label: "Primary", desc: "Buttons & highlights" },
              { key: "accentColor", label: "Accent", desc: "Badges & tags" },
              { key: "secondaryColor", label: "Background", desc: "Sidebar background" },
            ] as { key: keyof Profile; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <div key={key}>
                <label style={LS}>{label.toUpperCase()}</label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input type="color" value={form[key]} onChange={e => up(key, e.target.value)}
                    style={{ width: "44px", height: "44px", border: "none", borderRadius: "8px", cursor: "pointer", padding: "2px", background: "transparent" }} />
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: "13px", color: "#e2eaf4" }}>{form[key]}</div>
                    <div style={{ fontSize: "11px", color: "#2d3d50" }}>{desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "22px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#7c9ab8", marginBottom: "16px", letterSpacing: "0.04em" }}>CONTACT INFO (shown on client portal)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={LS}>SUPPORT EMAIL</label>
              <input type="email" value={form.supportEmail} onChange={e => up("supportEmail", e.target.value)} placeholder="support@agency.com" style={IS} />
            </div>
            <div>
              <label style={LS}>WEBSITE</label>
              <input type="url" value={form.website} onChange={e => up("website", e.target.value)} placeholder="https://youragency.com" style={IS} />
            </div>
            <div>
              <label style={LS}>PHONE</label>
              <input type="text" value={form.phone} onChange={e => up("phone", e.target.value)} placeholder="+1 555 000 0000" style={IS} />
            </div>
            <div>
              <label style={LS}>ADDRESS</label>
              <input type="text" value={form.address} onChange={e => up("address", e.target.value)} placeholder="123 Main St, City" style={IS} />
            </div>
          </div>
        </div>

        {/* Info note */}
        <div style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "12px", padding: "14px 18px" }}>
          <div style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 700, marginBottom: "4px" }}>ℹ️ How this works</div>
          <div style={{ fontSize: "12px", color: "#445566", lineHeight: "1.7" }}>
            Every client you invite sees your agency name, logo, and colors — not NexusReply branding.
            When you add or edit AI agents, your clients receive a notification automatically.
            Changes apply only to locations connected to your account.
          </div>
        </div>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "12px 28px", borderRadius: "10px", border: "none",
            background: `linear-gradient(135deg,${brand}aa,${brand})`,
            color: "white", fontSize: "14px", fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: saving ? 0.8 : 1,
          }}>
            {saving ? "Saving…" : "💾 Save Profile"}
          </button>
          {saved && <span style={{ fontSize: "13px", color: "#22c55e" }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}
