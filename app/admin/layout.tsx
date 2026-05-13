import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import AdminSidebar from "./AdminSidebar";
import AdminNotificationBell from "@/components/AdminNotificationBell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;

  if (!user || user.role !== "admin") {
    redirect("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#060b12" }}>
      <AdminSidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          display: "flex", justifyContent: "flex-end", padding: "12px 24px",
          borderBottom: "1px solid rgba(236,72,153,0.1)",
          background: "rgba(6,11,18,0.9)", backdropFilter: "blur(8px)",
          position: "sticky", top: 0, zIndex: 40,
        }}>
          <AdminNotificationBell />
        </div>
        <main style={{ flex: 1, overflowX: "hidden", minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
