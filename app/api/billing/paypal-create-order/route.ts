import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { PLANS, PlanKey, PAYMENT_PLAN_CODES } from "@/lib/plans";

async function getPayPalToken(): Promise<string> {
  const base = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("PayPal token fetch failed: " + JSON.stringify(data));
  return data.access_token;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = (await req.json()) as { plan: PlanKey };
  const cfg = PLANS[plan];
  const planCodes = plan === "trial" ? null : PAYMENT_PLAN_CODES[plan as "starter" | "pro" | "agency"];
  if (!cfg || plan === "trial" || !planCodes?.paypalPlanId)
    return NextResponse.json({ error: "Invalid plan or PayPal plan not configured" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: u.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const token = await getPayPalToken();
    const base  = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";

    // Create subscription using the plan ID
    const subscriptionRes = await fetch(`${base}/v1/billing/subscriptions`, {
      method:  "POST",
      headers: {
        Authorization:       `Bearer ${token}`,
        "Content-Type":      "application/json",
        "PayPal-Request-Id": `${u.id}-${plan}-${Date.now()}`,
      },
      body: JSON.stringify({
        plan_id: planCodes.paypalPlanId,
        subscriber: {
          name: {
            given_name: user.name?.split(' ')[0] || 'User',
            surname: user.name?.split(' ').slice(1).join(' ') || 'Name',
          },
          email_address: user.email,
        },
        application_context: {
          brand_name: "NexusReply",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/billing/paypal-approve?plan=${plan}`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout?plan=${plan}&canceled=true`,
        },
      }),
    });

    if (!subscriptionRes.ok) {
      const err = await subscriptionRes.json();
      console.error("[PayPal Create Subscription Error]", err);
      return NextResponse.json({ error: "PayPal subscription creation failed" }, { status: 500 });
    }

    const subscriptionData = await subscriptionRes.json();
    return NextResponse.json({
      id: subscriptionData.id,
      approvalUrl: subscriptionData.links?.find((link: any) => link.rel === "approve")?.href
    });
  } catch (err) {
    console.error("[PayPal Create Subscription]", err);
    return NextResponse.json({ error: "Could not create PayPal subscription" }, { status: 500 });
  }
}
