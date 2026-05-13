import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openai } from "@/lib/openai";
import { resolveLocationAccess } from "@/lib/client-access";

// ── GET — fetch chat messages ─────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId") || undefined;
  const before     = searchParams.get("before");
  const limit      = 40;

  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await prisma.teamChatMessage.findMany({
    where: {
      locationId,
      ...(before && { createdAt: { lt: new Date(before) } }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  await prisma.teamChatMessage.updateMany({
    where: { locationId, isRead: false },
    data:  { isRead: true },
  });

  return NextResponse.json({
    messages: messages.reverse(),
    unreadCount: 0,
    hasMore: messages.length === limit,
  });
}

// ── Build rich system prompt for team chat agent ──────────────
async function buildTeamChatPrompt(
  agent: {
    name: string; role: string; systemPrompt: string;
    tone: string; triggerIntents: string[]; triggerStages: string[];
  },
  businessProfile: {
    businessName: string; niche: string; description: string;
    offers: string; faqs: string; objections: string;
    customRules: string | null; language: string; tone: string;
    closingStyle: string;
  } | null,
  pipelineSummary: string,
  recentActivity: number,
  locationName: string
): Promise<string> {
  const toneMap: Record<string, string> = {
    friendly: "warm, human, and approachable",
    professional: "polished, direct, and confident",
    aggressive: "bold, energetic, results-driven",
    consultative: "inquisitive, empathetic, advisory",
    casual: "relaxed and conversational",
    luxury: "refined, calm, premium",
  };
  const agentTone = toneMap[agent.tone] || toneMap[businessProfile?.tone || "friendly"] || "professional";
  const lang = businessProfile?.language || "English";

  return `You are ${agent.name}, a ${agent.role} specialist on the AI sales team for ${locationName}.

YOUR ROLE & EXPERTISE:
${agent.systemPrompt}

BUSINESS YOU WORK FOR:
- Name: ${businessProfile?.businessName || locationName}
- Industry: ${businessProfile?.niche || "Not specified"}
- About: ${businessProfile?.description || "Not provided"}
- Products/Services: ${businessProfile?.offers || "Not provided"}
- FAQs: ${businessProfile?.faqs || "Not provided"}
- Common Objections & How We Handle Them: ${businessProfile?.objections || "Not provided"}
${businessProfile?.customRules ? `- Special Rules: ${businessProfile.customRules}` : ""}

CURRENT PIPELINE STATUS:
- Messages handled in last 24h: ${recentActivity}
- Active leads:
${pipelineSummary}

YOUR TRIGGERS:
- You handle intents: ${agent.triggerIntents.join(", ") || "all"}
- You handle pipeline stages: ${agent.triggerStages.join(", ") || "all"}

COMMUNICATION RULES:
1. You are a real team member — talk like one. Never say you're an AI.
2. Tone: ${agentTone}
3. Always reply in ${lang}
4. Keep responses concise — 2–5 sentences like a Slack message
5. When asked about business, products, leads, or strategy → give SPECIFIC, knowledgeable answers using the business info above
6. When asked general sales questions → answer from your expertise as a ${agent.role}
7. When asked about the pipeline → reference actual lead stages above
8. Never say "I don't know" — make your best informed response based on your role and context
9. Never use corporate filler: "Certainly!", "Absolutely!", "Great question!"
10. If asked what you do: explain your ${agent.role} role in simple human terms`;
}

// ── POST — user/client sends message, targeted or random agent replies ──
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, locationId, targetAgent } = body;

  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Save user message
  const ownerMsg = await prisma.teamChatMessage.create({
    data: {
      userId:      access.userId,
      locationId,
      agentName:   "You",
      agentRole:   "OWNER",
      agentAvatar: "👤",
      message:     message.trim(),
      messageType: "update",
      isRead:      true,
    },
  });

  // Fetch all active agents for this location
  const agents = await prisma.aIAgent.findMany({
    where:   { userId: access.ownerId, locationId, isActive: true },
    orderBy: { order: "asc" },
  });

  if (agents.length === 0) {
    return NextResponse.json({ messages: [ownerMsg] });
  }

  // Pick responding agent — respect targetAgent, or pick best fit by role keyword in message
  let respondingAgent = agents[0];
  if (targetAgent) {
    respondingAgent =
      agents.find(a => a.id === targetAgent || a.role === targetAgent) || agents[0];
  } else {
    // Smart pick: match message content to agent role
    const msg = message.toLowerCase();
    const picked =
      agents.find(a => a.role === "SDR"     && (msg.includes("lead") || msg.includes("prospect") || msg.includes("acquire") || msg.includes("outreach"))) ||
      agents.find(a => a.role === "SETTER"  && (msg.includes("book") || msg.includes("schedule") || msg.includes("appointment") || msg.includes("call"))) ||
      agents.find(a => a.role === "CLOSER"  && (msg.includes("close") || msg.includes("deal") || msg.includes("price") || msg.includes("cost") || msg.includes("convert"))) ||
      agents.find(a => a.role === "FOLLOWUP"&& (msg.includes("follow") || msg.includes("nurture") || msg.includes("cold") || msg.includes("lost"))) ||
      agents[Math.floor(Math.random() * Math.min(agents.length, 2))];
    respondingAgent = picked;
  }

  // Fetch business profile for this location
  const businessProfile = await prisma.businessProfile.findFirst({
    where: { locationId },
  });

  // Fetch location name
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { name: true },
  });
  const locationName = location?.name || businessProfile?.businessName || "your location";

  // Recent pipeline data
  const recentLeads = await prisma.leadPipeline.findMany({
    where:   { userId: access.ownerId, locationId },
    orderBy: { updatedAt: "desc" },
    take:    8,
    select:  {
      contactName: true, stage: true, score: true,
      isQualified: true, hasBooked: true, lastIntent: true,
    },
  });

  const recentActivity = await prisma.aIMessageLog.count({
    where: {
      userId:    access.ownerId,
      locationId,
      createdAt: { gte: new Date(Date.now() - 86400000) },
    },
  });

  const pipelineSummary = recentLeads.length > 0
    ? recentLeads.map(l =>
        `• ${l.contactName || "Lead"}: ${l.stage}${l.isQualified ? " ✓ qualified" : ""}${l.hasBooked ? " 📅 booked" : ""}${l.lastIntent ? ` (last intent: ${l.lastIntent})` : ""}`
      ).join("\n")
    : "No leads yet — pipeline is warming up.";

  // Build full system prompt with business context
  const systemPrompt = await buildTeamChatPrompt(
    respondingAgent,
    businessProfile,
    pipelineSummary,
    recentActivity,
    locationName
  );

  // Fetch recent chat history for context (last 6 messages)
  const recentChat = await prisma.teamChatMessage.findMany({
    where:   { locationId },
    orderBy: { createdAt: "desc" },
    take:    6,
    select:  { agentName: true, message: true, agentRole: true },
  });
  const chatHistory = recentChat.reverse().map(m => ({
    role:    m.agentRole === "OWNER" ? "user" as const : "assistant" as const,
    content: m.agentRole !== "OWNER" ? `[${m.agentName}]: ${m.message}` : m.message,
  }));

  // Generate AI reply
  let aiReply = "";
  try {
    const completion = await openai.chat.completions.create({
      model:      "gpt-4o-mini",
      max_tokens: 220,
      messages:   [
        { role: "system", content: systemPrompt },
        ...chatHistory.slice(-4),           // last 4 for context
        { role: "user",   content: message },
      ],
    });
    aiReply = completion.choices[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("[TeamChat] AI generation error:", err);
    aiReply = `Working on it — ${recentLeads.length} leads active right now. ${
      recentActivity > 0 ? `Handled ${recentActivity} conversations today.` : "Quiet day so far."
    } What do you need help with?`;
  }

  // Save agent reply
  const agentMsg = await prisma.teamChatMessage.create({
    data: {
      userId:      access.userId,
      locationId,
      agentName:   respondingAgent.name,
      agentRole:   respondingAgent.role,
      agentAvatar: respondingAgent.avatar || "🤖",
      message:     aiReply,
      messageType: "update",
      isRead:      false,
    },
  });

  return NextResponse.json({ messages: [ownerMsg, agentMsg] });
}

// ── PATCH — generate proactive agent check-in ─────────────────
export async function PATCH(req: NextRequest) {
  const { locationId } = await req.json();
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agents = await prisma.aIAgent.findMany({
    where:   { userId: access.ownerId, locationId, isActive: true },
    orderBy: { order: "asc" },
  });

  if (agents.length === 0) return NextResponse.json({ message: null });

  const agent = agents[Math.floor(Math.random() * agents.length)];

  const [stageGroups, recentHandoffs, todayMsgs] = await Promise.all([
    prisma.leadPipeline.groupBy({
      by: ["stage"],
      where: { userId: access.ownerId, locationId },
      _count: true,
    }),
    prisma.aIMessageLog.count({
      where: {
        userId: access.ownerId, locationId, humanTookOver: true,
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    }),
    prisma.aIMessageLog.count({
      where: {
        userId: access.ownerId, locationId,
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    }),
  ]);

  const stageSummary = stageGroups.map(s => `${s.stage}: ${s._count}`).join(", ") || "pipeline building up";

  const updates = [
    `Quick update from me — ${todayMsgs} conversations handled today. ${recentHandoffs > 0 ? `${recentHandoffs} flagged for human review.` : "All handled autonomously."} Current spread: ${stageSummary}.`,
    `Checking in — pipeline looks like: ${stageSummary}. ${recentHandoffs > 0 ? `Flagged ${recentHandoffs} convos for you.` : "Nothing urgent."} Keeping momentum going on my end.`,
    `Hey, ${todayMsgs > 0 ? `${todayMsgs} messages handled today.` : "Quiet day — warming up some cold leads."} ${stageSummary ? `Spread: ${stageSummary}.` : ""} Anything specific you want me to push on?`,
  ];

  const proactiveMsg = await prisma.teamChatMessage.create({
    data: {
      userId:      access.userId,
      locationId,
      agentName:   agent.name,
      agentRole:   agent.role,
      agentAvatar: agent.avatar || "🤖",
      message:     updates[Math.floor(Math.random() * updates.length)],
      messageType: "progress",
      isRead:      false,
    },
  });

  return NextResponse.json({ message: proactiveMsg });
}
