import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { autoRegisterWebhook } from "@/lib/webhook-manager";
import { createOrConnectGHLPipeline } from "@/lib/pipeline-sync";
import { createNotification } from "@/lib/notifications";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey, locationId, locationName: customName } = await req.json();

  if (!apiKey?.trim() || !locationId?.trim()) {
    return NextResponse.json({ error: "API key and Location ID are required" }, { status: 400 });
  }

  // Test the API key
  const testRes = await fetch(`${GHL_BASE}/locations/${locationId.trim()}`, {
    headers: { Authorization: `Bearer ${apiKey.trim()}`, Version: GHL_VERSION },
  });

  if (testRes.status === 401) {
    return NextResponse.json({ error: "Invalid API key. Please check it and try again." }, { status: 400 });
  }

  // Check location limit
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const locationCount = await prisma.location.count({ where: { userId } });
  if (sub && locationCount >= sub.locationLimit) {
    return NextResponse.json({ error: `You've reached your location limit (${sub.locationLimit}). Upgrade to add more.` }, { status: 403 });
  }

  // Check not already connected by someone else
  const existingLoc = await prisma.location.findUnique({ where: { ghlLocationId: locationId.trim() } });
  if (existingLoc && existingLoc.userId !== userId) {
    return NextResponse.json({ error: "This location is already connected to another account." }, { status: 409 });
  }

  // Get real location name
  let locationName = customName || "My Location";
  if (testRes.ok) {
    try {
      const locData = await testRes.json();
      locationName = locData.location?.name || locData.name || customName || "My Location";
    } catch { /* use custom name */ }
  }

  // Create GHL connection (private keys don't expire)
  const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
  const conn = await prisma.gHLConnection.create({
    data: { userId, accessToken: apiKey.trim(), refreshToken: apiKey.trim(), tokenExpiresAt: farFuture },
  });

  // Upsert location
  const location = await prisma.location.upsert({
    where: { ghlLocationId: locationId.trim() },
    update: { userId, ghlConnectionId: conn.id, name: locationName, isActive: true },
    create: { userId, ghlConnectionId: conn.id, ghlLocationId: locationId.trim(), name: locationName },
  });

  // Auto-register webhook
  autoRegisterWebhook(location.id, locationId.trim(), apiKey.trim()).then(r =>
    console.log("[DirectConnect] Webhook:", r.success ? "✓" : "✗ " + r.error)
  ).catch(console.error);

  // Auto-create GHL pipeline
  createOrConnectGHLPipeline(location.id, locationId.trim(), apiKey.trim()).then(r =>
    console.log("[DirectConnect] Pipeline:", r.success ? "✓" : "✗ " + r.error)
  ).catch(console.error);

  // Auto-create AutomationConfig with AI ON by default (key fix for conversation flow)
  await prisma.automationConfig.upsert({
    where:  { locationId: location.id },
    update: {},  // don't overwrite existing settings
    create: {
      userId,
      locationId:              location.id,
      enabled:                 true,
      smsEnabled:              true,
      emailEnabled:            true,
      aiModel:                 "gpt-4o-mini",
      minDelaySec:             1,
      maxDelaySec:             4,
      humanFallbackEnabled:    true,
      confidenceThreshold:     0.5,   // lower threshold so more messages get AI replies
    },
  }).catch(e => console.warn("[DirectConnect] AutomationConfig upsert:", e));

  // Enable automation on the location itself
  await prisma.location.update({
    where: { id: location.id },
    data:  { automationEnabled: true },
  }).catch(console.error);

  // Auto-create default AI agents if none exist for this location
  const existingAgents = await prisma.aIAgent.count({ where: { locationId: location.id } });
  if (existingAgents === 0) {
    const DEFAULT_AGENTS = [
      {
        name: "Alex", role: "SDR", avatar: "🤝", order: 0, tone: "friendly",
        isActive: true, isDefault: true, agencyId: userId,
        triggerStages: ["NEW", "ENGAGED"],
        triggerIntents: ["greeting", "question", "general", "objection"],
        triggerKeywords: [],
        systemPrompt: `You are Alex, a friendly SDR (Sales Development Rep). Your job is to warmly qualify leads and understand their needs.

RULES:
- Start conversations naturally — not salesy
- Ask ONE qualifying question at a time
- Listen and adapt to what they share
- Hand off to Sarah when they show booking intent
- Sound like a real person, not a bot
- If they show strong interest, let the closer know naturally in your reply`,
      },
      {
        name: "Sarah", role: "SETTER", avatar: "📅", order: 1, tone: "professional",
        isActive: true, isDefault: false, agencyId: userId,
        triggerStages: ["QUALIFIED", "BOOKING"],
        triggerIntents: ["buying_signal", "scheduling"],
        triggerKeywords: ["book", "schedule", "call", "meet", "appointment", "when"],
        systemPrompt: `You are Sarah, a professional appointment setter.

YOUR MISSION: Convert qualified leads into booked appointments or calls.

RULES:
- Push toward a specific booking action
- Handle light objections with empathy then redirect to booking
- Offer specific times when possible
- Create gentle urgency: "We only have a few spots this week"
- Keep messages conversational, not salesy`,
      },
      {
        name: "Marcus", role: "CLOSER", avatar: "🔥", order: 2, tone: "consultative",
        isActive: true, isDefault: false, agencyId: userId,
        triggerStages: ["CLOSING", "WON"],
        triggerIntents: ["price_inquiry", "buying_signal"],
        triggerKeywords: ["price", "cost", "how much", "pricing", "invest", "pay", "fee"],
        systemPrompt: `You are Marcus, a confident sales closer.

YOUR MISSION: Answer pricing questions, handle final objections, and drive decisions.

RULES:
- Lead with VALUE before price
- Handle objections with empathy + reframe
- Use social proof naturally
- Close clearly: "Based on everything, it sounds like this is the right fit — want to get started?"`,
      },
      {
        name: "Luna", role: "FOLLOWUP", avatar: "🌙", order: 3, tone: "casual",
        isActive: true, isDefault: false, agencyId: userId,
        triggerStages: ["NURTURE", "LOST"],
        triggerIntents: [],
        triggerKeywords: [],
        systemPrompt: `You are Luna, a warm follow-up specialist.

YOUR MISSION: Re-engage cold leads and bring them back.

RULES:
- Be casual, short, and non-pushy
- Provide value in every message
- Never guilt-trip them for not responding
- Give them an easy way to say no`,
      },
    ];

    await prisma.aIAgent.createMany({
      data: DEFAULT_AGENTS.map(a => ({ ...a, userId, locationId: location.id })),
      skipDuplicates: true,
    }).catch(e => console.warn("[DirectConnect] Default agents:", e));

    console.log("[DirectConnect] ✅ Default AI agents created");
  }

  // Notify user
  createNotification(userId, "webhook_connected", "🔗 Location connected!",
    `${locationName} is now live. Webhook, AI agents, and automation enabled automatically.`,
    { locationName }
  ).catch(console.error);

  return NextResponse.json({ success: true, locationName });
}
