"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 97,
    badge: null,
    color: "#14b8a6",
    tagline: "Perfect for single-location businesses",
    locations: "1 location",
    features: [
      "1 GHL location",
      "SMS + Email automation",
      "Intent detection engine",
      "Contact memory system",
      "Human fallback safety",
      "Analytics dashboard",
      "Email support",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 197,
    badge: "MOST POPULAR",
    color: "#8b5cf6",
    tagline: "For growing agencies with multiple clients",
    locations: "Up to 5 locations",
    features: [
      "Up to 5 GHL locations",
      "Everything in Starter",
      "AI Agent decision engine",
      "Advanced pipeline automation",
      "GPT-4o model access",
      "Priority support",
      "Per-location configuration",
    ],
  },
  {
    key: "agency",
    name: "Agency",
    price: 397,
    badge: null,
    color: "#ec4899",
    tagline: "For large agencies scaling at volume",
    locations: "Up to 15 locations",
    features: [
      "Up to 15 GHL locations",
      "Everything in Pro",
      "Full AI agent system",
      "White-label option",
      "Multi-team management",
      "Custom AI training",
      "Dedicated account manager",
    ],
  },
];

// Payment method icons as inline SVG
function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 10H22" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 15H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function PayPalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.144 19.532l1.049-6.676.148-.086H9.95c2.942 0 5.002-1.408 5.604-4.27.057-.278.095-.544.115-.8C15.013 5.012 13.47 4 11.072 4H6.4c-.504 0-.932.364-1.011.862L3.5 18.67c-.058.365.222.695.594.695h2.488c.282 0 .523-.196.562-.466l.148-.943.852.176zM16.45 8.216c-.023.15-.049.302-.08.455-.724 3.597-3.297 5.129-6.556 5.129H8.39l-.978 6.22H5.1l.148-.941-.014-.016 1.49-9.48 1.517-.004.15-.96H12.6c1.7 0 2.967.5 3.607 1.397.195.27.32.572.38.893.07.41.05.857-.137 1.307z" fill="#009cde"/>
      <path d="M17.394 8.128c-.06-.32-.185-.622-.38-.893-.64-.896-1.907-1.397-3.607-1.397H9.39l-.15.96-1.517.004-1.49 9.48.014.016-.148.941h2.302l.978-6.22h1.424c3.259 0 5.832-1.532 6.556-5.129.031-.153.057-.305.08-.455-.19-.13-.398-.238-.615-.32-.19-.072-.388-.128-.594-.17l-.836.183z" fill="#012169"/>
    </svg>
  );
}

function VisaIcon() {
  return (
    <svg width="32" height="20" viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="13" fontFamily="Arial" fontWeight="800" fontSize="14" fill="#1a1f71">VISA</text>
    </svg>
  );
}
function MastercardIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="12" r="11" fill="#eb001b"/>
      <circle cx="24" cy="12" r="11" fill="#f79e1b"/>
      <path d="M19 4.8A11 11 0 0 1 24 12a11 11 0 0 1-5 7.2A11 11 0 0 1 14 12a11 11 0 0 1 5-7.2z" fill="#ff5f00"/>
    </svg>
  );
}
function AmexIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="38" height="24" rx="3" fill="#2557d6"/>
      <text x="5" y="17" fontFamily="Arial" fontWeight="800" fontSize="10" fill="white">AMEX</text>
    </svg>
  );
}

function PricingContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const canceled = params.get("canceled");

  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  // "card" = Stripe card checkout (Visa, Mastercard, Amex, etc.)
  // "paypal" = PayPal via Stripe
  const [paymentMethod, setPaymentMethod] = useState<"paystack" | "paypal">("paystack");

  useEffect(() => {
    if (session) {
      fetch("/api/user").then(r => r.json()).then(d => setCurrentPlan(d.user?.plan || null));
    }
  }, [session]);

  const handleSelect = (planKey: string) => {
    if (!session) { router.push("/register"); return; }
    // Send to dedicated checkout page — clean, no inline modal
    router.push(`/checkout?plan=${planKey}`);
  };

  const btnLabel = (planKey: string, isCurrentPlan: boolean) => {
    if (isCurrentPlan) return "✓ Current Plan";
    return `Upgrade to ${PLANS.find(p => p.key === planKey)?.name} →`;
  };

  return (
    <main style={{ minHeight: "100vh", background: "#080d16", padding: "0 0 80px" }}>
      {/* Background */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(20,184,166,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />

      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, padding: "14px clamp(16px,4vw,32px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid rgba(20,184,166,0.12)", background: "rgba(8,13,22,0.9)", backdropFilter: "blur(12px)" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "9px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>⚡</div>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#e2eaf4", letterSpacing: "-0.02em" }}>NexusReply</span>
        </Link>
        <div style={{ display: "flex", gap: "10px" }}>
          {session ? (
            <Link href="/dashboard"><button style={{ padding: "8px 18px", borderRadius: "9px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Dashboard →</button></Link>
          ) : (
            <>
              <Link href="/login"><button style={{ padding: "8px 16px", borderRadius: "9px", border: "1px solid rgba(20,184,166,0.25)", background: "transparent", color: "#7c9ab8", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>Sign In</button></Link>
              <Link href="/register"><button style={{ padding: "8px 18px", borderRadius: "9px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button></Link>
            </>
          )}
        </div>
      </nav>

      {/* Header */}
      <div style={{ textAlign: "center", padding: "64px clamp(16px,4vw,24px) 48px", maxWidth: "700px", margin: "0 auto" }}>
        {canceled && (
          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", padding: "12px 18px", marginBottom: "28px", fontSize: "13px", color: "#f59e0b" }}>
            Checkout canceled — no charge was made.
          </div>
        )}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "100px", padding: "5px 14px", marginBottom: "22px", fontSize: "11px", fontWeight: 700, color: "#14b8a6", letterSpacing: "0.06em" }}>
          ⚡ SIMPLE, TRANSPARENT PRICING
        </div>
        <h1 style={{ fontSize: "clamp(32px,6vw,58px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: "16px", color: "#e2eaf4" }}>
          Scale your sales on<br />
          <span style={{ background: "linear-gradient(135deg,#14b8a6,#5eead4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>autopilot</span>
        </h1>
        <p style={{ fontSize: "16px", color: "#7c9ab8", lineHeight: 1.65, marginBottom: "10px" }}>
          Start with a 3-day free trial — 50 messages, no credit card. Upgrade when ready.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "18px", fontSize: "13px", color: "#445566", flexWrap: "wrap" }}>
          {["Cancel anytime", "No setup fees", "Instant activation"].map(f => (
            <span key={f} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ color: "#14b8a6" }}>✓</span> {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── Payment Method Selector ── */}
      <div style={{ maxWidth: "520px", margin: "0 auto 40px", padding: "0 clamp(16px,4vw,24px)" }}>
        <p style={{ textAlign: "center", fontSize: "13px", color: "#7c9ab8", marginBottom: "14px", fontWeight: 600 }}>
          CHOOSE PAYMENT METHOD
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {/* Card option */}
          <button
            onClick={() => setPaymentMethod("paystack")}
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              border: `2px solid ${paymentMethod === "paystack" ? "#14b8a6" : "rgba(255,255,255,0.08)"}`,
              background: paymentMethod === "paystack" ? "rgba(20,184,166,0.08)" : "rgba(13,21,37,0.8)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: paymentMethod === "paystack" ? "#14b8a6" : "#7c9ab8" }}>
              <CardIcon />
              <span style={{ fontSize: "14px", fontWeight: 700 }}>Credit / Debit Card</span>
            </div>
            {/* Card logos */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <VisaIcon />
              <MastercardIcon />
              <AmexIcon />
              <span style={{ fontSize: "11px", color: "#445566" }}>+ more</span>
            </div>
          </button>

          {/* PayPal option */}
          <button
            onClick={() => setPaymentMethod("paypal")}
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              border: `2px solid ${paymentMethod === "paypal" ? "#009cde" : "rgba(255,255,255,0.08)"}`,
              background: paymentMethod === "paypal" ? "rgba(0,156,222,0.07)" : "rgba(13,21,37,0.8)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <PayPalIcon />
              <span style={{ fontSize: "14px", fontWeight: 700, color: paymentMethod === "paypal" ? "#009cde" : "#7c9ab8" }}>PayPal</span>
            </div>
            <span style={{ fontSize: "11px", color: "#445566" }}>Pay via your PayPal account</span>
          </button>
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "14px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "#445566", display: "flex", alignItems: "center", gap: "5px" }}>🔒 256-bit SSL encryption</span>
          <span style={{ fontSize: "11px", color: "#445566", display: "flex", alignItems: "center", gap: "5px" }}>🛡 Powered by Stripe</span>
          <span style={{ fontSize: "11px", color: "#445566", display: "flex", alignItems: "center", gap: "5px" }}>✓ PCI compliant</span>
        </div>
      </div>

      {/* Pricing cards */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 clamp(16px,4vw,24px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", alignItems: "start" }}>
        {PLANS.map((plan, i) => {
          const isCurrentPlan = currentPlan === plan.key;
          const isPopular = plan.badge === "MOST POPULAR";
          const isLoading = loading === plan.key;
          return (
            <div key={plan.key} style={{
              borderRadius: "20px",
              padding: "30px",
              background: "rgba(13,21,37,0.9)",
              border: `1px solid ${isPopular ? plan.color + "44" : "rgba(255,255,255,0.08)"}`,
              position: "relative",
              transform: isPopular ? "scale(1.02)" : "none",
              boxShadow: isPopular ? `0 0 40px ${plan.color}18` : "none",
              backdropFilter: "blur(12px)",
              animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
            }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)", background: plan.color, color: "white", fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", padding: "4px 14px", borderRadius: "100px", whiteSpace: "nowrap" }}>
                  {plan.badge}
                </div>
              )}

              {/* Plan header */}
              <div style={{ marginBottom: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "8px" }}>
                  <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: plan.color, boxShadow: `0 0 8px ${plan.color}` }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: plan.color, letterSpacing: "0.05em" }}>{plan.name.toUpperCase()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "46px", fontWeight: 800, letterSpacing: "-0.04em", color: "#e2eaf4", lineHeight: 1 }}>${plan.price}</span>
                  <span style={{ fontSize: "14px", color: "#445566", marginBottom: "8px" }}>/month</span>
                </div>
                <p style={{ fontSize: "13px", color: "#7c9ab8", lineHeight: 1.5 }}>{plan.tagline}</p>
              </div>

              {/* Quick stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "22px" }}>
                {[{ icon: "📍", label: plan.locations }, { icon: "�", label: "AI automation" }].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "9px", padding: "9px 11px", fontSize: "11px", color: "#7c9ab8" }}>
                    <span style={{ marginRight: "5px" }}>{s.icon}</span>{s.label}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleSelect(plan.key)}
                disabled={isCurrentPlan || isLoading}
                style={{
                  width: "100%", padding: "13px", borderRadius: "11px", border: "none",
                  background: isCurrentPlan
                    ? "rgba(20,184,166,0.1)"
                    : paymentMethod === "paypal"
                    ? "linear-gradient(135deg, #003087, #009cde)"
                    : `linear-gradient(135deg, ${plan.color}dd, ${plan.color})`,
                  color: isCurrentPlan ? "#14b8a6" : "white",
                  fontFamily: "inherit", fontWeight: 700, fontSize: "14px",
                  cursor: isCurrentPlan ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  marginBottom: "22px",
                  boxShadow: isCurrentPlan ? "none"
                    : paymentMethod === "paypal" ? "0 4px 20px rgba(0,156,222,0.3)"
                    : `0 4px 20px ${plan.color}30`,
                  transition: "all 0.2s",
                  opacity: isLoading ? 0.8 : 1,
                }}
                onMouseEnter={(e) => { if (!isCurrentPlan) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
              >
                {isLoading ? (
                  <>
                    <span style={{ width: "15px", height: "15px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                    Redirecting…
                  </>
                ) : (
                  <>
                    {paymentMethod === "paypal" && !isCurrentPlan && <PayPalIcon />}
                    {btnLabel(plan.key, isCurrentPlan)}
                  </>
                )}
              </button>

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "9px", fontSize: "13px", color: "#7c9ab8" }}>
                    <span style={{ color: plan.color, flexShrink: 0, marginTop: "1px" }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Accepted payment methods strip */}
      <div style={{ maxWidth: "700px", margin: "40px auto 0", padding: "0 clamp(16px,4vw,24px)", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: "#445566", marginBottom: "12px" }}>ACCEPTED PAYMENT METHODS</p>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {[
            { name: "Visa", bg: "#1a1f71", text: "VISA", textColor: "white", w: 52 },
            { name: "Mastercard", bg: "transparent", text: "MC", textColor: "transparent", w: 40 },
            { name: "Amex", bg: "#2557d6", text: "AMEX", textColor: "white", w: 52 },
            { name: "Discover", bg: "#ff6600", text: "DISC", textColor: "white", w: 52 },
            { name: "PayPal", bg: "#003087", text: "PayPal", textColor: "white", w: 60 },
          ].map(card => (
            <div key={card.name} style={{ height: "28px", padding: "0 10px", borderRadius: "5px", border: "1px solid rgba(255,255,255,0.1)", background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", minWidth: card.w }}>
              {card.name === "Mastercard" ? (
                <div style={{ display: "flex" }}>
                  <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#eb001b" }} />
                  <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#f79e1b", marginLeft: "-8px", opacity: 0.9 }} />
                </div>
              ) : (
                <span style={{ fontSize: "11px", fontWeight: 800, color: card.textColor, letterSpacing: "0.03em" }}>{card.text}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Free trial banner */}
      <div style={{ maxWidth: "640px", margin: "48px auto 0", padding: "0 clamp(16px,4vw,24px)" }}>
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "18px", padding: "32px 36px", textAlign: "center", backdropFilter: "blur(12px)" }}>
          <div style={{ fontSize: "28px", marginBottom: "12px" }}>⚡</div>
          <h3 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "10px", color: "#e2eaf4" }}>Not ready to commit?</h3>
          <p style={{ color: "#7c9ab8", fontSize: "14px", marginBottom: "22px", lineHeight: 1.65 }}>
            Start with our free 3-day trial. 50 AI messages, full features, zero credit card required.
          </p>
          <Link href="/register">
            <button style={{ padding: "13px 32px", borderRadius: "11px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(20,184,166,0.3)" }}>
              Start Free Trial — No Card Needed
            </button>
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: "680px", margin: "52px auto 0", padding: "0 clamp(16px,4vw,24px)" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "20px", textAlign: "center", color: "#e2eaf4" }}>Common questions</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {[
            { q: "Which cards do you accept?", a: "We accept all major credit and debit cards — Visa, Mastercard, American Express, Discover, and most international cards. Payments are processed securely by Stripe." },
            { q: "Can I pay with PayPal?", a: "Yes — select the PayPal option above before choosing your plan. You'll be redirected to PayPal to complete payment and then returned to your dashboard." },
            { q: "What counts as a message?", a: "Each time your AI sends an SMS or Email reply to a lead counts as 1 message. Receiving messages from leads doesn't count." },
            { q: "Can I switch plans anytime?", a: "Yes — upgrade or downgrade at any time. Changes take effect immediately and billing is prorated." },
            { q: "What happens when I hit my message limit?", a: "Your AI pauses automatically. You'll get a notification and can upgrade immediately to resume." },
            { q: "Do you offer refunds?", a: "We offer a full refund within 7 days of your first paid charge if you're not satisfied." },
          ].map((item, i) => (
            <details key={i} style={{ background: "rgba(13,21,37,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "11px", padding: "15px 20px", cursor: "pointer" }}>
              <summary style={{ fontWeight: 600, fontSize: "14px", color: "#e2eaf4", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                {item.q}
                <span style={{ color: "#14b8a6", fontSize: "18px", flexShrink: 0 }}>+</span>
              </summary>
              <p style={{ marginTop: "12px", fontSize: "13px", color: "#7c9ab8", lineHeight: 1.65 }}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080d16" }} />}>
      <PricingContent />
    </Suspense>
  );
}
