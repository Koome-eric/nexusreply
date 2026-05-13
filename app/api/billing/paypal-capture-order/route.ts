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
  return (await res.json()).access_token;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscriptionID, plan } = await req.json() as { subscriptionID: string; plan: PlanKey };

  if (!subscriptionID || !plan)
    return NextResponse.json({ error: "subscriptionID and plan required" }, { status: 400 });

  const cfg = PLANS[plan];
  if (!cfg || plan === "trial")
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  try {
    const token = await getPayPalToken();
    const base  = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";

    // Verify the subscription status
    const subscriptionRes = await fetch(`${base}/v1/billing/subscriptions/${subscriptionID}`, {
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const subscriptionData = await subscriptionRes.json();

    // Accept both ACTIVE and APPROVAL_PENDING — subscription was just approved by user
    const validStatuses = ["ACTIVE", "APPROVAL_PENDING"];
    if (!subscriptionRes.ok || !validStatuses.includes(subscriptionData.status)) {
      console.error("[PayPal Subscription Check Error]", subscriptionData);
      return NextResponse.json({ error: `Subscription not in valid state: ${subscriptionData.status}` }, { status: 400 });
    }

    const expectedPlanId = PAYMENT_PLAN_CODES[plan as keyof typeof PAYMENT_PLAN_CODES]?.paypalPlanId;
    if (!expectedPlanId || subscriptionData.plan_id !== expectedPlanId) {
      console.error("[PayPal Plan Mismatch] expected", expectedPlanId, "got", subscriptionData.plan_id);
      return NextResponse.json({ error: "PayPal subscription plan does not match selected plan" }, { status: 400 });
    }

    const periodEnd = subscriptionData?.billing_info?.next_billing_time
      ? new Date(subscriptionData.billing_info.next_billing_time)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Activate subscription in database. If there is no existing subscription row, create one.
    await prisma.subscription.upsert({
      where: { userId: u.id },
      create: {
        userId:                u.id,
        plan,
        status:                "active",
        trialEndsAt:           new Date(),
        trialMessagesLimit:    PLANS.trial.trialMessages,
        trialMessagesUsed:     0,
        provider:              "paypal",
        providerRef:           subscriptionID,
        paypalSubscriptionId:  subscriptionID,
        locationLimit:         cfg.locationLimit,
        monthlyMessageLimit:   cfg.monthlyMessages,
        messagesUsedThisPeriod: 0,
        currentPeriodEnd:      periodEnd,
        periodResetsAt:        periodEnd,
      },
      update: {
        plan,
        status:                "active",
        provider:              "paypal",
        providerRef:           subscriptionID,
        paypalSubscriptionId:  subscriptionID,
        locationLimit:         cfg.locationLimit,
        monthlyMessageLimit:   cfg.monthlyMessages,
        messagesUsedThisPeriod: 0,
        currentPeriodEnd:      periodEnd,
        periodResetsAt:        periodEnd,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PayPal Subscription Activation]", err);
    return NextResponse.json({ error: "Subscription activation failed" }, { status: 500 });
  }
}
