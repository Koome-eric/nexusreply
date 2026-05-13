"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function BannerContent() {
  const params   = useSearchParams();
  const upgraded = params.get("upgraded") === "true";
  const plan     = params.get("plan");
  const provider = params.get("provider");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (upgraded) {
      setShow(true);
      // Remove query params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("upgraded");
      url.searchParams.delete("plan");
      url.searchParams.delete("provider");
      window.history.replaceState({}, "", url.toString());
      const t = setTimeout(() => setShow(false), 8000);
      return () => clearTimeout(t);
    }
  }, [upgraded]);

  if (!show) return null;

  const planName = plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : "your";

  return (
    <div style={{
      position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", alignItems: "center", gap: "12px",
      background: "linear-gradient(135deg, #0d9488, #14b8a6)",
      borderRadius: "14px", padding: "14px 22px",
      boxShadow: "0 8px 32px rgba(20,184,166,0.4)",
      animation: "slideDown 0.4s ease",
      maxWidth: "480px", width: "calc(100% - 32px)",
    }}>
      <span style={{ fontSize: "22px" }}>🎉</span>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "white" }}>
          {planName} plan activated!
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
          Paid via {provider === "paypal" ? "PayPal" : "Paystack"} · Your features are now active.
        </div>
      </div>
      <button
        onClick={() => setShow(false)}
        style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "18px", padding: "0 0 0 8px", lineHeight: 1 }}
      >×</button>
    </div>
  );
}

export default function UpgradeBanner() {
  return (
    <Suspense fallback={null}>
      <BannerContent />
      <style>{`@keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
    </Suspense>
  );
}
