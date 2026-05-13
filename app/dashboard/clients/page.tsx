"use client";

import { useState, useEffect } from "react";

interface Location { id: string; name: string; automationEnabled: boolean; }
interface Invite {
  id: string; token: string; email: string | null; locationId: string; locationName: string;
  expiresAt: string; acceptedAt: string | null; createdAt: string; expired: boolean; link: string;
}

export default function ClientsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [newLink, setNewLink] = useState<{ link: string; locationName: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const [locRes, invRes] = await Promise.all([
      fetch("/api/locations").then(r => r.json()),
      fetch("/api/invite").then(r => r.json()),
    ]);
    const locs = locRes.locations || [];
    setLocations(locs);
    if (locs[0] && !selectedLoc) setSelectedLoc(locs[0].id);
    setInvites(invRes.invites || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!selectedLoc) { setError("Select a location first."); return; }
    setGenerating(true); setError(""); setNewLink(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: selectedLoc, email: inviteEmail || undefined, expiryDays }),
    });
    const data = await res.json();
    if (data.success) {
      setNewLink({ link: data.link, locationName: data.locationName });
      setInviteEmail("");
      await load();
    } else {
      setError(data.error || "Failed to generate link");
    }
    setGenerating(false);
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async (inviteId: string) => {
    if (!confirm("Revoke this invite link?")) return;
    setRevoking(inviteId);
    await fetch("/api/invite", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteId }) });
    await load();
    setRevoking(null);
  };

  const INP: React.CSSProperties = { width: "100%", background: "rgba(6,11,18,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "9px", padding: "10px 14px", color: "#e2eaf4", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  const activeInvites = invites.filter(i => !i.expired && !i.acceptedAt);
  const usedInvites = invites.filter(i => i.acceptedAt);
  const expiredInvites = invites.filter(i => i.expired && !i.acceptedAt);

  return (
    <div style={{ padding: "clamp(20px,3vw,36px)", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#e2eaf4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Client Invites</h1>
        <p style={{ color: "#2d3d50", margin: 0, fontSize: "13px" }}>
          Generate invite links for your clients (location owners) to access their own dashboard.
        </p>
      </div>

      {/* How it works */}
      <div style={{ background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.15)", borderRadius: "12px", padding: "16px 20px", marginBottom: "24px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#14b8a6", marginBottom: "8px" }}>🔗 How It Works</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "10px" }}>
          {[
            { step: "1", text: "Select a location" },
            { step: "2", text: "Optionally add client email" },
            { step: "3", text: "Generate & send the link" },
            { step: "4", text: "Client creates their account" },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800, color: "#14b8a6", flexShrink: 0 }}>{s.step}</div>
              <span style={{ fontSize: "12px", color: "#445566" }}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Generator */}
      <div style={{ background: "rgba(10,17,30,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 800, color: "#ec4899", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "18px" }}>Generate Invite Link</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Location *</label>
            {loading ? <div style={{ ...INP, color: "#2d3d50" }}>Loading…</div> : (
              <select value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)} style={{ ...INP, cursor: "pointer" }}>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Client Email (optional)</label>
            <input style={INP} type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="client@example.com" />
            <div style={{ fontSize: "10px", color: "#2d3d50", marginTop: "4px" }}>If set, only this email can use the link</div>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#445566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Link Expiry</label>
          <div style={{ display: "flex", gap: "6px" }}>
            {[1, 3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setExpiryDays(d)} style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: expiryDays === d ? "rgba(236,72,153,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${expiryDays === d ? "rgba(236,72,153,0.3)" : "rgba(255,255,255,0.07)"}`, color: expiryDays === d ? "#ec4899" : "#445566" }}>
                {d} {d === 1 ? "day" : "days"}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "13px", marginBottom: "14px" }}>{error}</div>}

        <button onClick={generate} disabled={generating || !selectedLoc} style={{
          padding: "11px 24px", borderRadius: "10px", border: "none",
          background: generating ? "rgba(236,72,153,0.3)" : "linear-gradient(135deg,#be185d,#ec4899)",
          color: "white", fontWeight: 700, fontSize: "13px", cursor: generating ? "not-allowed" : "pointer", fontFamily: "inherit",
        }}>
          {generating ? "Generating…" : "🔗 Generate Invite Link"}
        </button>

        {/* New link result */}
        {newLink && (
          <div style={{ marginTop: "18px", padding: "16px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e", marginBottom: "8px" }}>✅ Invite link ready for {newLink.locationName}</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input readOnly value={newLink.link} style={{ ...INP, flex: 1, fontSize: "11px", background: "rgba(0,0,0,0.3)" }} onClick={e => (e.target as HTMLInputElement).select()} />
              <button onClick={() => copyLink(newLink.link)} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 700, fontSize: "12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "6px" }}>Send this link to your client. It expires in {expiryDays} {expiryDays === 1 ? "day" : "days"}.</div>
          </div>
        )}
      </div>

      {/* Active invites */}
      {activeInvites.length > 0 && (
        <InviteList title="Active Links" invites={activeInvites} onCopy={copyLink} onRevoke={revoke} revoking={revoking} copied={copied} color="#14b8a6" />
      )}

      {/* Accepted */}
      {usedInvites.length > 0 && (
        <InviteList title="Accepted" invites={usedInvites} onCopy={copyLink} onRevoke={revoke} revoking={revoking} copied={copied} color="#22c55e" />
      )}

      {/* Expired */}
      {expiredInvites.length > 0 && (
        <InviteList title="Expired" invites={expiredInvites} onCopy={copyLink} onRevoke={revoke} revoking={revoking} copied={copied} color="#445566" />
      )}
    </div>
  );
}

function InviteList({ title, invites, onCopy, onRevoke, revoking, copied, color }: {
  title: string; invites: Invite[]; onCopy: (l: string) => void;
  onRevoke: (id: string) => void; revoking: string | null; copied: boolean; color: string;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "10px", fontWeight: 800, color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>{title} ({invites.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {invites.map(inv => (
          <div key={inv.id} style={{ padding: "14px 16px", background: "rgba(10,17,30,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#e2eaf4" }}>📍 {inv.locationName}</span>
                {inv.email && <span style={{ fontSize: "10px", color: "#445566" }}>→ {inv.email}</span>}
              </div>
              <div style={{ fontSize: "10px", color: "#2d3d50" }}>
                {inv.acceptedAt ? `Accepted ${new Date(inv.acceptedAt).toLocaleDateString()}` : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                {" · "}Created {new Date(inv.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {!inv.acceptedAt && !inv.expired && (
                <button onClick={() => onCopy(inv.link)} style={{ padding: "6px 12px", borderRadius: "7px", border: "1px solid rgba(20,184,166,0.3)", background: "rgba(20,184,166,0.08)", color: "#14b8a6", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {copied ? "✓" : "Copy"}
                </button>
              )}
              {!inv.acceptedAt && (
                <button onClick={() => onRevoke(inv.id)} disabled={revoking === inv.id} style={{ padding: "6px 10px", borderRadius: "7px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", color: "#ef4444", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {revoking === inv.id ? "…" : "Revoke"}
                </button>
              )}
              {inv.acceptedAt && <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>✓ Joined</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
