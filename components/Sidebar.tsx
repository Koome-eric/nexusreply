"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const NAV = [
  { href: "/dashboard", icon: "▦", label: "Dashboard", exact: true },
  { href: "/dashboard/locations", icon: "📍", label: "Locations" },
  { href: "/dashboard/agents", icon: "👥", label: "AI Sales Team" },
  { href: "/dashboard/pipeline", icon: "📊", label: "Pipeline" },
  { href: "/dashboard/setup", icon: "⚙", label: "AI Setup" },
  { href: "/dashboard/team-chat", icon: "💬", label: "AI Team Chat" },
  { href: "/dashboard/active-contacts", icon: "🟢", label: "Active Contacts" },
  { href: "/dashboard/conversations", icon: "🗨️", label: "Conversations" },
  { href: "/dashboard/analytics", icon: "📈", label: "Analytics" },
  { href: "/dashboard/notifications", icon: "🔔", label: "Notifications" },
  { href: "/dashboard/settings", icon: "🔧", label: "Settings" },
];

const BOTTOM_LINKS = [
  { href: "/docs", icon: "📚", label: "Documentation" },
  { href: "/pricing", icon: "💳", label: "Upgrade Plan" },
];

interface UserData {
  name?: string;
  email?: string;
  plan?: string;
  status?: string;
  role?: string;
  trialEndsAt?: string;
  trialMessagesUsed?: number;
  trialMessagesLimit?: number;
  messagesUsed?: number;
  monthlyLimit?: number;
  locationCount?: number;
  locationLimit?: number;
}

const PLAN_COLORS: Record<string, string> = {
  trial: "#f59e0b",
  starter: "#14b8a6",
  pro: "#8b5cf6",
  agency: "#ec4899",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = () => {
      fetch("/api/team-chat/unread").then(r => r.json()).then(d => setChatUnread(d.count || 0)).catch(() => {});
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => setUserData(d.user));
  }, []);

  const trialDaysLeft = userData?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(userData.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrial = userData?.status === "trialing";
  const trialPct = userData?.trialMessagesLimit
    ? Math.min(100, Math.round(((userData.trialMessagesUsed || 0) / userData.trialMessagesLimit) * 100))
    : 0;

  const planColor = PLAN_COLORS[userData?.plan || "trial"] || "#14b8a6";

  const NavItem = ({ item }: { item: typeof NAV[0] }) => {
    const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    return (
      <Link href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: "3px" }}
        onClick={() => setMobileOpen(false)}>
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: collapsed ? "10px 14px" : "10px 14px",
          borderRadius: "10px", fontSize: "13.5px",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--brand)" : "var(--text-secondary)",
          background: isActive ? "rgba(20,184,166,0.08)" : "transparent",
          borderLeft: isActive ? "2px solid var(--brand)" : "2px solid transparent",
          transition: "all 0.15s ease", cursor: "pointer",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
          onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.color = "var(--text-secondary)"; }}
        >
          <span style={{ fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
          {!collapsed && item.label}
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--bg-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {!collapsed && (
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "9px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", boxShadow: "0 0 14px rgba(20,184,166,0.3)", flexShrink: 0 }}>⚡</div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>NexusReply</div>
              <div style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>AI SALES ENGINE</div>
            </div>
          </Link>
        )}
        {collapsed && (
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>⚡</div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "6px", transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"}
        >{collapsed ? "→" : "←"}</button>
      </div>

      {/* Trial warning */}
      {isTrial && !collapsed && (
        <div style={{ margin: "12px 12px 0", padding: "12px 14px", borderRadius: "11px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.04em" }}>FREE TRIAL</span>
            <span style={{ fontSize: "11px", color: "#f59e0b" }}>{trialDaysLeft}d left</span>
          </div>
          <div style={{ height: "4px", borderRadius: "2px", background: "rgba(245,158,11,0.15)", overflow: "hidden", marginBottom: "8px" }}>
            <div style={{ height: "100%", width: `${trialPct}%`, background: "#f59e0b", borderRadius: "2px", transition: "width 0.5s ease" }} />
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
            {userData?.trialMessagesUsed || 0}/{userData?.trialMessagesLimit || 50} messages
          </div>
          <Link href="/pricing" style={{ textDecoration: "none" }}>
            <div style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "7px", padding: "6px 10px", fontSize: "11px", color: "#f59e0b", fontWeight: 600, textAlign: "center", cursor: "pointer" }}>
              Upgrade Now →
            </div>
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 10px" }}>
        {NAV.map((item) => <NavItem key={item.href} item={item} />)}

        {/* Admin link */}
        {userData?.role === "admin" && (
          <Link href="/dashboard/admin" style={{ textDecoration: "none", display: "block", marginTop: "8px", marginBottom: "3px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", fontSize: "13.5px", color: "#ec4899", background: pathname.startsWith("/dashboard/admin") ? "rgba(236,72,153,0.08)" : "transparent", borderLeft: pathname.startsWith("/dashboard/admin") ? "2px solid #ec4899" : "2px solid transparent", transition: "all 0.15s ease", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start" }}>
              <span style={{ fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0 }}>🛡</span>
              {!collapsed && "Admin"}
            </div>
          </Link>
        )}
      </nav>

      {/* Bottom links */}
      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--bg-border)" }}>
        {BOTTOM_LINKS.map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration: "none", display: "block", marginBottom: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 14px", borderRadius: "9px", fontSize: "12px", color: "var(--text-muted)", transition: "all 0.15s", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start" }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.color = "var(--text-secondary)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.color = "var(--text-muted)"}>
              <span style={{ fontSize: "14px", width: "20px", textAlign: "center", flexShrink: 0 }}>{link.icon}</span>
              {!collapsed && link.label}
            </div>
          </Link>
        ))}
      </div>

      {/* User profile */}
      <div style={{ padding: "12px", borderTop: "1px solid var(--bg-border)" }}>
        {!collapsed && userData && (
          <div style={{ marginBottom: "10px", padding: "12px", borderRadius: "11px", background: "var(--bg-surface)", border: "1px solid var(--bg-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: `linear-gradient(135deg, ${planColor}55, ${planColor}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: planColor, flexShrink: 0 }}>
                {(userData.name || userData.email || "U")[0].toUpperCase()}
              </div>
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userData.name || userData.email}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: planColor, letterSpacing: "0.05em" }}>
                    {(userData.plan || "TRIAL").toUpperCase()}
                  </span>
                  {userData.locationCount !== undefined && (
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>· {userData.locationCount}/{userData.locationLimit} loc</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              style={{ width: "100%", padding: "7px", background: "transparent", border: "1px solid var(--bg-border)", borderRadius: "7px", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer", fontFamily: "var(--font-sora)", transition: "all 0.15s ease" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bg-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}>
              Sign Out
            </button>
          </div>
        )}
        {collapsed && (
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ width: "100%", padding: "8px", background: "transparent", border: "1px solid var(--bg-border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "14px", cursor: "pointer", transition: "all 0.15s" }}
            title="Sign out">🚪</button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        style={{ display: "none", position: "fixed", top: "16px", left: "16px", zIndex: 100, background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "10px", padding: "10px 12px", cursor: "pointer", fontSize: "18px" }}
        className="mobile-menu-btn"
        aria-label="Open menu"
      >☰</button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 98, display: "none" }}
          className="mobile-overlay" />
      )}

      {/* Desktop sidebar */}
      <aside className="glass sidebar-desktop"
        style={{ width: collapsed ? "68px" : "240px", minHeight: "100vh", borderRight: "1px solid var(--bg-border)", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0, transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <aside className="glass sidebar-mobile"
        style={{ position: "fixed", top: 0, left: mobileOpen ? 0 : "-280px", width: "260px", height: "100vh", zIndex: 99, borderRight: "1px solid var(--bg-border)", overflowY: "auto", transition: "left 0.3s cubic-bezier(0.4,0,0.2,1)", display: "none" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px" }}>
          <button onClick={() => setMobileOpen(false)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer" }}>✕</button>
        </div>
        <SidebarContent />
      </aside>
    </>
  );
}
