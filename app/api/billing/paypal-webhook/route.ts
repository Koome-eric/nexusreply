import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PLANS, PlanKey } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const { event_type, resource } = await req.json();
  const [userId, plan] = (resource?.custom_id || "").split("|") as [string, PlanKey];
  if (!userId) return NextResponse.json({ received: true });

  switch (event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const cfg = PLANS[plan];
      if (!cfg || plan === "trial") break;
      await prisma.subscription.update({
        where: { userId },
        data: {
          plan, status: "active", provider: "paypal",
          providerRef: resource.id, paypalSubscriptionId: resource.id,
          locationLimit: cfg.locationLimit, monthlyMessageLimit: cfg.monthlyMessages,
          messagesUsedThisPeriod: 0,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          periodResetsAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      break;
    }
    case "BILLING.SUBSCRIPTION.RENEWED":
      await prisma.subscription.update({ where: { userId }, data: { status: "active", messagesUsedThisPeriod: 0, currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
      break;
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      await prisma.subscription.update({ where: { userId }, data: { status: "past_due" } });
      break;
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      await prisma.subscription.update({ where: { userId }, data: { status: "canceled", paypalSubscriptionId: null } });
      break;
  }

  return NextResponse.json({ received: true });
}
