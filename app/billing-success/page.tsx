"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

const PLAN_META: Record<string, { name: string; color: string; icon: string; features: string[] }> = {
  starter: {
    name: "Starter", color: "#14b8a6", icon: "🚀",
    features: ["1 GHL location", "2,000 AI messages/month", "SMS + Email automation", "Intent detection", "Contact memory"],
  },
  pro: {
    name: "Pro", color: "#8b5cf6", icon: "⚡",
    features: ["Up to 5 locations", "8,000 AI messages/month", "Everything in Starter", "AI pipeline automation", "Priority support"],
  },
  agency: {
    name: "Agency", color: "#ec4899", icon: "🏢",
    features: ["Up to 15 locations", "25,000 AI messages/month", "Everything in Pro", "White-label client portals", "Dedicated support"],
  },
};

const ROLE_HOME: Record<string, string> = {
  admin: "/admin", agency: "/agency", client: "/client", user: "/dashboard",
};

function SuccessContent() {
  const params  = useSearchParams();
  const router  = useRouter();
  const { data: session, update } = useSession();
  const user = session?.user as { id?: string; role?: string } | undefined;

  const plan     = params.get("plan")     || "starter";
  const provider = params.get("provider") || "paystack";

  const meta     = PLAN_META[plan] || PLAN_META.starter;
  const dest     = ROLE_HOME[user?.role || "user"] || "/dashboard";

  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    // Refresh session to pick up new plan limits
    update();

    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(iv);
          router.push(`${dest}?upgraded=true&plan=${plan}&provider=${provider}`);
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest]);

  return (
    <div style={{
      minHeight: "100vh", background: "#080d16",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ position: "fixed", inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${meta.color}12 0%, transparent 60%)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: "500px", width: "100%" }}>
        {/* Animated success */}
        <div style={{
          width: "96px", height: "96px", borderRadius: "50%", margin: "0 auto 28px",
          background: `${meta.color}18`, border: `2px solid ${meta.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "44px", animation: "pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)",
        }}>
          🎉
        </div>

        <h1 style={{ fontSize: "clamp(24px,5vw,36px)", fontWeight: 800, color: "#e2eaf4", margin: "0 0 10px", letterSpacing: "-0.03em" }}>
          {meta.icon} You&apos;re on {meta.name}!
        </h1>

        <p style={{ color: "#445566", fontSize: "15px", lineHeight: 1.7, margin: "0 0 32px" }}>
          Payment confirmed via {provider === "paystack" ? "Paystack" : "PayPal"}.
          Your {meta.name} plan is now active.
        </p>

        {/* What's unlocked */}
        <div style={{
          background: "rgba(10,17,30,0.9)", border: `1px solid ${meta.color}25`,
          borderRadius: "16px", padding: "22px", marginBottom: "28px", textAlign: "left",
        }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: meta.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>
            What You&apos;ve Unlocked
          </div>
          {meta.features.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#7c9ab8", marginBottom: "10px" }}>
              <span style={{ color: meta.color, fontSize: "16px" }}>✓</span> {f}
            </div>
          ))}
        </div>

        {/* Countdown progress */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden", marginBottom: "10px" }}>
            <div style={{
              height: "100%", background: meta.color, borderRadius: "2px",
              width: `${((8 - countdown) / 8) * 100}%`, transition: "width 1s linear",
            }} />
          </div>
          <p style={{ fontSize: "12px", color: "#2d3d50" }}>
            Redirecting to your dashboard in {countdown}s…
          </p>
        </div>

        {/* CTA */}
        <Link href={`${dest}?upgraded=true&plan=${plan}&provider=${provider}`} style={{
          display: "inline-block", padding: "14px 36px", borderRadius: "12px",
          background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color})`,
          color: "white", fontWeight: 700, fontSize: "15px", textDecoration: "none",
          boxShadow: `0 4px 20px ${meta.color}30`,
        }}>
          Go to Dashboard →
        </Link>
      </div>

      <style>{`
        @keyframes pop {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080d16" }} />}>
      <SuccessContent />
    </Suspense>
  );
}
