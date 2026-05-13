"use client";

import { useState, useEffect, Suspense } from "react";
import { useClientContext } from "../ClientProvider";

const TONES = [
  { value: "friendly", label: "Friendly", desc: "Warm, approachable, like a trusted friend" },
  { value: "professional", label: "Professional", desc: "Polished, confident, authoritative" },
  { value: "luxury", label: "Luxury", desc: "Elevated, refined, exclusive" },
  { value: "casual", label: "Casual", desc: "Relaxed, fun, relatable" },
  { value: "aggressive", label: "Aggressive", desc: "Bold, urgent, FOMO-driven" },
  { value: "consultative", label: "Consultative", desc: "Empathetic, inquisitive, guided" },
];

const CLOSING_STYLES = [
  { value: "consultative", label: "Consultative", desc: "Ask, listen, guide naturally" },
  { value: "assumptive", label: "Assumptive", desc: "Speak as if they're already in" },
  { value: "urgency", label: "Urgency-Based", desc: "Create FOMO and time pressure" },
  { value: "value", label: "Value-Led", desc: "Lead with transformation & outcomes" },
];

const NICHES = ["Real Estate","Mortgage","Insurance","Solar","Home Services","Digital Marketing Agency","SaaS","Coaching / Consulting","E-commerce","Fitness / Wellness","Legal","Healthcare","Other"];
const LANGUAGES = ["English","Spanish","French","Portuguese","German","Arabic","Mandarin","Hindi","Swahili","Italian"];

function SetupContent() {
  const { locationId } = useClientContext();
  const [form, setForm] = useState({
    businessName:"", niche:"", tone:"friendly", description:"", offers:"", faqs:"", objections:"", closingStyle:"consultative", customRules:"", language:"English",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/business?locationId=${locationId}`).then(r => r.json()).then(d => {
      if (d.profile) setForm(d.profile);
      else setForm({ businessName:"", niche:"", tone:"friendly", description:"", offers:"", faqs:"", objections:"", closingStyle:"consultative", customRules:"", language:"English" });
      setLoading(false);
    });
  }, [locationId]);

  const handleSave = async () => {
    if (!locationId) { alert("Location unavailable."); return; }
    setSaving(true); setSaved(false);
    await fetch("/api/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, locationId }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const steps = [
    { label: "Business Info", icon: "🏢" },
    { label: "Tone & Closing", icon: "🎯" },
    { label: "Knowledge Base", icon: "🧠" },
    { label: "Advanced", icon: "⚙️" },
  ];

  if (loading && !locationId) {
    return <div style={{ padding: "40px" }}>{[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: "70px", borderRadius: "10px", marginBottom: "14px" }} />)}</div>;
  }

  if (!locationId) {
    return (
      <div style={{ padding: "clamp(20px,4vw,40px)", maxWidth: "600px" }}>
        <div className="glass" style={{ borderRadius: "16px", padding: "48px", textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔗</div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "10px" }}>Location unavailable</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>Your client portal location is not available. Please contact your agency.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(20px,4vw,40px)", maxWidth: "860px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }} className="fade-in-up">
        <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "6px" }}>AI Setup</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Train your AI once — it replies like a human who knows your business inside out.</p>
      </div>


      {/* Step tabs */}
      <div className="fade-in-up" style={{ display: "flex", gap: "4px", marginBottom: "28px", background: "var(--bg-surface)", padding: "5px", borderRadius: "13px", overflowX: "auto" }}>
        {steps.map((s, i) => (
          <button key={s.label} onClick={() => setStep(i)} style={{ padding: "9px 16px", borderRadius: "9px", border: "none", cursor: "pointer", fontFamily: "var(--font-sora)", fontSize: "12px", fontWeight: step === i ? 600 : 400, background: step === i ? "var(--bg-card)" : "transparent", color: step === i ? "var(--brand)" : "var(--text-muted)", transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", boxShadow: step === i ? "0 2px 10px rgba(0,0,0,0.2)" : "none" }}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass" style={{ borderRadius: "20px", padding: "36px" }}>{[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: "60px", borderRadius: "8px", marginBottom: "14px" }} />)}</div>
      ) : (
      <div className="glass fade-in-up" style={{ borderRadius: "20px", padding: "clamp(20px,4vw,36px)" }}>

        {/* Step 0: Business Info */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>BUSINESS NAME *</label>
              <input className="input-field" placeholder="e.g. Apex Realty Group" value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>BUSINESS NICHE *</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: "8px" }}>
                {NICHES.map(n => (
                  <button key={n} onClick={() => setForm({...form, niche: n})} style={{ padding: "9px 12px", borderRadius: "9px", border: `1px solid ${form.niche === n ? "var(--brand)" : "var(--bg-border)"}`, background: form.niche === n ? "rgba(20,184,166,0.1)" : "var(--bg-surface)", color: form.niche === n ? "var(--brand)" : "var(--text-secondary)", fontSize: "12px", cursor: "pointer", fontFamily: "var(--font-sora)", fontWeight: form.niche === n ? 600 : 400, transition: "all 0.15s", textAlign: "left" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>BUSINESS DESCRIPTION *</label>
              <textarea className="input-field" placeholder="Describe your business, who you serve, and what makes you different. More detail = more convincing AI." value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ minHeight: "110px" }} />
            </div>
          </div>
        )}

        {/* Step 1: Tone & Closing */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px", letterSpacing: "0.04em" }}>COMMUNICATION TONE</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "10px" }}>
                {TONES.map(t => (
                  <button key={t.value} onClick={() => setForm({...form, tone: t.value})} style={{ padding: "14px 16px", borderRadius: "12px", border: `1px solid ${form.tone === t.value ? "var(--brand)" : "var(--bg-border)"}`, background: form.tone === t.value ? "rgba(20,184,166,0.08)" : "var(--bg-surface)", cursor: "pointer", fontFamily: "var(--font-sora)", textAlign: "left", transition: "all 0.15s" }}>
                    <div style={{ fontWeight: 600, color: form.tone === t.value ? "var(--brand)" : "var(--text-primary)", marginBottom: "3px", fontSize: "13px" }}>{t.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px", letterSpacing: "0.04em" }}>CLOSING STRATEGY</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "10px" }}>
                {CLOSING_STYLES.map(c => (
                  <button key={c.value} onClick={() => setForm({...form, closingStyle: c.value})} style={{ padding: "14px 16px", borderRadius: "12px", border: `1px solid ${form.closingStyle === c.value ? "var(--brand)" : "var(--bg-border)"}`, background: form.closingStyle === c.value ? "rgba(20,184,166,0.08)" : "var(--bg-surface)", cursor: "pointer", fontFamily: "var(--font-sora)", textAlign: "left", transition: "all 0.15s" }}>
                    <div style={{ fontWeight: 600, color: form.closingStyle === c.value ? "var(--brand)" : "var(--text-primary)", marginBottom: "3px", fontSize: "13px" }}>{c.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>REPLY LANGUAGE</label>
              <select className="input-field" value={form.language} onChange={e => setForm({...form, language: e.target.value})} style={{ maxWidth: "220px" }}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Knowledge Base */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <div style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "11px", padding: "14px 16px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              💡 <strong style={{ color: "var(--text-primary)" }}>Pro tip:</strong> The richer your knowledge base, the more human your AI sounds. Use the exact words and scripts your best sales rep uses.
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>YOUR OFFERS & SERVICES *</label>
              <textarea className="input-field" placeholder={"List everything you offer. Include tiers and pricing if possible.\n\nExample:\n- Starter: $497/mo — includes X, Y, Z\n- Premium: $997/mo — everything in Starter + A, B, C"} value={form.offers} onChange={e => setForm({...form, offers: e.target.value})} style={{ minHeight: "130px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>FAQS — COMMON QUESTIONS & ANSWERS *</label>
              <textarea className="input-field" placeholder={"Q: How long until I see results?\nA: Most clients see movement in the first 2 weeks...\n\nQ: Do you have contracts?\nA: No contracts — month to month..."} value={form.faqs} onChange={e => setForm({...form, faqs: e.target.value})} style={{ minHeight: "150px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>OBJECTIONS & HOW TO HANDLE THEM *</label>
              <textarea className="input-field" placeholder={"Objection: 'It's too expensive'\nResponse: 'I totally get that — what budget are you working with? We have options...'\n\nObjection: 'I need to think about it'\nResponse: 'Of course — what's the main thing holding you back?'"} value={form.objections} onChange={e => setForm({...form, objections: e.target.value})} style={{ minHeight: "160px" }} />
            </div>
          </div>
        )}

        {/* Step 3: Advanced */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>CUSTOM RULES (OPTIONAL)</label>
              <textarea className="input-field" placeholder={"Any special instructions for your AI:\n- Always mention our Saturday availability\n- Never discuss competitor pricing\n- Always push toward a phone call, not just text\n- If they mention NYC, mention our Manhattan office"} value={form.customRules || ""} onChange={e => setForm({...form, customRules: e.target.value})} style={{ minHeight: "150px" }} />
            </div>
            {form.businessName && (
              <div className="glass" style={{ borderRadius: "12px", padding: "18px 20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "10px", letterSpacing: "0.04em" }}>PREVIEW — HOW YOUR AI OPENS</div>
                <div style={{ background: "var(--bg-surface)", borderRadius: "10px", padding: "14px 16px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, fontStyle: "italic" }}>
                  &ldquo;Hey! Thanks for reaching out to {form.businessName}. I&apos;m here to help — what&apos;s on your mind?&rdquo;
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "32px", paddingTop: "22px", borderTop: "1px solid var(--bg-border)", flexWrap: "wrap", gap: "12px" }}>
          <button className="btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} style={{ visibility: step === 0 ? "hidden" : "visible" }}>← Back</button>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {step < steps.length - 1 ? (
              <button className="btn-primary" onClick={() => setStep(step + 1)}>Next →</button>
            ) : (
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.businessName || !form.description}>
                {saving ? "Saving…" : saved ? "✓ Saved!" : "💾 Save & Activate"}
              </button>
            )}
            {step < steps.length - 1 && (
              <button className="btn-ghost" onClick={handleSave} disabled={saving} style={{ fontSize: "13px" }}>
                {saving ? "Saving…" : saved ? "✓ Saved" : "Save Draft"}
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  return <Suspense><SetupContent /></Suspense>;
}
