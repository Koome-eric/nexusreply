"use client";

import { useState, useEffect } from "react";

interface Location { id: string; name: string }
interface Invite {
  id: string; token: string; email: string | null;
  locationId: string; locationName: string;
  expiresAt: string; acceptedAt: string | null;
  link: string; expired: boolean;
}
interface Member {
  id: string; role: string;
  user: { id: string; name: string | null; email: string };
  locationId: string; locationName: string;
}

const IS: React.CSSProperties = {
  background: "#0d1525", border: "1px solid rgba(20,184,166,0.15)",
  borderRadius: "8px", padding: "9px 13px", color: "#e2eaf4",
  fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%",
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid rgba(20,184,166,0.3)", background: "rgba(20,184,166,0.08)", color: copied ? "#22c55e" : "#14b8a6", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" }}>
      {copied ? "✓ Copied!" : "Copy Link"}
    </button>
  );
}

export default function AgencyClientsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [selLoc, setSelLoc] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [expDays, setExpDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ link: string; locationName: string } | null>(null);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/locations").then(r => r.json()),
      fetch("/api/invite").then(r => r.json()),
      fetchMembers(),
    ]).then(([locs, invData]) => {
      const ls: Location[] = locs.locations || [];
      setLocations(ls);
      if (ls[0]) setSelLoc(ls[0].id);
      setInvites(invData.invites || []);
      setLoading(false);
    });
  }, []);

  async function fetchMembers() {
    // Fetch members from all locations — use location-members endpoint per location
    const locsRes = await fetch("/api/locations").then(r => r.json());
    const ls: Location[] = locsRes.locations || [];
    const all: Member[] = [];
    await Promise.all(ls.map(async loc => {
      const res = await fetch(`/api/location-members?locationId=${loc.id}`).then(r => r.json());
      (res.members || []).forEach((m: { id: string; role: string; user: { id: string; name: string | null; email: string } }) => {
        all.push({ ...m, locationId: loc.id, locationName: loc.name });
      });
    }));
    setMembers(all);
  }

  const handleGenerate = async () => {
    if (!selLoc) return;
    setGenerating(true); setGenError(""); setGenResult(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: selLoc, email: invEmail || undefined, expiryDays: expDays }),
    });
    const data = await res.json();
    if (!res.ok) { setGenError(data.error || "Failed to generate"); }
    else {
      setGenResult({ link: data.link, locationName: data.locationName });
      setInvites(prev => [data.invite ? { ...data.invite, link: data.link, locationName: data.locationName, expired: false } : prev[0], ...prev]);
    }
    setGenerating(false);
  };

  const handleRevoke = async (inviteId: string) => {
    await fetch("/api/invite", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteId }) });
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  const handleRemoveMember = async (memberId: string) => {
    await fetch("/api/location-members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId }) });
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  if (loading) return <div style={{ padding: "40px", color: "#445566" }}>Loading…</div>;

  const activeInvites = invites.filter(i => !i.acceptedAt && !i.expired);
  const usedInvites = invites.filter(i => i.acceptedAt || i.expired);

  return (
    <div style={{ padding: "32px", maxWidth: "900px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#e2eaf4", marginBottom: "6px" }}>👥 Clients & Invites</h1>
        <p style={{ fontSize: "14px", color: "#445566" }}>
          Generate invite links for your clients. When they click the link they register and get access to a branded client portal showing only their location's data.
        </p>
      </div>

      {locations.length === 0 ? (
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "32px", textAlign: "center", color: "#445566" }}>
          No locations connected. <a href="/agency/locations" style={{ color: "#14b8a6" }}>Connect a location first →</a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* ── Generate Invite Link ── */}
          <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#e2eaf4", marginBottom: "18px" }}>🔗 Generate Invite Link</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "end", marginBottom: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#7c9ab8", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>LOCATION</label>
                <select value={selLoc} onChange={e => setSelLoc(e.target.value)} style={{ ...IS, cursor: "pointer" }}>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#7c9ab8", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>CLIENT EMAIL (optional)</label>
                <input type="email" placeholder="client@business.com (optional)" value={invEmail} onChange={e => setInvEmail(e.target.value)} style={IS} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#7c9ab8", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>EXPIRES IN</label>
                <select value={expDays} onChange={e => setExpDays(Number(e.target.value))} style={{ ...IS, width: "100px", cursor: "pointer" }}>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
            </div>

            {genError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "12px", fontSize: "13px", color: "#f87171" }}>⚠️ {genError}</div>}

            <button onClick={handleGenerate} disabled={generating || !selLoc} style={{
              padding: "11px 24px", borderRadius: "10px", border: "none",
              background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white",
              fontSize: "14px", fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: generating ? 0.8 : 1,
            }}>
              {generating ? "Generating…" : "🔗 Generate Invite Link"}
            </button>

            {/* Result */}
            {genResult && (
              <div style={{ marginTop: "16px", background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.25)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#14b8a6", marginBottom: "8px" }}>✓ Invite link for {genResult.locationName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input readOnly value={genResult.link} style={{ ...IS, flex: 1, fontFamily: "monospace", fontSize: "12px" }} onClick={e => (e.target as HTMLInputElement).select()} />
                  <CopyBtn text={genResult.link} />
                </div>
                <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "8px" }}>
                  Share this link with your client. They click it, create an account, and land directly in their branded client portal showing only their location.
                </div>
              </div>
            )}
          </div>

          {/* ── Active Clients (Members) ── */}
          <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#e2eaf4", marginBottom: "16px" }}>
              ✅ Active Client Accounts ({members.length})
            </h3>
            {members.length === 0 ? (
              <div style={{ fontSize: "13px", color: "#2d3d50" }}>No clients have accepted invites yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(20,184,166,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0 }}>
                      {(m.user.name || m.user.email)[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2eaf4" }}>{m.user.name || "—"}</div>
                      <div style={{ fontSize: "11px", color: "#445566" }}>{m.user.email} · {m.locationName}</div>
                    </div>
                    <span style={{ fontSize: "11px", background: "rgba(20,184,166,0.1)", color: "#14b8a6", padding: "3px 10px", borderRadius: "6px", fontWeight: 600 }}>client</span>
                    <button onClick={() => handleRemoveMember(m.id)} style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "#f87171", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Active Pending Invites ── */}
          {activeInvites.length > 0 && (
            <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "24px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#e2eaf4", marginBottom: "16px" }}>
                ⏳ Pending Invites ({activeInvites.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeInvites.map(inv => (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#b0c4d8" }}>{inv.locationName}</div>
                      <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "2px" }}>{inv.email || "Open invite"} · Expires {new Date(inv.expiresAt).toLocaleDateString()}</div>
                      <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#445566", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.link}</div>
                    </div>
                    <CopyBtn text={inv.link} />
                    <button onClick={() => handleRevoke(inv.id)} style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.07)", color: "#f87171", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>Revoke</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Used/Expired ── */}
          {usedInvites.length > 0 && (
            <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "16px", padding: "24px", opacity: 0.7 }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#7c9ab8", marginBottom: "14px" }}>🗂️ Used / Expired Invites</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {usedInvites.map(inv => (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "9px" }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "12px", color: "#445566" }}>{inv.locationName}</span>
                      {inv.email && <span style={{ fontSize: "11px", color: "#2d3d50" }}> · {inv.email}</span>}
                    </div>
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "5px", background: inv.acceptedAt ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)", color: inv.acceptedAt ? "#22c55e" : "#2d3d50" }}>
                      {inv.acceptedAt ? "✓ Accepted" : "Expired"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
