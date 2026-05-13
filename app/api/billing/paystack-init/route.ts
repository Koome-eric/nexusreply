import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { PLANS, PlanKey, PAYMENT_PLAN_CODES } from "@/lib/plans";

// USD → NGN conversion (approximate — update as needed or use live FX)
const USD_TO_NGN = 1600;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = (await req.json()) as { plan: PlanKey };
  const planConfig = PLANS[plan];
  const planCodes  = PAYMENT_PLAN_CODES[plan as keyof typeof PAYMENT_PLAN_CODES];

  if (!planConfig || plan === "trial")
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: u.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Amount in kobo (NGN kobo = NGN × 100)
  const amountKobo = planConfig.price * USD_TO_NGN * 100;

  const body: Record<string, unknown> = {
    email:        user.email,
    amount:       amountKobo,
    callback_url: `${appUrl}/api/billing/paystack-verify`,
    metadata: {
      userId:    user.id,
      plan,
      userRole:  u.role,
      cancel_action: `${appUrl}/checkout?plan=${plan}&canceled=true`,
    },
    channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
  };

  // If a Paystack plan code exists, attach it for recurring subscription
  if (planCodes?.paystackPlanCode) {
    body.plan = planCodes.paystackPlanCode;
  }

  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!paystackRes.ok) {
    const err = await paystackRes.json();
    console.error("[Paystack Init Error]", err);
    return NextResponse.json({ error: "Could not initialize payment. Please try again." }, { status: 500 });
  }

  const data = await paystackRes.json();
  return NextResponse.json({
    url:       data.data.authorization_url,
    reference: data.data.reference,
  });
}
