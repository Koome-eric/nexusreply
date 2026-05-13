import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PLANS, PlanKey } from "@/lib/plans";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!reference) {
    return NextResponse.redirect(new URL("/pricing?error=missing_reference", req.url));
  }

  try {
    // Verify with Paystack
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== "success") {
      console.error("[Paystack Verify] Payment not successful:", verifyData);
      return NextResponse.redirect(new URL("/pricing?error=payment_failed", req.url));
    }

    const { metadata, customer } = verifyData.data;
    const userId = metadata?.userId as string;
    const plan   = metadata?.plan   as PlanKey;

    if (!userId || !plan) {
      return NextResponse.redirect(new URL("/pricing?error=missing_metadata", req.url));
    }

    const cfg = PLANS[plan];
    if (!cfg || plan === "trial") {
      return NextResponse.redirect(new URL("/pricing?error=invalid_plan", req.url));
    }

    // Activate subscription in DB — single source of truth
    await prisma.subscription.update({
      where: { userId },
      data: {
        plan,
        status:              "active",
        provider:            "paystack",
        providerRef:         reference,
        paystackCustomerCode: customer?.customer_code || null,
        locationLimit:       cfg.locationLimit,
        monthlyMessageLimit: cfg.monthlyMessages,
        messagesUsedThisPeriod: 0,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        periodResetsAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Redirect to billing-success page
    return NextResponse.redirect(
      new URL(`/billing-success?plan=${plan}&provider=paystack`, req.url)
    );
  } catch (err) {
    console.error("[Paystack Verify Error]", err);
    return NextResponse.redirect(new URL("/pricing?error=verify_failed", req.url));
  }
}
