import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { PLANS, PlanKey } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("x-paystack-signature") || "";
  const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "").update(body).digest("hex");

  if (hash !== sig) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const { event: eventType, data } = JSON.parse(body);

  switch (eventType) {
    case "charge.success": {
      const { metadata, reference, customer } = data;
      const userId = metadata?.userId as string;
      const plan   = metadata?.plan   as PlanKey;
      if (!userId || !plan) break;
      const cfg = PLANS[plan];
      if (!cfg || plan === "trial") break;
      await prisma.subscription.update({
        where: { userId },
        data: {
          plan, status: "active", provider: "paystack", providerRef: reference,
          paystackCustomerCode: customer?.customer_code || null,
          locationLimit: cfg.locationLimit, monthlyMessageLimit: cfg.monthlyMessages,
          messagesUsedThisPeriod: 0,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          periodResetsAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      break;
    }
    case "subscription.not_renew":
    case "invoice.payment_failed": {
      const userId = data?.metadata?.userId as string;
      if (userId) await prisma.subscription.update({ where: { userId }, data: { status: "past_due" } });
      break;
    }
    case "subscription.disable": {
      const userId = data?.metadata?.userId as string;
      if (userId) await prisma.subscription.update({ where: { userId }, data: { status: "canceled" } });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
