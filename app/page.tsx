"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function HomePage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div style={{ minHeight: "100vh", background: "#060c14", color: "#e2eaf4", fontFamily: "var(--font-sora, sans-serif)" }}>
      {/* Ambient */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(20,184,166,0.15) 0%, transparent 60%)", pointerEvents: "none" }} />

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, padding: "0 clamp(20px,5vw,64px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", background: "rgba(6,12,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "9px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", boxShadow: "0 0 16px rgba(20,184,166,0.4)" }}>⚡</div>
          <span style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.03em" }}>NexusReply</span>
        </Link>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Link href="/docs" style={{ textDecoration: "none", fontSize: "13px", color: "#7c9ab8", padding: "7px 14px", borderRadius: "8px", transition: "color 0.15s" }}>Docs</Link>
          <Link href="/pricing" style={{ textDecoration: "none", fontSize: "13px", color: "#7c9ab8", padding: "7px 14px", borderRadius: "8px", transition: "color 0.15s" }}>Pricing</Link>
          <Link href="/contact" style={{ textDecoration: "none", fontSize: "13px", color: "#7c9ab8", padding: "7px 14px", borderRadius: "8px", transition: "color 0.15s" }}>Contact</Link>
          {session ? (
            <Link href="/dashboard"><button style={{ padding: "8px 18px", borderRadius: "9px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>Dashboard →</button></Link>
          ) : (
            <>
              <Link href="/login"><button style={{ padding: "8px 16px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#7c9ab8", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>Sign In</button></Link>
              <Link href="/register"><button style={{ padding: "8px 18px", borderRadius: "9px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(20,184,166,0.3)" }}>Try Free →</button></Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: "relative", textAlign: "center", padding: "clamp(80px,12vw,140px) clamp(20px,5vw,40px) clamp(60px,8vw,100px)", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.25)", borderRadius: "100px", padding: "5px 16px", marginBottom: "28px", fontSize: "11px", fontWeight: 700, color: "#14b8a6", letterSpacing: "0.07em" }}
          className={mounted ? "fade-in-up" : ""}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#14b8a6", boxShadow: "0 0 6px rgba(20,184,166,0.8)", animation: "pulse 2s infinite", display: "inline-block" }} />
          AI SALES TEAM FOR GOHIGHLEVEL
        </div>
        
        <h1 style={{ fontSize: "clamp(42px,7vw,82px)", fontWeight: 800, lineHeight: 1.06, letterSpacing: "-0.05em", marginBottom: "24px" }}
          className={mounted ? "fade-in-up fade-in-up-delay-1" : ""}>
          Your AI Sales Team<br />
          <span style={{ background: "linear-gradient(135deg,#14b8a6 0%,#5eead4 50%,#14b8a6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Closes Deals 24/7
          </span>
        </h1>

        <p style={{ fontSize: "clamp(16px,2.2vw,20px)", color: "#7c9ab8", lineHeight: 1.7, maxWidth: "640px", margin: "0 auto 40px" }}
          className={mounted ? "fade-in-up fade-in-up-delay-2" : ""}>
          Deploy a full AI sales team — Qualifier, Setter, Closer, Follow-up — that automatically moves leads through your pipeline via SMS & Email, sounding 100% human.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}
          className={mounted ? "fade-in-up fade-in-up-delay-3" : ""}>
          <Link href={session ? "/dashboard" : "/register"}>
            <button style={{ padding: "15px 36px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontSize: "16px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 32px rgba(20,184,166,0.35)", transition: "all 0.2s" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"}>
              {session ? "Open Dashboard →" : "Start Free — No Card Needed"}
            </button>
          </Link>
          <Link href="/docs">
            <button style={{ padding: "15px 28px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#7c9ab8", fontSize: "16px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#14b8a6"; (e.currentTarget as HTMLButtonElement).style.color = "#14b8a6"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#7c9ab8"; }}>
              View Docs
            </button>
          </Link>
        </div>
      </section>

      {/* Pipeline visualization */}
      <section style={{ maxWidth: "900px", margin: "0 auto 100px", padding: "0 clamp(20px,5vw,40px)", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: "#445566", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "20px" }}>HOW YOUR AI SALES TEAM WORKS</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
          {[
            { icon: "🤝", name: "Alex", role: "Qualifies", color: "#14b8a6" },
            { icon: "📅", name: "Sarah", role: "Books", color: "#8b5cf6" },
            { icon: "🔥", name: "Marcus", role: "Closes", color: "#f59e0b" },
            { icon: "💰", name: "SALE", role: "Revenue", color: "#22c55e" },
          ].map((a, i, arr) => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "rgba(13,21,37,0.9)", border: `1px solid ${a.color}33`, borderRadius: "14px", padding: "16px 20px", textAlign: "center", minWidth: "90px" }}>
                <div style={{ fontSize: "26px", marginBottom: "6px" }}>{a.icon}</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: a.name === "SALE" ? a.color : "#e2eaf4" }}>{a.name}</div>
                <div style={{ fontSize: "10px", color: a.color, fontWeight: 600, letterSpacing: "0.04em" }}>{a.role.toUpperCase()}</div>
              </div>
              {i < arr.length - 1 && <div style={{ fontSize: "18px", color: "#1e2d3d" }}>→</div>}
            </div>
          ))}
        </div>
        <p style={{ marginTop: "16px", fontSize: "13px", color: "#445566" }}>Automatic handoff between agents based on lead intent and pipeline stage</p>
      </section>

      {/* Stats */}
      <section style={{ maxWidth: "800px", margin: "0 auto 100px", padding: "0 clamp(20px,5vw,40px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1px", background: "rgba(255,255,255,0.06)", borderRadius: "18px", overflow: "hidden" }}>
        {[
          { value: "< 3s", label: "Response Time" },
          { value: "4 AI Agents", label: "Pre-trained & Ready" },
          { value: "24/7", label: "Always Active" },
          { value: "100%", label: "Sounds Human" },
        ].map(s => (
          <div key={s.label} style={{ background: "#060c14", padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#14b8a6", letterSpacing: "-0.03em", marginBottom: "6px" }}>{s.value}</div>
            <div style={{ fontSize: "12px", color: "#445566" }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section style={{ maxWidth: "1100px", margin: "0 auto 100px", padding: "0 clamp(20px,5vw,40px)" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: "16px" }}>Built to close, not just chat</h2>
        <p style={{ textAlign: "center", color: "#7c9ab8", fontSize: "16px", marginBottom: "56px", maxWidth: "540px", margin: "0 auto 56px" }}>Every feature drives one outcome: more revenue from the same leads.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: "16px" }}>
          {[
            { icon: "👥", title: "AI Sales Team Builder", desc: "Create named AI agents — Alex, Sarah, Marcus — each with their own role, personality, and mission in your pipeline." },
            { icon: "🔄", title: "Smart Agent Handoffs", desc: "AI detects buying intent and automatically switches agents. Lead asks about price? Marcus the closer takes over instantly." },
            { icon: "📊", title: "Live Pipeline Sync", desc: "Your GHL pipeline updates in real-time as leads move through stages. See exactly where every contact is in the journey." },
            { icon: "🔗", title: "One-Click Setup", desc: "Connect GoHighLevel, get your webhook auto-registered, pipeline auto-created. Zero manual configuration." },
            { icon: "🔔", title: "Live Notifications", desc: "Get real-time alerts when leads move stages, agents hand off, or deals are won. Always know what's happening." },
            { icon: "🛡", title: "Admin Control Center", desc: "Train and update AI agents globally. Improve the closer's script. Roll back changes. Full version control." },
          ].map(f => (
            <div key={f.title} style={{ background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "26px", transition: "all 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(20,184,166,0.25)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}>
              <div style={{ fontSize: "28px", marginBottom: "14px" }}>{f.icon}</div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "9px", color: "#e2eaf4" }}>{f.title}</h3>
              <p style={{ fontSize: "13px", color: "#7c9ab8", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: "620px", margin: "0 auto 100px", padding: "0 clamp(20px,5vw,40px)", textAlign: "center" }}>
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "22px", padding: "clamp(32px,5vw,56px)" }}>
          <h2 style={{ fontSize: "clamp(26px,4vw,36px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "14px" }}>
            Ready to automate your sales?
          </h2>
          <p style={{ color: "#7c9ab8", fontSize: "15px", marginBottom: "28px", lineHeight: 1.6 }}>
            3-day free trial. 50 AI messages. Full access to all 4 agents. No credit card.
          </p>
          <Link href={session ? "/dashboard" : "/register"}>
            <button style={{ padding: "15px 40px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontSize: "16px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 32px rgba(20,184,166,0.35)" }}>
              {session ? "Go to Dashboard →" : "Start Free Trial →"}
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "28px clamp(20px,5vw,40px)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>⚡</div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#7c9ab8" }}>NexusReply</span>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          {[["Pricing","/pricing"],["Docs","/docs"],["Contact","/contact"],["Login","/login"],["Register","/register"]].map(([label,href]) => (
            <Link key={label} href={href} style={{ fontSize: "13px", color: "#445566", textDecoration: "none" }}>{label}</Link>
          ))}
        </div>
        <div style={{ fontSize: "12px", color: "#2d3d50" }}>© {new Date().getFullYear()} NexusReply</div>
      </footer>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .fade-in-up{animation:fadeInUp 0.6s ease both}
        .fade-in-up-delay-1{animation-delay:0.1s;opacity:0}
        .fade-in-up-delay-2{animation-delay:0.2s;opacity:0}
        .fade-in-up-delay-3{animation-delay:0.3s;opacity:0}
        *{box-sizing:border-box}
      `}</style>
    </div>
  );
}
