import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PLANS, PlanKey, PAYMENT_PLAN_CODES } from "@/lib/plans";

const ROLE_BILLING: Record<string, string> = {
  agency: "/agency/settings",
  user:   "/dashboard/settings",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscription_id");
  const plan = searchParams.get("plan") as PlanKey;

  if (!subscriptionId || !plan) {
    return NextResponse.redirect(new URL("/pricing?error=missing_subscription", req.url));
  }

  const cfg = PLANS[plan];
  if (!cfg || plan === "trial") {
    return NextResponse.redirect(new URL("/pricing?error=invalid_plan", req.url));
  }

  try {
    // Get PayPal token
    const base = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    if (!token) {
      return NextResponse.redirect(new URL("/pricing?error=paypal_auth_failed", req.url));
    }

    // Verify subscription status
    const subscriptionRes = await fetch(`${base}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const subscriptionData = await subscriptionRes.json();

    if (!subscriptionRes.ok || !["ACTIVE", "APPROVAL_PENDING"].includes(subscriptionData.status)) {
      console.error("[PayPal Subscription Verify] Not active:", subscriptionData);
      return NextResponse.redirect(new URL("/pricing?error=subscription_not_active", req.url));
    }

    const expectedPlanId = PAYMENT_PLAN_CODES[plan]?.paypalPlanId;
    if (!expectedPlanId || subscriptionData.plan_id !== expectedPlanId) {
      console.error("[PayPal Plan Mismatch] expected", expectedPlanId, "got", subscriptionData.plan_id);
      return NextResponse.redirect(new URL("/pricing?error=plan_mismatch", req.url));
    }

    // Extract user ID from subscriber info (we need to match by email)
    const subscriberEmail = subscriptionData.subscriber?.email_address;
    if (!subscriberEmail) {
      return NextResponse.redirect(new URL("/pricing?error=missing_subscriber_email", req.url));
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: subscriberEmail },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.redirect(new URL("/pricing?error=user_not_found", req.url));
    }

    // Activate subscription in database. If there is no existing subscription row, create one.
    const periodEnd = subscriptionData?.billing_info?.next_billing_time
      ? new Date(subscriptionData.billing_info.next_billing_time)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId:                user.id,
        plan,
        status:                "active",
        trialEndsAt:           new Date(),
        trialMessagesLimit:    PLANS.trial.trialMessages,
        trialMessagesUsed:     0,
        provider:              "paypal",
        providerRef:           subscriptionId,
        paypalSubscriptionId:  subscriptionId,
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
        providerRef:           subscriptionId,
        paypalSubscriptionId:  subscriptionId,
        locationLimit:         cfg.locationLimit,
        monthlyMessageLimit:   cfg.monthlyMessages,
        messagesUsedThisPeriod: 0,
        currentPeriodEnd:      periodEnd,
        periodResetsAt:        periodEnd,
      },
    });

    // Redirect to appropriate dashboard
    const dest = ROLE_BILLING[user.role ?? "user"] ?? "/dashboard/settings";
    return NextResponse.redirect(
      new URL(`${dest}?upgraded=true&plan=${plan}&provider=paypal`, req.url)
    );

  } catch (err) {
    console.error("[PayPal Subscription Approval Error]", err);
    return NextResponse.redirect(new URL("/pricing?error=approval_failed", req.url));
  }
}