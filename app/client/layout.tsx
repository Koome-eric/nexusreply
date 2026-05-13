import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import ClientSidebar from "./ClientSidebar";
import { ClientProvider } from "./ClientProvider";
import NotificationBell from "@/components/NotificationBell";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;

  if (!u?.id) redirect("/login");
  const roleHome: Record<string, string> = { admin: "/admin", agency: "/agency", user: "/dashboard" };
  if (u.role !== "client") redirect(roleHome[u.role ?? "user"] ?? "/login");

  // Get location membership
  const membership = await prisma.locationMember.findFirst({
    where: { userId: u.id },
    include: {
      location: {
        select: {
          id: true, name: true, ghlLocationId: true, automationEnabled: true,
          businessProfile: { select: { businessName: true } },
        },
      },
    },
  });
  if (!membership) redirect("/login");

  const location = membership.location;

  // Fetch the agency owner's profile for branding
  const agencyProfileData = await prisma.agencyProfile.findUnique({
    where: { userId: membership.ownerId },
    select: {
      agencyName: true, logoUrl: true, primaryColor: true,
      secondaryColor: true, tagline: true, supportEmail: true, website: true,
    },
  });

  // Transform null values to undefined for type compatibility
  const agencyProfile = agencyProfileData ? {
    agencyName: agencyProfileData.agencyName ?? undefined,
    logoUrl: agencyProfileData.logoUrl ?? undefined,
    primaryColor: agencyProfileData.primaryColor ?? undefined,
    secondaryColor: agencyProfileData.secondaryColor ?? undefined,
    tagline: agencyProfileData.tagline ?? undefined,
    supportEmail: agencyProfileData.supportEmail ?? undefined,
    website: agencyProfileData.website ?? undefined,
  } : null;

  const brand = agencyProfile?.primaryColor || "#14b8a6";

  return (
    <ClientProvider locationId={location.id} locationName={location.businessProfile?.businessName || location.name}>
      <div style={{ display: "flex", minHeight: "100vh", background: "#080d16" }}>
        <ClientSidebar
          locationName={location.businessProfile?.businessName || location.name}
          agencyProfile={agencyProfile}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div data-topbar="true" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(8,13,22,0.95)", backdropFilter: "blur(8px)",
          position: "sticky", top: 0, zIndex: 40,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: location.automationEnabled ? "#22c55e" : "#ef4444" }} />
            <span style={{ fontSize: "12px", color: "#445566" }}>
              {location.automationEnabled ? "AI Active" : "AI Paused"} · {location.name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <NotificationBell />
            <span style={{ fontSize: "11px", fontWeight: 700, color: brand, background: `${brand}18`, padding: "3px 10px", borderRadius: "6px", letterSpacing: "0.05em" }}>CLIENT</span>
          </div>
        </div>
        <main style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  </ClientProvider>
  );
}
