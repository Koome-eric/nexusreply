"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/admin", icon: "▦", label: "Overview", exact: true },
  { href: "/admin/analytics", icon: "📈", label: "Analytics" },
  { href: "/admin/users", icon: "👥", label: "Users" },
  { href: "/admin/subscriptions", icon: "💳", label: "Subscriptions" },
  { href: "/admin/agents", icon: "🤖", label: "Agent Training" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: "220px", minHeight: "100vh", flexShrink: 0,
      background: "rgba(6,11,18,0.98)",
      borderRight: "1px solid rgba(236,72,153,0.15)",
      display: "flex", flexDirection: "column",
      position: "sticky", top: 0, height: "100vh", overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 18px", borderBottom: "1px solid rgba(236,72,153,0.15)" }}>
        <Link href="/admin" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg,#be185d,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", boxShadow: "0 0 14px rgba(236,72,153,0.4)" }}>🛡</div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#e2eaf4", letterSpacing: "-0.01em" }}>NexusReply</div>
              <div style={{ fontSize: "9px", color: "#ec4899", letterSpacing: "0.08em", fontWeight: 700 }}>ADMIN CONTROL</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 10px" }}>
        {NAV.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: "3px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px", borderRadius: "9px",
                fontSize: "13px", fontWeight: isActive ? 600 : 400,
                color: isActive ? "#ec4899" : "#7c9ab8",
                background: isActive ? "rgba(236,72,153,0.08)" : "transparent",
                borderLeft: `2px solid ${isActive ? "#ec4899" : "transparent"}`,
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: "15px", width: "20px", textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          );
        })}

        <div style={{ margin: "16px 0 8px", borderTop: "1px solid rgba(236,72,153,0.1)", paddingTop: "16px" }}>
          <Link href="/dashboard" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", color: "#445566", transition: "all 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.color = "#7c9ab8"}
              onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.color = "#445566"}>
              <span style={{ fontSize: "15px", width: "20px", textAlign: "center" }}>←</span>
              User Dashboard
            </div>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div style={{ padding: "14px", borderTop: "1px solid rgba(236,72,153,0.1)" }}>
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          style={{ width: "100%", padding: "9px", background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "#445566", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", transition: "all 0.15s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.2)"; (e.currentTarget as HTMLButtonElement).style.color = "#445566"; }}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
