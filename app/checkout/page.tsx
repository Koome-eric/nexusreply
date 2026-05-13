"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PAYMENT_PLAN_CODES } from "@/lib/plans";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any;
  }
}

const PLAN_DATA: Record<string, {
  name: string; price: number; color: string;
  locations: string; highlight: string; features: string[];
}> = {
  starter: {
    name: "Starter", price: 97, color: "#14b8a6",
    locations: "1 location", highlight: "AI automation",
    features: ["1 GHL location", "SMS + Email automation", "Intent detection engine", "Contact memory", "Email support"],
  },
  pro: {
    name: "Pro", price: 197, color: "#8b5cf6",
    locations: "Up to 5 locations", highlight: "Priority support",
    features: ["Up to 5 GHL locations", "Everything in Starter", "AI Agent decision engine", "Pipeline automation", "Priority support"],
  },
  agency: {
    name: "Agency", price: 397, color: "#ec4899",
    locations: "Up to 15 locations", highlight: "Dedicated support",
    features: ["Up to 15 GHL locations", "Everything in Pro", "White-label branding", "Multi-team management", "Dedicated support"],
  },
};

type PayMethod = "paystack" | "paypal";

function Spinner({ size = 16, color = "white" }: { size?: number; color?: string }) {
  return <span style={{ width: size, height: size, border: `2px solid ${color}44`, borderTopColor: color, borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />;
}

function CheckoutContent() {
  const router      = useRouter();
  const params      = useSearchParams();
  const { data: session, status } = useSession();

  const rawPlan  = params.get("plan") || "starter";
  const plan      = rawPlan.toLowerCase() as keyof typeof PLAN_DATA;
  const canceled  = params.get("canceled") === "true";
  const planData  = PLAN_DATA[plan] || PLAN_DATA.starter;
  const planCodes = PAYMENT_PLAN_CODES[plan as keyof typeof PAYMENT_PLAN_CODES];

  const [method, setMethod]       = useState<PayMethod>("paystack");
  const [loading, setLoading]     = useState(false);
  const [ppLoading, setPpLoading] = useState(true);   // paypal sdk loading
  const [error, setError]         = useState(canceled ? "Payment was canceled — no charge was made." : "");
  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalRendered = useRef(false);

  const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

  // Load PayPal JS SDK dynamically
  useEffect(() => {
    if (!PAYPAL_CLIENT_ID) { setPpLoading(false); return; }
    const existing = document.getElementById("paypal-sdk");
    if (existing) { setPpLoading(false); return; }

    const script = document.createElement("script");
    script.id  = "paypal-sdk";
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription&currency=USD&disable-funding=credit,card`;
    script.onload  = () => setPpLoading(false);
    script.onerror = () => setPpLoading(false);
    document.head.appendChild(script);
  }, [PAYPAL_CLIENT_ID]);

  // Render PayPal button when SDK ready + method is paypal
  useEffect(() => {
    if (method !== "paypal" || ppLoading || !window.paypal || paypalRendered.current) return;
    if (!paypalRef.current) return;
    paypalRendered.current = true;

    window.paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "subscribe", height: 48 },

      createSubscription: async (_data: any, actions: any) => {
        if (!planCodes?.paypalPlanId) {
          throw new Error("PayPal plan ID is not configured");
        }
        return actions.subscription.create({
          plan_id: planCodes.paypalPlanId,
        });
      },

      onApprove: async (data: { subscriptionID: string }) => {
        setLoading(true);
        setError("");
        const res = await fetch("/api/billing/paypal-capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionID: data.subscriptionID, plan }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || "Subscription activation failed. Please contact support.");
          setLoading(false);
          return;
        }
        // Refresh session so plan updates in UI
        await fetch("/api/auth/session");
        const dest = getRoleDest((session?.user as { role?: string })?.role);
        router.push(`${dest}?upgraded=true&plan=${plan}&provider=paypal`);
        router.refresh();
      },

      onError: (err: unknown) => {
        console.error("[PayPal onError]", err);
        setError("PayPal encountered an error. Please try again or use Paystack.");
      },

      onCancel: () => {
        setError("Subscription was canceled — no charge was made.");
      },
    }).render(paypalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, ppLoading]);

  // Reset PayPal button when switching back
  useEffect(() => {
    if (method !== "paypal") {
      paypalRendered.current = false;
      if (paypalRef.current) paypalRef.current.innerHTML = "";
    }
  }, [method]);

  function getRoleDest(role?: string) {
    return role === "agency" ? "/agency/settings" : "/dashboard/settings";
  }

  const handlePaystack = async () => {
    setLoading(true);
    setError("");
    const res  = await fetch("/api/billing/paystack-init", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setError(data.error || "Could not start payment. Please try again.");
      setLoading(false);
      return;
    }
    window.location.href = data.url;
  };

  if (status === "unauthenticated") {
    router.push(`/login?callbackUrl=/checkout?plan=${plan}`);
    return null;
  }

  const brand = planData.color;

  return (
    <div style={{ minHeight: "100vh", background: "#080d16", padding: "32px 24px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, background: `radial-gradient(ellipse at 70% 0%, ${brand}12 0%, transparent 55%)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto" }}>

        {/* Back link */}
        <Link href="/pricing" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#445566", textDecoration: "none", fontSize: "13px", marginBottom: "28px", transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#7c9ab8"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#445566"}>
          ← Back to pricing
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "24px", alignItems: "start" }}>

          {/* ── LEFT: Plan summary ── */}
          <div style={{ background: "rgba(13,21,37,0.9)", border: `1px solid ${brand}25`, borderRadius: "18px", padding: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: brand, background: `${brand}18`, padding: "4px 12px", borderRadius: "6px", letterSpacing: "0.05em" }}>
                {planData.name.toUpperCase()} PLAN
              </span>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "44px", fontWeight: 900, color: "#e2eaf4", letterSpacing: "-0.04em", lineHeight: 1 }}>
                ${planData.price}
                <span style={{ fontSize: "16px", fontWeight: 500, color: "#7c9ab8" }}>/mo</span>
              </div>
              <div style={{ fontSize: "13px", color: "#445566", marginTop: "6px" }}>Billed monthly · Cancel anytime</div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
              {[planData.locations, planData.highlight].map(s => (
                <div key={s} style={{ flex: "1 1 120px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "12px", color: "#e2eaf4", fontWeight: 600 }}>{s.split(" ").slice(0, 2).join(" ")}</div>
                  <div style={{ fontSize: "10px", color: "#445566", marginTop: "2px" }}>{s.split(" ").slice(2).join(" ")}</div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#2d3d50", letterSpacing: "0.06em", marginBottom: "12px" }}>WHAT YOU GET</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {planData.features.map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "#7c9ab8" }}>
                    <span style={{ color: brand, flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust badges */}
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {["🔒 Secure payment", "↩️ Cancel anytime", "✉️ Instant activation"].map(b => (
                <span key={b} style={{ fontSize: "11px", color: "#2d3d50", background: "rgba(255,255,255,0.04)", padding: "4px 10px", borderRadius: "6px" }}>{b}</span>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Payment ── */}
          <div style={{ background: "rgba(13,21,37,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "28px", position: "sticky", top: "24px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 800, color: "#e2eaf4", margin: "0 0 20px", letterSpacing: "-0.02em" }}>
              Complete your order
            </h2>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "11px 14px", marginBottom: "18px", fontSize: "13px", color: "#f87171" }}>
                ⚠️ {error}
              </div>
            )}

            {/* Method selector */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#2d3d50", letterSpacing: "0.06em", marginBottom: "10px" }}>PAYMENT METHOD</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

                {/* Paystack */}
                <button
                  onClick={() => setMethod("paystack")}
                  style={{
                    padding: "13px 14px", borderRadius: "11px", cursor: "pointer",
                    border: `2px solid ${method === "paystack" ? "#14b8a6" : "rgba(255,255,255,0.08)"}`,
                    background: method === "paystack" ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                    display: "flex", alignItems: "center", gap: "12px",
                    fontFamily: "inherit", transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: "22px" }}>🇳🇬</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2eaf4" }}>Paystack</div>
                    <div style={{ fontSize: "11px", color: "#445566" }}>Cards, M-Pesa, Bank transfer — Africa</div>
                  </div>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: `2px solid ${method === "paystack" ? "#14b8a6" : "#2d3d50"}`, background: method === "paystack" ? "#14b8a6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {method === "paystack" && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "white" }} />}
                  </div>
                </button>

                {/* PayPal */}
                <button
                  onClick={() => setMethod("paypal")}
                  style={{
                    padding: "13px 14px", borderRadius: "11px", cursor: "pointer",
                    border: `2px solid ${method === "paypal" ? "#0070ba" : "rgba(255,255,255,0.08)"}`,
                    background: method === "paypal" ? "rgba(0,112,186,0.08)" : "rgba(255,255,255,0.02)",
                    display: "flex", alignItems: "center", gap: "12px",
                    fontFamily: "inherit", transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: "22px" }}>🌍</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2eaf4" }}>PayPal</div>
                    <div style={{ fontSize: "11px", color: "#445566" }}>Global — Visa, Mastercard, PayPal balance</div>
                  </div>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: `2px solid ${method === "paypal" ? "#0070ba" : "#2d3d50"}`, background: method === "paypal" ? "#0070ba" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {method === "paypal" && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "white" }} />}
                  </div>
                </button>
              </div>
            </div>

            {/* Order total */}
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "14px 16px", marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", color: "#7c9ab8" }}>NexusReply {planData.name}</span>
                <span style={{ fontSize: "13px", color: "#e2eaf4", fontWeight: 600 }}>${planData.price}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#e2eaf4" }}>Total today</span>
                <span style={{ fontSize: "18px", fontWeight: 900, color: brand }}>${planData.price}</span>
              </div>
            </div>

            {/* Pay button — Paystack */}
            {method === "paystack" && (
              <button
                onClick={handlePaystack}
                disabled={loading}
                style={{
                  width: "100%", padding: "14px", borderRadius: "11px", border: "none",
                  background: loading ? "rgba(20,184,166,0.5)" : "linear-gradient(135deg,#0d9488,#14b8a6)",
                  color: "white", fontSize: "15px", fontWeight: 800,
                  cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  boxShadow: "0 4px 20px rgba(20,184,166,0.35)",
                }}
              >
                {loading ? <><Spinner /> Redirecting to Paystack…</> : `Pay $${planData.price} with Paystack`}
              </button>
            )}

            {/* PayPal button container */}
            {method === "paypal" && (
              <div>
                {ppLoading ? (
                  <div style={{ width: "100%", height: "48px", borderRadius: "11px", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <Spinner size={14} color="#7c9ab8" />
                    <span style={{ fontSize: "13px", color: "#445566" }}>Loading PayPal…</span>
                  </div>
                ) : !PAYPAL_CLIENT_ID ? (
                  <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "12px", color: "#f87171", textAlign: "center" }}>
                    PayPal is not configured yet. Please use Paystack or contact support.
                  </div>
                ) : !planCodes?.paypalPlanId ? (
                  <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: "12px", color: "#f59e0b", textAlign: "center" }}>
                    PayPal subscription plan for {planData.name} is not set up yet. Please use Paystack or contact support.
                  </div>
                ) : (
                  <div>
                    <div ref={paypalRef} id="paypal-button-container" style={{ minHeight: "48px" }} />
                    {loading && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "10px", fontSize: "13px", color: "#7c9ab8" }}>
                        <Spinner size={14} color="#7c9ab8" /> Processing payment…
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <p style={{ textAlign: "center", marginTop: "14px", fontSize: "11px", color: "#2d3d50", lineHeight: "1.5" }}>
              By completing this purchase you agree to our Terms of Service.
              Subscription renews monthly. Cancel anytime from your settings.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @media (max-width: 680px) {
          div[style*="grid-template-columns: 1fr 420px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080d16", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#445566" }}>Loading checkout…</div></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
