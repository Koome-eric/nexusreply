import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AgencyOverviewPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id || u.role !== "agency") redirect("/login");

  const [locations, clients, profile, sub] = await Promise.all([
    prisma.location.findMany({ where: { userId: u.id }, select: { id: true, name: true, automationEnabled: true } }),
    prisma.locationMember.findMany({ where: { ownerId: u.id }, select: { userId: true }, distinct: ["userId"] }),
    prisma.agencyProfile.findUnique({ where: { userId: u.id } }),
    prisma.subscription.findUnique({ where: { userId: u.id } }),
  ]);

  const brand = profile?.primaryColor || "#14b8a6";
  const agentCount = await prisma.aIAgent.count({ where: { userId: u.id } });
  const activeLocations = locations.filter(l => l.automationEnabled).length;

  const stats = [
    { label: "Locations", value: locations.length, icon: "📍", sub: `${activeLocations} AI active` },
    { label: "Connected Clients", value: clients.length, icon: "👥", sub: "with portal access" },
    { label: "AI Agents", value: agentCount, icon: "🤖", sub: "across all locations" },
    { label: "Plan", value: (sub?.plan || "trial").toUpperCase(), icon: "💳", sub: sub?.status || "trialing" },
  ];

  return (
    <div style={{ padding: "32px", maxWidth: "1000px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#e2eaf4", marginBottom: "6px", letterSpacing: "-0.03em" }}>
          Welcome, {profile?.agencyName || "Agency"} 👋
        </h1>
        <p style={{ fontSize: "14px", color: "#445566" }}>
          Manage your locations, clients, and AI sales team from here.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "20px" }}>
            <div style={{ fontSize: "22px", marginBottom: "8px" }}>{s.icon}</div>
            <div style={{ fontSize: "26px", fontWeight: 900, color: "#e2eaf4", letterSpacing: "-0.03em" }}>{s.value}</div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#7c9ab8" }}>{s.label}</div>
            <div style={{ fontSize: "11px", color: "#2d3d50", marginTop: "2px" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Locations list */}
      <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#e2eaf4" }}>Your Locations</h2>
          <a href="/agency/locations" style={{ fontSize: "12px", color: brand, textDecoration: "none" }}>Manage →</a>
        </div>
        {locations.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#445566" }}>No locations connected yet. <a href="/agency/locations" style={{ color: brand }}>Connect one →</a></p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {locations.map(l => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: "9px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: l.automationEnabled ? "#22c55e" : "#ef4444", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#b0c4d8", flex: 1 }}>{l.name}</span>
                <span style={{ fontSize: "11px", color: l.automationEnabled ? "#22c55e" : "#445566" }}>{l.automationEnabled ? "AI Active" : "Paused"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
