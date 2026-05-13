import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import UpgradeBanner from "@/components/UpgradeBanner";

const ROLE_HOME: Record<string, string> = {
  admin:  "/admin",
  agency: "/agency",
  client: "/client",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;

  if (!u?.id) redirect("/login");

  // Only "user" role belongs here — all others get bounced to their panel
  if (u.role && u.role !== "user") {
    redirect(ROLE_HOME[u.role] ?? "/login");
  }

  return (
    <div className="bg-grid" style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 24px", borderBottom: "1px solid var(--bg-border)", background: "rgba(8,13,22,0.8)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 40 }}>
          <NotificationBell />
        </div>
        <UpgradeBanner />
        <main style={{ flex: 1, overflowX: "hidden" }}>{children}</main>
      </div>
    </div>
  );
}
