"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

// Client panel — no billing, no locations, no branding. AI Team Chat added here.
const NAV = [
  { href: "/client",                icon: "🏠", label: "Overview"        },
  { href: "/client/setup",       icon: "📊", label: "AI Setup"     },
  { href: "/client/pipeline",       icon: "📊", label: "My Pipeline"     },
  { href: "/client/conversations",  icon: "🗨️", label: "Conversations"   },
  { href: "/client/contacts",       icon: "👥", label: "Contacts"        },
  { href: "/client/ai-team",        icon: "🤖", label: "AI Sales Team"   },
  { href: "/client/team-chat",      icon: "💬", label: "AI Team Chat"    },
  { href: "/client/analytics",      icon: "📈", label: "Analytics"       },
  { href: "/client/notifications",  icon: "🔔", label: "Notifications"   },
  { href: "/client/settings",       icon: "⚙️", label: "Settings"        },
  { href: "/client/diagnostics",    icon: "🔬", label: "Diagnostics"     },
];

interface AgencyProfile {
  agencyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tagline?: string;
  supportEmail?: string;
  website?: string;
}

export default function ClientSidebar({
  locationName,
  agencyProfile,
}: {
  locationName: string;
  agencyProfile?: AgencyProfile | null;
}) {
  const pathname  = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const brand      = agencyProfile?.primaryColor  || "#14b8a6";
  const bg         = agencyProfile?.secondaryColor || "rgba(6,11,18,0.98)";
  const agencyName = agencyProfile?.agencyName    || "NexusReply";

  const NavItem = ({ item }: { item: typeof NAV[0] }) => {
    const active = pathname === item.href || (item.href !== "/client" && pathname.startsWith(item.href));
    return (
      <Link href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: "2px" }}
        onClick={() => setMobileOpen(false)}>
        <div style={{
          display: "flex", alignItems: "center", gap: "9px",
          padding: "9px 10px", borderRadius: "9px",
          background: active ? `${brand}18` : "transparent",
          border: `1px solid ${active ? brand + "35" : "transparent"}`,
          borderLeft: `2px solid ${active ? brand : "transparent"}`,
          color: active ? brand : "#445566",
          fontSize: "13px", fontWeight: active ? 700 : 400,
          transition: "all 0.15s", cursor: "pointer",
        }}
          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#e2eaf4"; }}
          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#445566"; }}
        >
          <span style={{ fontSize: "15px", width: "20px", textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Branding header */}
      <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          {agencyProfile?.logoUrl
            ? <img src={agencyProfile.logoUrl} alt="logo" style={{ width: "30px", height: "30px", borderRadius: "8px", objectFit: "contain", flexShrink: 0 }} />
            : <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `linear-gradient(135deg,${brand}99,${brand})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>🏢</div>
          }
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#e2eaf4", letterSpacing: "-0.02em" }}>{agencyName}</div>
            <div style={{ fontSize: "9px", color: brand, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Client Portal</div>
          </div>
        </div>
        {/* Location badge */}
        <div style={{ marginTop: "10px", padding: "7px 10px", background: `${brand}12`, borderRadius: "8px", border: `1px solid ${brand}20` }}>
          <div style={{ fontSize: "10px", color: "#2d3d50", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Your Location</div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: brand, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{locationName}</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {NAV.map(item => <NavItem key={item.href} item={item} />)}
      </nav>

      {/* Agency support info */}
      {(agencyProfile?.supportEmail || agencyProfile?.website) && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: "11px" }}>
          <div style={{ color: "#2d3d50", marginBottom: "6px", fontWeight: 600, letterSpacing: "0.04em" }}>SUPPORT</div>
          {agencyProfile.supportEmail && (
            <a href={`mailto:${agencyProfile.supportEmail}`} style={{ display: "block", color: "#445566", textDecoration: "none", marginBottom: "3px" }}>✉️ {agencyProfile.supportEmail}</a>
          )}
          {agencyProfile.website && (
            <a href={agencyProfile.website} target="_blank" rel="noreferrer" style={{ display: "block", color: "#445566", textDecoration: "none" }}>🌐 {agencyProfile.website.replace(/^https?:\/\//, "")}</a>
          )}
        </div>
      )}

      {/* Sign out */}
      <div style={{ padding: "10px 10px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
          width: "100%", display: "flex", alignItems: "center", gap: "9px",
          padding: "9px 10px", borderRadius: "9px", cursor: "pointer",
          background: "none", border: "none", fontFamily: "inherit",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}>
          <span style={{ fontSize: "15px" }}>🚪</span>
          <span style={{ fontSize: "13px", color: "#445566" }}>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(true)}
        className="client-mobile-btn"
        style={{ display: "none", position: "fixed", top: "16px", left: "16px", zIndex: 100, background: bg, border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 12px", cursor: "pointer", fontSize: "18px", color: "#e2eaf4" }}
        aria-label="Open menu">☰</button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 98 }} />
      )}

      {/* Desktop sidebar */}
      <div className="client-sidebar-desktop" style={{
        width: "224px", flexShrink: 0, background: bg,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", minHeight: "100vh",
        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
      }}>
        <SidebarContent />
      </div>

      {/* Mobile drawer */}
      <div className="client-sidebar-mobile" style={{
        position: "fixed", top: 0, left: mobileOpen ? 0 : "-280px",
        width: "260px", height: "100vh", zIndex: 99,
        background: bg, borderRight: "1px solid rgba(255,255,255,0.08)",
        overflowY: "auto", transition: "left 0.3s cubic-bezier(0.4,0,0.2,1)",
        flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px" }}>
          <button onClick={() => setMobileOpen(false)}
            style={{ background: "none", border: "none", color: "#445566", fontSize: "20px", cursor: "pointer" }}>✕</button>
        </div>
        <SidebarContent />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .client-sidebar-desktop { display: none !important; }
          .client-sidebar-mobile  { display: flex !important; }
          .client-mobile-btn      { display: flex !important; }
        }
        @media (min-width: 769px) {
          .client-sidebar-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
}
