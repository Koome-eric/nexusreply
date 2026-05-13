import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { PLANS, PlanKey, PAYMENT_PLAN_CODES } from "@/lib/plans";

const BILLING_PAGE: Record<string, string> = {
  agency: "/agency/settings",
  user:   "/dashboard/settings",
};

async function getPayPalToken(): Promise<string> {
  const base = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";
  const res  = await fetch(`${base}/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  return (await res.json()).access_token;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = (await req.json()) as { plan: PlanKey };
  const cfg = PLANS[plan];
  if (!cfg || plan === "trial" || !PAYMENT_PLAN_CODES[plan as keyof typeof PAYMENT_PLAN_CODES]?.paypalPlanId) {
    return NextResponse.json({ error: "Invalid plan or PayPal plan not configured" }, { status: 400 });
  }

  const user     = await prisma.user.findUnique({ where: { id: u.id } });
  if (!user)     return NextResponse.json({ error: "User not found" }, { status: 404 });

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const role     = u.role ?? "user";
  const backPage = BILLING_PAGE[role] ?? "/dashboard/settings";
  const token    = await getPayPalToken();
  const base     = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

  const res = await fetch(`${base}/v1/billing/subscriptions`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", "PayPal-Request-Id": `${u.id}-${plan}-${Date.now()}` },
    body: JSON.stringify({
      plan_id:   PAYMENT_PLAN_CODES[plan as keyof typeof PAYMENT_PLAN_CODES]?.paypalPlanId,
      custom_id: `${u.id}|${plan}`,
      application_context: {
        brand_name:  "NexusReply",
        user_action: "SUBSCRIBE_NOW",
        return_url:  `${appUrl}${backPage}?upgraded=true&plan=${plan}&provider=paypal`,
        cancel_url:  `${appUrl}/pricing?canceled=true`,
      },
    }),
  });

  if (!res.ok) return NextResponse.json({ error: "PayPal subscription creation failed" }, { status: 500 });

  const data       = await res.json();
  const approvalUrl = data.links?.find((l: { rel: string; href: string }) => l.rel === "approve")?.href;
  return NextResponse.json({ url: approvalUrl, subscriptionId: data.id });
}
