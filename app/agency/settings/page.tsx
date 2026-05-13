"use client";

import { useEffect, useState } from "react";

interface Config { enabled: boolean; aiModel: string; maxDelaySec: number; minDelaySec: number; humanFallbackEnabled: boolean; confidenceThreshold: number }
interface Location { id: string; name: string }

const AI_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Fast & cost-effective. Great for most businesses." },
  { value: "gpt-4o", label: "GPT-4o", desc: "More nuanced. Better for complex sales conversations." },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", desc: "Maximum intelligence. Best for high-ticket sales." },
];

export default function SettingsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [config, setConfig] = useState<Config>({ enabled: false, aiModel: "gpt-4o-mini", maxDelaySec: 3, minDelaySec: 1, humanFallbackEnabled: true, confidenceThreshold: 0.7 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      const locs: Location[] = d.locations || [];
      setLocations(locs);
      if (locs[0]) { setSelectedId(locs[0].id); }
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`/api/automation?locationId=${selectedId}`).then(r => r.json()).then(d => {
      if (d.config) setConfig(d.config);
      setLoading(false);
    });
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, locationId: selectedId }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const Toggle = ({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--bg-border)" }}>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", marginBottom: desc ? "2px" : 0 }}>{label}</div>
        {desc && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{desc}</div>}
      </div>
      <button className="toggle-switch" onClick={() => onChange(!value)}>
        <div className={`toggle-track ${value ? "on" : "off"}`}><div className={`toggle-thumb ${value ? "on" : "off"}`} /></div>
      </button>
    </div>
  );

  if (loading && !locations.length) return <div style={{ padding: "40px" }}>{[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: "70px", borderRadius: "12px", marginBottom: "14px" }} />)}</div>;

  if (locations.length === 0) return (
    <div style={{ padding: "clamp(20px,4vw,40px)", maxWidth: "640px" }}>
      <div className="glass" style={{ borderRadius: "16px", padding: "48px", textAlign: "center" }}>
        <div style={{ fontSize: "36px", marginBottom: "14px" }}>🔧</div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>No locations connected</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>Connect a GoHighLevel account first to configure settings.</p>
        <a href="/agency/locations"><button className="btn-primary">Connect GHL →</button></a>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "clamp(20px,4vw,40px)", maxWidth: "700px" }}>
      <div style={{ marginBottom: "32px" }} className="fade-in-up">
        <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "6px" }}>Settings</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Fine-tune how your AI behaves across all channels.</p>
      </div>

      {/* Location selector */}
      {locations.length > 1 && (
        <div className="fade-in-up" style={{ marginBottom: "22px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>CONFIGURE LOCATION</label>
          <select className="input-field" value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ maxWidth: "340px" }}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: "80px", borderRadius: "12px", marginBottom: "14px" }} />)}</div>
      ) : (
        <>
          {/* AI Model */}
          <div className="glass fade-in-up" style={{ borderRadius: "14px", padding: "20px 24px", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand)", letterSpacing: "0.06em", marginBottom: "14px" }}>AI MODEL</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {AI_MODELS.map(m => (
                <button key={m.value} onClick={() => setConfig({...config, aiModel: m.value})} style={{ padding: "12px 14px", borderRadius: "10px", border: `1px solid ${config.aiModel === m.value ? "var(--brand)" : "var(--bg-border)"}`, background: config.aiModel === m.value ? "rgba(20,184,166,0.07)" : "var(--bg-surface)", cursor: "pointer", fontFamily: "var(--font-sora)", textAlign: "left", transition: "all 0.15s", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: config.aiModel === m.value ? "var(--brand)" : "var(--text-primary)", marginBottom: "2px" }}>{m.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.desc}</div>
                  </div>
                  {config.aiModel === m.value && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--brand)", boxShadow: "0 0 8px rgba(20,184,166,0.5)", flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Timing */}
          <div className="glass fade-in-up" style={{ borderRadius: "14px", padding: "20px 24px", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand)", letterSpacing: "0.06em", marginBottom: "6px" }}>HUMAN-LIKE TIMING</div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>Random delay before sending — so replies feel natural, not instant.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              {[{ label: "MIN DELAY (sec)", key: "minDelaySec" as const, min: 0, max: 10 }, { label: "MAX DELAY (sec)", key: "maxDelaySec" as const, min: 1, max: 30 }].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>{f.label}</label>
                  <input type="number" className="input-field" min={f.min} max={f.max} value={config[f.key]} onChange={e => setConfig({...config, [f.key]: parseInt(e.target.value) || f.min})} />
                </div>
              ))}
            </div>
          </div>

          {/* Safety */}
          <div className="glass fade-in-up" style={{ borderRadius: "14px", padding: "20px 24px", marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand)", letterSpacing: "0.06em", marginBottom: "4px" }}>SAFETY</div>
            <Toggle value={config.humanFallbackEnabled} onChange={v => setConfig({...config, humanFallbackEnabled: v})} label="Human Fallback" desc="Create a task when AI confidence is low" />
            <div style={{ paddingTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>Confidence Threshold</label>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand)" }}>{Math.round(config.confidenceThreshold * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={config.confidenceThreshold} onChange={e => setConfig({...config, confidenceThreshold: parseFloat(e.target.value)})} style={{ width: "100%", accentColor: "var(--brand)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                <span>More replies (less safe)</span><span>Fewer replies (more safe)</span>
              </div>
            </div>
          </div>

          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: "100%", justifyContent: "center", padding: "15px", borderRadius: "12px", fontSize: "15px" }}>
            {saving ? "Saving…" : saved ? "✓ Settings Saved!" : "💾 Save Settings"}
          </button>
        </>
      )}
    </div>
  );
}
