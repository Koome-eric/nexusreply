/**
 * app/api/ghl/bootstrap/route.ts
 *
 * One-shot setup endpoint. Call this after connecting a location to ensure:
 *  1. automationConfig exists with AI enabled
 *  2. location.automationEnabled = true
 *  3. Default AI agents created (Alex/Sarah/Marcus/Luna)
 *  4. Webhook registered in GHL
 *  5. Default business profile seeded if missing
 *
 * POST { locationId: string }  — use the internal DB location ID
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth-options";
import { prisma }                    from "@/lib/db";
import { resolveLocationAccess }     from "@/lib/client-access";
import { autoRegisterWebhook }       from "@/lib/webhook-manager";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { locationId } = await req.json();
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = await prisma.location.findFirst({
    where:   { id: locationId, userId: access.ownerId },
    include: { ghlConnection: true },
  });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const steps: string[] = [];

  // ── 1. Enable automation on location ──────────────────────────
  await prisma.location.update({
    where: { id: locationId },
    data:  { automationEnabled: true },
  });
  steps.push("✅ automationEnabled = true");

  // ── 2. Upsert automationConfig ─────────────────────────────────
  await prisma.automationConfig.upsert({
    where:  { locationId },
    update: { enabled: true },   // turn on if it was off, leave other settings alone
    create: {
      userId:               access.ownerId,
      locationId,
      enabled:              true,
      smsEnabled:           true,
      emailEnabled:         true,
      aiModel:              "gpt-4o-mini",
      minDelaySec:          1,
      maxDelaySec:          4,
      humanFallbackEnabled: true,
      confidenceThreshold:  0.5,
    },
  });
  steps.push("✅ automationConfig enabled");

  // ── 3. Default AI agents ───────────────────────────────────────
  const existingCount = await prisma.aIAgent.count({ where: { locationId } });

  if (existingCount === 0) {
    const DEFAULT_AGENTS = [
      {
        name: "Alex", role: "SDR", avatar: "🤝", order: 0, tone: "friendly",
        isActive: true, isDefault: true, agencyId: access.ownerId,
        triggerStages:  ["NEW", "ENGAGED"],
        triggerIntents: ["greeting", "question", "general", "objection"],
        triggerKeywords: [],
        systemPrompt: `You are Alex, a friendly SDR. Warmly qualify leads, understand their needs, build rapport.

RULES:
- Ask ONE qualifying question at a time
- Sound like a real human — never robotic
- Adapt to what they share
- Hand off to the booking specialist when they show scheduling interest
- If asked "are you a bot?" say: "Ha, no — real person, just a fast typer 😄"`,
      },
      {
        name: "Sarah", role: "SETTER", avatar: "📅", order: 1, tone: "professional",
        isActive: true, isDefault: false, agencyId: access.ownerId,
        triggerStages:  ["QUALIFIED", "BOOKING"],
        triggerIntents: ["buying_signal", "scheduling"],
        triggerKeywords: ["book", "schedule", "call", "meet", "appointment", "when", "available"],
        systemPrompt: `You are Sarah, a professional appointment setter. Convert warm leads into booked calls.

RULES:
- Always push toward a specific booking action
- Offer concrete times: "I have Tuesday 2pm or Thursday 10am — which works?"
- Handle light objections then redirect to booking
- Create gentle urgency without pressure
- Keep it conversational, not salesy`,
      },
      {
        name: "Marcus", role: "CLOSER", avatar: "🔥", order: 2, tone: "consultative",
        isActive: true, isDefault: false, agencyId: access.ownerId,
        triggerStages:  ["CLOSING", "WON"],
        triggerIntents: ["price_inquiry", "buying_signal"],
        triggerKeywords: ["price", "cost", "how much", "pricing", "invest", "pay", "fee", "charge"],
        systemPrompt: `You are Marcus, a confident consultative closer. Handle pricing, final objections, and drive decisions.

RULES:
- Lead with VALUE before price: "Before I share pricing, let me understand what you need..."
- Handle objections with empathy + reframe
- Use social proof naturally
- Close clearly: "Based on what you've told me, this sounds like a great fit — want to get started?"
- If they hesitate, find the real concern underneath`,
      },
      {
        name: "Luna", role: "FOLLOWUP", avatar: "🌙", order: 3, tone: "casual",
        isActive: true, isDefault: false, agencyId: access.ownerId,
        triggerStages:  ["NURTURE", "LOST"],
        triggerIntents: [],
        triggerKeywords: [],
        systemPrompt: `You are Luna, a warm follow-up specialist. Re-engage cold or lost leads.

RULES:
- Be casual, short, non-pushy
- Provide a small value in every message (tip, insight, question)
- Never guilt-trip for not responding
- Give them an easy out — "no pressure, just checking in"
- Mix things up: reference past conversations, share relevant updates`,
      },
    ];

    await prisma.aIAgent.createMany({
      data:           DEFAULT_AGENTS.map(a => ({ ...a, userId: access.ownerId, locationId })),
      skipDuplicates: true,
    });
    steps.push(`✅ Created ${DEFAULT_AGENTS.length} default AI agents (Alex/Sarah/Marcus/Luna)`);
  } else {
    steps.push(`ℹ️ ${existingCount} agent(s) already exist — skipped`);
  }

  // ── 4. Seed minimal business profile ──────────────────────────
  const bpExists = await prisma.businessProfile.findUnique({ where: { locationId } });
  if (!bpExists) {
    await prisma.businessProfile.create({
      data: {
        userId:       access.ownerId,
        locationId,
        businessName: location.name || "My Business",
        niche:        "General",
        description:  "A business using NexusReply AI to handle lead conversations.",
        offers:       "Our products and services",
        faqs:         "",
        objections:   "",
        closingStyle: "consultative",
        tone:         "friendly",
        language:     "English",
      },
    });
    steps.push("✅ Default business profile created — update it in Setup → Business Info");
  } else {
    steps.push("ℹ️ Business profile already exists");
  }

  // ── 5. Register webhook ────────────────────────────────────────
  const webhookResult = await autoRegisterWebhook(
    locationId,
    location.ghlLocationId,
    location.ghlConnection.accessToken
  );
  steps.push(webhookResult.success
    ? `✅ Webhook registered (${webhookResult.webhookId || "id unknown"})`
    : `⚠️ Webhook registration failed: ${webhookResult.error} — register manually in GHL`
  );

  return NextResponse.json({ ok: true, steps });
}
