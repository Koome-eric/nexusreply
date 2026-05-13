export const PLANS = {
  trial: {
    name: "Free Trial",
    price: 0,
    locationLimit: 1,
    monthlyMessages: 25,
    agentLimit: 2,
    trialDays: 3,
    trialMessages: 25,
    features: [
      "1 location",
      "25 AI messages total",
      "SMS & Email automation",
      "Basic AI replies",
    ],
    badge: "TRIAL",
    color: "#f59e0b",
  },
  starter: {
    name: "Starter",
    price: 97,
    locationLimit: 1,
    monthlyMessages: 2000,
    agentLimit: 3,
    features: [
      "1 location",
      "SMS + Email automation",
      "Intent detection engine",
      "Contact memory",
      "Human fallback safety",
      "Email support",
    ],
    badge: "STARTER",
    color: "#14b8a6",
  },
  pro: {
    name: "Pro",
    price: 197,
    locationLimit: 5,
    monthlyMessages: 8000,
    agentLimit: 10,
    features: [
      "Up to 5 locations",
      "Everything in Starter",
      "AI Agent decision engine",
      "Pipeline automation",
      "Advanced memory system",
      "Analytics dashboard",
      "Priority support",
    ],
    badge: "PRO",
    color: "#8b5cf6",
    popular: true,
  },
  agency: {
    name: "Agency",
    price: 397,
    locationLimit: 15,
    monthlyMessages: 25000,
    agentLimit: 25,
    features: [
      "Up to 15 locations",
      "Everything in Pro",
      "Full AI agent system",
      "White-label option",
      "Multi-team management",
      "Custom AI training",
      "Dedicated support",
    ],
    badge: "AGENCY",
    color: "#ec4899",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanLimits(plan: PlanKey) {
  return PLANS[plan] ?? PLANS.trial;
}

// Payment provider plan codes — read from env
export const PAYMENT_PLAN_CODES = {
  starter: {
    paystackPlanCode: process.env.PAYSTACK_STARTER_PLAN_CODE ?? null,
    paypalPlanId:     "P-93V78691RY357102TNH274GA",
  },
  pro: {
    paystackPlanCode: process.env.PAYSTACK_PRO_PLAN_CODE     ?? null,
    paypalPlanId:     "P-7FA32131RH3957816NH277AA",
  },
  agency: {
    paystackPlanCode: process.env.PAYSTACK_AGENCY_PLAN_CODE  ?? null,
    paypalPlanId:     "P-0K33895255127115VNH3AAOY",
  },
} as const;

export function normalizePlanKey(plan: string): PlanKey {
  const key = plan?.toLowerCase?.().trim();
  if (key === "starter" || key === "pro" || key === "agency" || key === "trial") {
    return key;
  }
  return "trial";
}

export function getPayPalPlanId(plan: PlanKey) {
  return PAYMENT_PLAN_CODES[plan as keyof typeof PAYMENT_PLAN_CODES]?.paypalPlanId || null;
}

export function getPlanByPayPalId(planId: string): PlanKey | null {
  const entry = Object.entries(PAYMENT_PLAN_CODES).find(([, value]) => value.paypalPlanId === planId);
  return entry ? (entry[0] as PlanKey) : null;
}
