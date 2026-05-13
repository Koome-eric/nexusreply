"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

// Agency panel — no Pipeline, Active Contacts, Conversations, AI Setup, Team Chat
const NAV = [
  { href: "/agency",               icon: "▦",  label: "Overview",          exact: true },
  { href: "/agency/locations",     icon: "📍", label: "Locations" },
  { href: "/agency/clients",       icon: "👥", label: "Clients & Invites" },
  { href: "/agency/agents",        icon: "🤖", label: "AI Sales Team" },
  { href: "/agency/analytics",     icon: "📈", label: "Analytics" },
  { href: "/agency/notifications", icon: "🔔", label: "Notifications" },
  { href: "/agency/profile",       icon: "🏢", label: "Agency Profile" },
  { href: "/agency/settings",      icon: "⚙️", label: "Settings" },
];

interface AgencyProfile { agencyName?: string; logoUrl?: string; primaryColor?: string; }
interface SubData { plan?: string; status?: string; trialEndsAt?: string; trialMessagesUsed?: number; trialMessagesLimit?: number; }

const PLAN_COLORS: Record<string, string> = {
  trial: "#f59e0b", starter: "#14b8a6", pro: "#8b5cf6", agency: "#ec4899",
};

export default function AgencySidebar() {
  const pathname = usePathname();
  const [profile, setProfile]   = useState<AgencyProfile | null>(null);
  const [sub, setSub]           = useState<SubData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/agency-profile").then(r => r.json()).then(d => setProfile(d.profile));
    fetch("/api/user").then(r => r.json()).then(d => {
      if (d.user) setSub({ plan: d.user.plan, status: d.user.status, trialEndsAt: d.user.trialEndsAt, trialMessagesUsed: d.user.trialMessagesUsed, trialMessagesLimit: d.user.trialMessagesLimit });
    });
  }, []);

  const brand      = profile?.primaryColor || "#14b8a6";
  const agencyName = profile?.agencyName   || "My Agency";
  const isTrial    = sub?.status === "trialing";
  const planColor  = PLAN_COLORS[sub?.plan || "trial"] || "#14b8a6";
  const trialDaysLeft = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;
  const trialPct = sub?.trialMessagesLimit
    ? Math.min(100, Math.round(((sub.trialMessagesUsed || 0) / sub.trialMessagesLimit) * 100))
    : 0;

  const NavItem = ({ item }: { item: typeof NAV[0] }) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    return (
      <Link href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: "2px" }}
        onClick={() => setMobileOpen(false)}>
        <div style={{
          display: "flex", alignItems: "center", gap: "9px",
          padding: "9px 10px", borderRadius: "9px",
          background: active ? `${brand}18` : "transparent",
          borderLeft: `2px solid ${active ? brand : "transparent"}`,
          color: active ? brand : "#445566",
          fontSize: "13px", fontWeight: active ? 700 : 400,
          transition: "all 0.15s", cursor: "pointer",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#e2eaf4"; }}
          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#445566"; }}
        >
          <span style={{ fontSize: "15px", width: "20px", textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
          {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "18px 14px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
            {profile?.logoUrl
              ? <img src={profile.logoUrl} alt="logo" style={{ width: "30px", height: "30px", borderRadius: "8px", objectFit: "contain", flexShrink: 0 }} />
              : <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `linear-gradient(135deg,${brand}99,${brand})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0 }}>🏢</div>
            }
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#e2eaf4", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agencyName}</div>
              <div style={{ fontSize: "9px", color: brand, letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 700 }}>Agency Panel</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `linear-gradient(135deg,${brand}99,${brand})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>🏢</div>
        )}
        <button onClick={() => setCollapsed(c => !c)}
          style={{ background: "none", border: "none", color: "#2d3d50", cursor: "pointer", fontSize: "14px", padding: "4px", borderRadius: "6px", flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = "#7c9ab8")}
          onMouseLeave={e => (e.currentTarget.style.color = "#2d3d50")}>
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Trial CTA */}
      {isTrial && !collapsed && (
        <div style={{ margin: "12px 12px 0", padding: "12px 14px", borderRadius: "11px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.04em" }}>FREE TRIAL</span>
            <span style={{ fontSize: "11px", color: "#f59e0b" }}>{trialDaysLeft}d left</span>
          </div>
          <div style={{ height: "4px", borderRadius: "2px", background: "rgba(245,158,11,0.15)", overflow: "hidden", marginBottom: "8px" }}>
            <div style={{ height: "100%", width: `${trialPct}%`, background: "#f59e0b", borderRadius: "2px", transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: "11px", color: "#445566", marginBottom: "8px" }}>
            {sub?.trialMessagesUsed || 0}/{sub?.trialMessagesLimit || 50} messages used
          </div>
          <Link href="/pricing" style={{ textDecoration: "none" }}>
            <div style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "7px", padding: "6px 10px", fontSize: "11px", color: "#f59e0b", fontWeight: 600, textAlign: "center", cursor: "pointer" }}>
              Upgrade Now →
            </div>
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px" }}>
        {NAV.map(item => <NavItem key={item.href} item={item} />)}
      </nav>

      {/* Bottom: plan badge + upgrade link */}
      <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {!collapsed && sub?.plan && sub.plan !== "trial" && (
          <div style={{ marginBottom: "8px", padding: "8px 12px", borderRadius: "9px", background: `${planColor}12`, border: `1px solid ${planColor}25`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: planColor }}>{sub.plan.toUpperCase()}</span>
            <Link href="/pricing" style={{ fontSize: "10px", color: "#445566", textDecoration: "none" }}>Upgrade →</Link>
          </div>
        )}
        <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
          width: "100%", display: "flex", alignItems: "center", gap: "9px",
          padding: "9px 10px", borderRadius: "9px", cursor: "pointer",
          background: "none", border: "none", fontFamily: "inherit",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}>
          <span style={{ fontSize: "15px" }}>🚪</span>
          {!collapsed && <span style={{ fontSize: "13px", color: "#445566" }}>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(true)}
        className="agency-mobile-menu-btn"
        style={{ display: "none", position: "fixed", top: "16px", left: "16px", zIndex: 100, background: "rgba(13,21,37,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 12px", cursor: "pointer", fontSize: "18px", color: "#e2eaf4" }}
        aria-label="Open menu">☰</button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          className="agency-mobile-overlay"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 98 }} />
      )}

      {/* Desktop sidebar */}
      <aside className="agency-sidebar-desktop" style={{
        width: collapsed ? "64px" : "230px", minHeight: "100vh", height: "100vh",
        background: "rgba(6,11,18,0.99)", borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, overflowY: "auto", overflowX: "hidden",
        flexShrink: 0, transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <aside className="agency-sidebar-mobile" style={{
        position: "fixed", top: 0, left: mobileOpen ? 0 : "-280px",
        width: "260px", height: "100vh", zIndex: 99,
        background: "rgba(6,11,18,0.99)", borderRight: "1px solid rgba(255,255,255,0.08)",
        overflowY: "auto", transition: "left 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px" }}>
          <button onClick={() => setMobileOpen(false)}
            style={{ background: "none", border: "none", color: "#445566", fontSize: "20px", cursor: "pointer" }}>✕</button>
        </div>
        <SidebarContent />
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .agency-sidebar-desktop { display: none !important; }
          .agency-sidebar-mobile  { display: flex !important; flex-direction: column; }
          .agency-mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .agency-sidebar-mobile  { display: none !important; }
          .agency-mobile-overlay  { display: none !important; }
        }
      `}</style>
    </>
  );
}
