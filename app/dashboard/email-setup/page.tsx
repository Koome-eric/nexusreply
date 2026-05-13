"use client";
import { useState, useEffect } from "react";
import EmailSetupForm from "@/components/EmailSetupForm";

export default function DashboardEmailSetupPage() {
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations]   = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch("/api/locations")
      .then(r => r.json())
      .then(d => {
        const locs = d.locations || [];
        setLocations(locs);
        if (locs[0]) setLocationId(locs[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: "60px", textAlign: "center", color: "#2d3d50" }}>Loading…</div>
  );

  return (
    <div style={{ padding: "clamp(20px,3vw,36px)" }}>
      {/* Location picker (multi-location users) */}
      {locations.length > 1 && (
        <div style={{ marginBottom: "24px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {locations.map(l => (
            <button
              key={l.id}
              onClick={() => setLocationId(l.id)}
              style={{
                padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                background: locationId === l.id ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${locationId === l.id ? "rgba(20,184,166,0.35)" : "rgba(255,255,255,0.08)"}`,
                color: locationId === l.id ? "#14b8a6" : "#445566",
              }}
            >{l.name}</button>
          ))}
        </div>
      )}

      {locationId && <EmailSetupForm locationId={locationId} />}
    </div>
  );
}
