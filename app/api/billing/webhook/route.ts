import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { PLANS, PlanKey } from "@/lib/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// ✅ Accept ANY Stripe object safely
const getMetaUserId = (obj: { metadata?: Stripe.Metadata | null }) => {
  return obj.metadata?.userId ?? null;
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const sess = event.data.object as Stripe.Checkout.Session;

        const userId = getMetaUserId(sess);
        const plan = sess.metadata?.plan as PlanKey;

        if (!userId || !plan || !sess.subscription) break;

        const planConfig = PLANS[plan];

        const sub = await stripe.subscriptions.retrieve(
          sess.subscription as string
        );

        await prisma.subscription.update({
          where: { userId },
          data: {
            plan,
            status: "active",
            stripeSubId: sub.id,
            stripePriceId: sub.items.data[0]?.price.id || null,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            locationLimit: planConfig.locationLimit,
            monthlyMessageLimit: planConfig.monthlyMessages,
            messagesUsedThisPeriod: 0,
            periodResetsAt: new Date(sub.current_period_end * 1000),
          },
        });

        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        if (!invoice.subscription) break;

        const sub = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        const userId = getMetaUserId(sub);
        if (!userId) break;

        await prisma.subscription.update({
          where: { userId },
          data: {
            status: "active",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            messagesUsedThisPeriod: 0,
            periodResetsAt: new Date(sub.current_period_end * 1000),
          },
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        if (!invoice.subscription) break;

        const sub = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        const userId = getMetaUserId(sub);
        if (!userId) break;

        await prisma.subscription.update({
          where: { userId },
          data: { status: "past_due" },
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const userId = getMetaUserId(sub);
        if (!userId) break;

        await prisma.subscription.update({
          where: { userId },
          data: {
            status: "canceled",
            stripeSubId: null,
          },
        });

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const userId = getMetaUserId(sub);
        const plan = sub.metadata?.plan as PlanKey;

        if (!userId || !plan) break;

        const planConfig = PLANS[plan];

        await prisma.subscription.update({
          where: { userId },
          data: {
            plan,
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            locationLimit: planConfig?.locationLimit || 1,
            monthlyMessageLimit: planConfig?.monthlyMessages || 500,
          },
        });

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}