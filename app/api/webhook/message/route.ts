import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactId, conversationId, message, type, locationId, source } = body;

    if (source === "AI_REPLY" || source === "automated") {
      return NextResponse.json({ ok: true, skipped: "ai_source" });
    }
    if (!message || !contactId || !conversationId || !locationId) {
      return NextResponse.json({ ok: true, skipped: "missing_fields" });
    }

    // Find location in our DB
    const location = await prisma.location.findUnique({
      where: { ghlLocationId: locationId },
      include: { automationConfig: true, user: { include: { subscription: true } } },
    });

    if (!location) return NextResponse.json({ ok: true, skipped: "location_not_found" });
    if (!location.automationEnabled || !location.automationConfig?.enabled) {
      return NextResponse.json({ ok: true, skipped: "automation_disabled" });
    }

    const msgType = (type || "SMS").toUpperCase();
    if (msgType === "SMS" && !location.automationConfig.smsEnabled) {
      return NextResponse.json({ ok: true, skipped: "sms_disabled" });
    }
    if (msgType === "EMAIL" && !location.automationConfig.emailEnabled) {
      return NextResponse.json({ ok: true, skipped: "email_disabled" });
    }

    // Check subscription
    const sub = location.user.subscription;
    if (!sub) return NextResponse.json({ ok: true, skipped: "no_subscription" });

    const now = new Date();
    if (sub.status === "trialing") {
      if (now > sub.trialEndsAt || sub.trialMessagesUsed >= sub.trialMessagesLimit) {
        return NextResponse.json({ ok: true, skipped: "trial_exhausted" });
      }
    } else if (sub.status !== "active") {
      return NextResponse.json({ ok: true, skipped: "subscription_inactive" });
    }

    // Log event
    const event = await prisma.webhookEvent.create({
      data: {
        ghlLocationId: locationId,
        locationId: location.id,
        contactId,
        conversationId,
        messageBody: message,
        messageType: msgType,
        source,
      },
    });

    // Fire AI processing async
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${appUrl}/api/ai/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        userId: location.userId,
        locationId: location.id,
        ghlLocationId: locationId,
        contactId,
        conversationId,
        message,
        type: msgType,
      }),
    }).catch(console.error);

    return NextResponse.json({ success: true, eventId: event.id });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
