import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import AgencySidebar from "./AgencySidebar";
import NotificationBell from "@/components/NotificationBell";
import UpgradeBanner from "@/components/UpgradeBanner";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;

  if (!u?.id) redirect("/login");
  const roleHome: Record<string, string> = { admin: "/admin", client: "/client", user: "/dashboard" };
  if (u.role !== "agency") redirect(roleHome[u.role ?? "user"] ?? "/login");

  const profile = await prisma.agencyProfile.findUnique({
    where: { userId: u.id },
    select: { agencyName: true, primaryColor: true },
  });

  const brand = profile?.primaryColor || "#14b8a6";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080d16" }}>
      <AgencySidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div data-topbar="true" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(8,13,22,0.95)", backdropFilter: "blur(8px)",
          position: "sticky", top: 0, zIndex: 40,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: brand, background: `${brand}18`, padding: "3px 10px", borderRadius: "6px", letterSpacing: "0.05em" }}>AGENCY</span>
            <span style={{ fontSize: "12px", color: "#2d3d50" }}>{profile?.agencyName || "My Agency"}</span>
          </div>
          <NotificationBell />
        </div>
        <UpgradeBanner />
        <main style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
