"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Location {
  id: string;
  ghlLocationId: string;
  name: string;
  automationEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  businessProfile: { businessName: string } | null;
  automationConfig: { enabled: boolean; aiModel: string } | null;
  _count: { aiLogs: number; conversations: number };
}

interface Subscription {
  plan: string;
  status: string;
  locationLimit: number;
}

type ConnectMode = "none" | "direct" | "oauth";

function LocationsContent() {
  const params = useSearchParams();
  const connected = params.get("connected");
  const urlError = params.get("error");

  const [locations, setLocations] = useState<Location[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Connection modal state
  const [connectMode, setConnectMode] = useState<ConnectMode>("none");
  const [directApiKey, setDirectApiKey] = useState("");
  const [directLocationId, setDirectLocationId] = useState("");
  const [directLocationName, setDirectLocationName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [connectSuccess, setConnectSuccess] = useState("");

  const load = () => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        setLocations(d.locations || []);
        setSub(d.subscription);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const toggleAutomation = async (loc: Location) => {
    setToggling(loc.id);
    const next = !loc.automationEnabled;
    await Promise.all([
      fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.id, automationEnabled: next }),
      }),
      fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.id, enabled: next }),
      }),
    ]);
    load();
    setToggling(null);
  };

  const deleteLocation = async (id: string) => {
    if (!confirm("Remove this location? All its AI logs and config will be deleted. This cannot be undone.")) return;
    setDeleting(id);
    await fetch("/api/locations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: id }),
    });
    load();
    setDeleting(null);
  };

  const handleDirectConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setConnectError("");
    setConnectSuccess("");

    const res = await fetch("/api/ghl/connect-direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: directApiKey.trim(),
        locationId: directLocationId.trim(),
        locationName: directLocationName.trim() || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setConnectError(data.error || "Connection failed. Please check your details.");
      setConnecting(false);
      return;
    }

    setConnectSuccess(`✅ "${data.locationName}" connected successfully!`);
    setConnecting(false);
    setDirectApiKey("");
    setDirectLocationId("");
    setDirectLocationName("");
    load();
    setTimeout(() => { setConnectMode("none"); setConnectSuccess(""); }, 2500);
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nexusreply.vercel.app";
  const redirectUri = process.env.NEXT_PUBLIC_GHL_REDIRECT_URI || `${appUrl}/leadconnector/oauth`;
  const clientId = process.env.NEXT_PUBLIC_GHL_CLIENT_ID || "";
  const scopes = [
    "conversations.readonly",
    "conversations.write",
    "contacts.readonly",
    "contacts.write",
    "locations.readonly",
    "opportunities.readonly",
    "opportunities.write",
  ].join("%20");
  const GHL_OAUTH_URL = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${scopes}`;

  const canAddMore = sub ? locations.length < sub.locationLimit : false;

  const errorMessages: Record<string, string> = {
    location_limit: "You've reached your location limit. Upgrade to add more.",
    oauth_failed: "OAuth connection failed. Use the Direct API method instead — it's easier.",
    no_code: "Connection was canceled.",
    not_logged_in: "Please sign in first.",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0d1525",
    border: "1px solid rgba(20,184,166,0.2)",
    borderRadius: "9px",
    padding: "11px 14px",
    color: "#e2eaf4",
    fontSize: "14px",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ padding: "clamp(20px,4vw,40px)", maxWidth: "960px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "5px" }}>Locations</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Connect your GoHighLevel sub-accounts.</p>
        </div>
        {sub && (
          <div style={{ fontSize: "13px", color: "var(--text-muted)", padding: "8px 14px", background: "var(--bg-surface)", borderRadius: "10px", border: "1px solid var(--bg-border)", whiteSpace: "nowrap" }}>
            {locations.length} / {sub.locationLimit} locations used
            {!canAddMore && <Link href="/pricing" style={{ color: "var(--brand)", marginLeft: "8px", textDecoration: "none", fontWeight: 600 }}>Upgrade →</Link>}
          </div>
        )}
      </div>

      {/* Success / Error banners */}
      {connected && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "11px", padding: "13px 18px", marginBottom: "20px", fontSize: "14px", color: "#22c55e" }}>
          ✅ GoHighLevel account connected! Now configure your AI for this location.
        </div>
      )}
      {urlError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "11px", padding: "13px 18px", marginBottom: "20px", fontSize: "14px", color: "#ef4444" }}>
          ⚠️ {errorMessages[urlError] || "An error occurred. Try the Direct API method below."}
        </div>
      )}

      {/* ── CONNECT OPTIONS ── */}
      {canAddMore && connectMode === "none" && (
        <div style={{ marginBottom: "28px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: "12px" }}>ADD A LOCATION</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>

            {/* Direct API (recommended) */}
            <button
              onClick={() => setConnectMode("direct")}
              style={{ padding: "20px 22px", borderRadius: "14px", border: "2px solid rgba(20,184,166,0.35)", background: "rgba(20,184,166,0.05)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#14b8a6"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,184,166,0.09)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(20,184,166,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,184,166,0.05)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "22px" }}>🔑</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "#e2eaf4" }}>Direct API Key</div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#14b8a6", background: "rgba(20,184,166,0.15)", padding: "2px 7px", borderRadius: "4px" }}>RECOMMENDED</span>
                </div>
              </div>
              <p style={{ fontSize: "13px", color: "#7c9ab8", lineHeight: 1.55 }}>
                Connect using your GHL Private Integration API key. Works instantly — no marketplace app needed.
              </p>
            </button>

            {/* OAuth (marketplace) */}
            <button
              onClick={() => setConnectMode("oauth")}
              style={{ padding: "20px 22px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(13,21,37,0.8)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "22px" }}>🔗</span>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "#e2eaf4" }}>OAuth (Marketplace App)</div>
              </div>
              <p style={{ fontSize: "13px", color: "#7c9ab8", lineHeight: 1.55 }}>
                Requires a published GHL Marketplace app with a Client ID and Secret.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ── DIRECT API FORM ── */}
      {connectMode === "direct" && (
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(20,184,166,0.25)", borderRadius: "16px", padding: "28px", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 700, marginBottom: "4px" }}>🔑 Connect with API Key</h2>
              <p style={{ fontSize: "13px", color: "#7c9ab8" }}>Paste your GHL Private Integration key and Location ID below.</p>
            </div>
            <button onClick={() => { setConnectMode("none"); setConnectError(""); }} style={{ background: "none", border: "none", color: "#445566", cursor: "pointer", fontSize: "20px", padding: "4px" }}>✕</button>
          </div>

          {/* How to get API key */}
          <div style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.15)", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px", fontSize: "13px", color: "#7c9ab8", lineHeight: 1.7 }}>
            <strong style={{ color: "#14b8a6" }}>How to get your API key:</strong><br />
            1. Open GoHighLevel → go to the <strong style={{ color: "#e2eaf4" }}>sub-account</strong> you want to connect<br />
            2. Settings → <strong style={{ color: "#e2eaf4" }}>Private Integrations</strong> → <strong style={{ color: "#e2eaf4" }}>+ Add Key</strong><br />
            3. Name it &quot;NexusReply&quot;, enable all scopes → copy the key<br />
            4. Your Location ID is in the URL when you&apos;re in that sub-account:<br />
            <span style={{ fontFamily: "monospace", color: "#14b8a6", fontSize: "12px" }}>app.gohighlevel.com/location/<strong>THIS_IS_YOUR_LOCATION_ID</strong>/dashboard</span>
          </div>

          {connectError && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "9px", padding: "11px 14px", marginBottom: "16px", fontSize: "13px", color: "#f87171" }}>
              ⚠️ {connectError}
            </div>
          )}
          {connectSuccess && (
            <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "9px", padding: "11px 14px", marginBottom: "16px", fontSize: "13px", color: "#22c55e" }}>
              {connectSuccess}
            </div>
          )}

          <form onSubmit={handleDirectConnect}>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "7px", letterSpacing: "0.05em" }}>
                  PRIVATE INTEGRATION API KEY *
                </label>
                <input
                  type="password"
                  placeholder="Paste your GHL API key here"
                  value={directApiKey}
                  onChange={(e) => setDirectApiKey(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                  onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "7px", letterSpacing: "0.05em" }}>
                  LOCATION ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. ABC123xyzLOCATIONID"
                  value={directLocationId}
                  onChange={(e) => setDirectLocationId(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                  onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"}
                />
                <div style={{ fontSize: "11px", color: "#445566", marginTop: "5px" }}>
                  Found in your GHL URL: /location/<strong style={{ color: "#7c9ab8" }}>LOCATION_ID</strong>/dashboard
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#7c9ab8", marginBottom: "7px", letterSpacing: "0.05em" }}>
                  NICKNAME (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Realty — Main"
                  value={directLocationName}
                  onChange={(e) => setDirectLocationName(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "#14b8a6"}
                  onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "rgba(20,184,166,0.2)"}
                />
              </div>
              <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
                <button
                  type="submit"
                  disabled={connecting || !directApiKey || !directLocationId}
                  style={{
                    flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                    background: "linear-gradient(135deg,#0d9488,#14b8a6)",
                    color: "white", fontWeight: 700, fontSize: "14px",
                    cursor: connecting ? "not-allowed" : "pointer",
                    fontFamily: "inherit", opacity: connecting ? 0.8 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    boxShadow: "0 4px 16px rgba(20,184,166,0.3)",
                  }}
                >
                  {connecting ? (
                    <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Connecting…</>
                  ) : "🔗 Connect Location"}
                </button>
                <button type="button" onClick={() => { setConnectMode("none"); setConnectError(""); }}
                  style={{ padding: "12px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#7c9ab8", cursor: "pointer", fontFamily: "inherit", fontSize: "14px" }}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── OAUTH FORM ── */}
      {connectMode === "oauth" && (
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "28px", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 700, marginBottom: "4px" }}>🔗 OAuth Connection</h2>
              <p style={{ fontSize: "13px", color: "#7c9ab8" }}>Requires a GHL Marketplace app. Make sure your Client ID and Redirect URI are set in your <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: "4px", fontSize: "12px" }}>.env</code> file.</p>
            </div>
            <button onClick={() => setConnectMode("none")} style={{ background: "none", border: "none", color: "#445566", cursor: "pointer", fontSize: "20px", padding: "4px" }}>✕</button>
          </div>

          <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "18px", fontSize: "13px", color: "#f59e0b" }}>
            ⚠️ <strong>Prerequisites:</strong> You must have a published GHL Marketplace app with a valid Client ID, Client Secret, and matching Redirect URI configured in your <code style={{ background: "rgba(0,0,0,0.2)", padding: "1px 5px", borderRadius: "3px" }}>.env</code>.
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <a href={GHL_OAUTH_URL} style={{ flex: 1, textDecoration: "none" }}>
              <button style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.07)", color: "#e2eaf4", fontWeight: 700, fontSize: "14px", cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s", border: "1px solid rgba(255,255,255,0.12)" as unknown as string }}
                onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.11)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"}>
                Open GHL OAuth Flow →
              </button>
            </a>
            <button onClick={() => setConnectMode("none")} style={{ padding: "12px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#7c9ab8", cursor: "pointer", fontFamily: "inherit", fontSize: "14px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── LOCATIONS LIST ── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2].map((i) => <div key={i} className="shimmer" style={{ height: "120px", borderRadius: "14px" }} />)}
        </div>
      ) : locations.length === 0 ? (
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "60px", textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "14px" }}>📍</div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>No locations connected yet</h3>
          <p style={{ color: "#7c9ab8", fontSize: "14px" }}>Use the <strong style={{ color: "#14b8a6" }}>Direct API Key</strong> method above — it&apos;s the fastest way to connect.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {locations.map((loc) => (
            <div key={loc.id} style={{
              background: "rgba(13,21,37,0.9)",
              border: `1px solid ${loc.automationEnabled ? "rgba(20,184,166,0.22)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: "14px",
              padding: "20px 22px",
              transition: "border-color 0.3s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                {/* Left */}
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "11px", background: loc.automationEnabled ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${loc.automationEnabled ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px", flexShrink: 0, transition: "all 0.3s" }}>
                    {loc.automationEnabled ? "⚡" : "🏢"}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px", color: "#e2eaf4" }}>{loc.name}</h3>
                    <div style={{ fontSize: "11px", color: "#445566", marginBottom: "8px", fontFamily: "monospace" }}>
                      {loc.ghlLocationId}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "#7c9ab8", background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: "5px" }}>
                        💬 {loc._count.conversations} convos
                      </span>
                      <span style={{ fontSize: "11px", color: "#7c9ab8", background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: "5px" }}>
                        🤖 {loc._count.aiLogs} AI replies
                      </span>
                      {loc.businessProfile ? (
                        <span style={{ fontSize: "11px", color: "#14b8a6", background: "rgba(20,184,166,0.08)", padding: "3px 8px", borderRadius: "5px" }}>✓ AI trained</span>
                      ) : (
                        <Link href={`/dashboard/setup?locationId=${loc.id}`} style={{ fontSize: "11px", color: "#f59e0b", background: "rgba(245,158,11,0.08)", padding: "3px 8px", borderRadius: "5px", textDecoration: "none" }}>
                          ⚠ Setup AI →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: loc.automationEnabled ? "#14b8a6" : "#445566", minWidth: "28px" }}>
                      {loc.automationEnabled ? "ON" : "OFF"}
                    </span>
                    <button className="toggle-switch" onClick={() => toggleAutomation(loc)} disabled={toggling === loc.id} aria-label="Toggle automation">
                      <div className={`toggle-track ${loc.automationEnabled ? "on" : "off"}`} style={{ opacity: toggling === loc.id ? 0.5 : 1 }}>
                        <div className={`toggle-thumb ${loc.automationEnabled ? "on" : "off"}`} />
                      </div>
                    </button>
                  </div>
                  <Link href={`/dashboard/setup?locationId=${loc.id}`}>
                    <button style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#7c9ab8", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", transition: "all 0.15s", fontWeight: 500 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#14b8a6"; (e.currentTarget as HTMLButtonElement).style.color = "#14b8a6"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#7c9ab8"; }}>
                      Configure
                    </button>
                  </Link>
                  <button onClick={() => deleteLocation(loc.id)} disabled={deleting === loc.id}
                    style={{ padding: "7px 10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#445566", cursor: "pointer", fontSize: "14px", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#445566"; }}>
                    {deleting === loc.id ? "…" : "🗑"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade prompt */}
      {sub && !canAddMore && sub.locationLimit < 15 && (
        <div style={{ marginTop: "20px", background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "13px", padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: "3px", color: "#e2eaf4" }}>Need more locations?</div>
            <div style={{ fontSize: "13px", color: "#7c9ab8" }}>Upgrade to Pro (5) or Agency (15) locations.</div>
          </div>
          <Link href="/pricing">
            <button style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "white", fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
              View Plans →
            </button>
          </Link>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function LocationsPage() {
  return <Suspense fallback={<div style={{ padding: "40px", color: "#7c9ab8" }}>Loading…</div>}><LocationsContent /></Suspense>;
}
