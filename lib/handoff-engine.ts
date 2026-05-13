import { prisma } from "./db";
import { openai } from "./openai";
import type { AIAgent, LeadPipeline } from "@prisma/client";

// ─── Pipeline Stages ─────────────────────────────────────────────
export type PipelineStage =
  | "NEW"
  | "ENGAGED"
  | "QUALIFIED"
  | "BOOKING"
  | "CLOSING"
  | "WON"
  | "LOST"
  | "NURTURE";

// ─── Intent → Stage mapping ──────────────────────────────────────
const INTENT_TO_STAGE: Record<string, PipelineStage> = {
  greeting: "ENGAGED",
  question: "ENGAGED",
  buying_signal: "QUALIFIED",
  price_inquiry: "CLOSING",
  scheduling: "BOOKING",
  objection: "ENGAGED",
  complaint: "ENGAGED",
  unsubscribe: "LOST",
  general: "ENGAGED",
};

// Default role → stage mapping (when no custom agents)
const ROLE_TO_STAGES: Record<string, PipelineStage[]> = {
  SDR: ["NEW", "ENGAGED"],
  SETTER: ["QUALIFIED", "BOOKING"],
  CLOSER: ["CLOSING", "WON"],
  FOLLOWUP: ["NURTURE", "LOST"],
  CUSTOM: [],
};

// Score per intent
const INTENT_SCORES: Record<string, number> = {
  buying_signal: 30,
  price_inquiry: 20,
  scheduling: 25,
  question: 10,
  greeting: 5,
  objection: -5,
  complaint: -10,
  unsubscribe: -50,
  general: 2,
};

// ─── Get or create lead in pipeline ──────────────────────────────
export async function getOrCreateLead(
  userId: string,
  locationId: string,
  contactId: string,
  contactData?: { name?: string; email?: string; phone?: string; conversationId?: string }
): Promise<LeadPipeline> {
  return prisma.leadPipeline.upsert({
    where: { locationId_contactId: { locationId, contactId } },
    update: {
      ...(contactData?.name && { contactName: contactData.name }),
      ...(contactData?.email && { contactEmail: contactData.email }),
      ...(contactData?.phone && { contactPhone: contactData.phone }),
      ...(contactData?.conversationId && { ghlConversationId: contactData.conversationId }),
    },
    create: {
      userId,
      locationId,
      contactId,
      contactName: contactData?.name,
      contactEmail: contactData?.email,
      contactPhone: contactData?.phone,
      ghlConversationId: contactData?.conversationId,
      stage: "NEW",
    },
    include: { assignedAgent: true },
  });
}

// ─── Find best agent for a lead ───────────────────────────────────
export async function findBestAgent(
  locationId: string,
  stage: PipelineStage,
  intent: string,
  currentAgentId?: string | null,
  message?: string   // ← raw message text for keyword matching
): Promise<AIAgent | null> {
  const agents = await prisma.aIAgent.findMany({
    where:   { locationId, isActive: true },
    orderBy: { order: "asc" },
  });

  if (agents.length === 0) return null;

  const msgLower = (message || "").toLowerCase();

  // 1. Keyword trigger match (highest priority — explicit triggers)
  for (const agent of agents) {
    if (agent.triggerKeywords.length > 0) {
      const hit = agent.triggerKeywords.some(kw => msgLower.includes(kw.toLowerCase()));
      if (hit) return agent;
    }
  }

  // 2. Intent trigger match
  for (const agent of agents) {
    if (agent.triggerIntents.includes(intent)) return agent;
  }

  // 3. Stage trigger match
  for (const agent of agents) {
    if (agent.triggerStages.includes(stage)) return agent;
  }

  // 4. Role → stage default mapping
  for (const agent of agents) {
    const roleMappedStages = ROLE_TO_STAGES[agent.role] || [];
    if (roleMappedStages.includes(stage)) return agent;
  }

  // 5. Keep current agent if still active
  if (currentAgentId) {
    const current = agents.find(a => a.id === currentAgentId);
    if (current) return current;
  }

  // 6. Fallback: first active agent
  return agents[0] || null;
}

// ─── Core handoff decision ────────────────────────────────────────
export async function runHandoffEngine(
  lead: LeadPipeline & { assignedAgent: AIAgent | null },
  intent: string,
  message: string
): Promise<{
  nextStage: PipelineStage;
  nextAgent: AIAgent | null;
  stageChanged: boolean;
  agentChanged: boolean;
  reason: string;
}> {
  const currentStage = lead.stage as PipelineStage;

  // Determine next stage from intent
  let nextStage = INTENT_TO_STAGE[intent] || currentStage;

  // Don't go backwards in pipeline (except to LOST/NURTURE)
  const stageOrder: PipelineStage[] = [
    "NEW", "ENGAGED", "QUALIFIED", "BOOKING", "CLOSING", "WON",
  ];
  const currentIdx = stageOrder.indexOf(currentStage);
  const nextIdx = stageOrder.indexOf(nextStage);

  if (nextIdx !== -1 && currentIdx !== -1 && nextIdx < currentIdx) {
    nextStage = currentStage; // don't go backwards
  }

  // Special overrides
  if (intent === "unsubscribe") nextStage = "LOST";
  if (lead.score >= 80 && nextStage !== "WON") nextStage = "CLOSING";

  // Find best agent for next stage — pass raw message for keyword matching
  const nextAgent = await findBestAgent(
    lead.locationId,
    nextStage,
    intent,
    lead.assignedAgentId,
    message        // ← enables keyword trigger matching
  );

  const stageChanged = nextStage !== currentStage;
  const agentChanged = nextAgent?.id !== lead.assignedAgentId;

  const reason = stageChanged
    ? `Intent "${intent}" triggered stage change ${currentStage} → ${nextStage}`
    : `Continuing in ${currentStage}`;

  return { nextStage, nextAgent, stageChanged, agentChanged, reason };
}

// ─── Apply handoff result to DB ───────────────────────────────────
export async function applyHandoff(
  leadId: string,
  nextStage: PipelineStage,
  nextAgentId: string | null,
  intent: string,
  reason: string,
  fromStage: string
) {
  const scoreBonus = INTENT_SCORES[intent] || 0;

  const updatedLead = await prisma.leadPipeline.update({
    where: { id: leadId },
    data: {
      stage:           nextStage,
      assignedAgentId: nextAgentId,
      lastIntent:      intent,
      lastMessageAt:   new Date(),
      messageCount:    { increment: 1 },
      score:           { increment: scoreBonus },
      isQualified: ["QUALIFIED", "BOOKING", "CLOSING", "WON"].includes(nextStage),
      hasBooked:   nextStage === "BOOKING" || nextStage === "WON",
    },
    include: { assignedAgent: true },
  });

  // Log stage transition
  if (nextStage !== fromStage) {
    await prisma.pipelineStageHistory.create({
      data: {
        leadId,
        fromStage,
        toStage:     nextStage,
        agentId:     nextAgentId,
        reason,
        triggeredBy: "intent",
      },
    });

    // Post automatic team chat notification about the stage change
    try {
      const lead = await prisma.leadPipeline.findUnique({
        where:   { id: leadId },
        select:  { userId: true, locationId: true, contactName: true },
      });
      if (lead) {
        const agent = nextAgentId
          ? await prisma.aIAgent.findUnique({ where: { id: nextAgentId }, select: { name: true, role: true, avatar: true } })
          : null;

        const stageEmoji: Record<string, string> = {
          NEW: "🆕", ENGAGED: "💬", QUALIFIED: "✅", BOOKING: "📅",
          CLOSING: "🔥", WON: "🏆", LOST: "❌", NURTURE: "🌱",
        };

        const notification = agent
          ? `${stageEmoji[nextStage] || "📊"} Pipeline update — ${lead.contactName || "Lead"} moved to **${nextStage}**. ${agent.name} (${agent.role}) is now handling this conversation. Reason: ${reason}`
          : `${stageEmoji[nextStage] || "📊"} ${lead.contactName || "Lead"} advanced to **${nextStage}** stage. ${reason}`;

        await prisma.teamChatMessage.create({
          data: {
            userId:      lead.userId,
            locationId:  lead.locationId,
            agentName:   agent?.name   || "Pipeline",
            agentRole:   agent?.role   || "SYSTEM",
            agentAvatar: agent?.avatar || "🤖",
            message:     notification,
            messageType: "progress",
            isRead:      false,
          },
        });
      }
    } catch (err) {
      console.error("[applyHandoff] Team chat notification failed:", err);
      // Non-blocking — pipeline update already committed
    }
  }

  return updatedLead;
}

// ─── Build agent context from lead history ────────────────────────
export async function buildAgentContext(
  lead: LeadPipeline,
  history: string,
  incomingAgent?: AIAgent | null,
  prevAgent?: AIAgent | null
): Promise<string> {
  const handoffNote =
    incomingAgent && prevAgent && incomingAgent.id !== prevAgent?.id
      ? `\n[CONTEXT: You are taking over from ${prevAgent.name}. Review the conversation and continue seamlessly. Do not announce the handoff.]`
      : "";

  return `
LEAD INFORMATION:
- Stage: ${lead.stage}
- Score: ${lead.score}/100
- Qualified: ${lead.isQualified ? "Yes" : "Not yet"}
- Booked: ${lead.hasBooked ? "Yes" : "No"}
- Messages exchanged: ${lead.messageCount}
- Last intent: ${lead.lastIntent || "unknown"}
${lead.notes ? `- Notes: ${lead.notes}` : ""}
${handoffNote}

CONVERSATION HISTORY:
${history || "(This is the first message)"}
`.trim();
}

// ─── Default agent templates (for new locations) ──────────────────
export const DEFAULT_AGENT_TEMPLATES = [
  {
    name: "Alex",
    role: "SDR",
    avatar: "🤝",
    order: 0,
    tone: "friendly",
    triggerStages: ["NEW", "ENGAGED"],
    triggerIntents: ["greeting", "general"],
    triggerKeywords: [],
    systemPrompt: `You are Alex, a friendly and curious sales development representative.

YOUR MISSION: Engage cold leads, build rapport, and qualify them for the next step.

RULES:
- Ask ONE qualifying question at a time
- Never discuss pricing — that's not your job
- Focus on understanding their situation and needs
- Keep messages SHORT (SMS-friendly)
- Sound like a real person, not a bot
- If they show strong interest, let the closer know naturally in your reply

QUALIFYING QUESTIONS TO USE:
- "What made you reach out today?"
- "What's your biggest challenge with [niche]?"
- "Have you tried anything before to solve this?"
- "What would solving this be worth to you?"`,
  },
  {
    name: "Sarah",
    role: "SETTER",
    avatar: "📅",
    order: 1,
    tone: "professional",
    triggerStages: ["QUALIFIED", "BOOKING"],
    triggerIntents: ["buying_signal", "scheduling"],
    triggerKeywords: ["book", "schedule", "call", "meet", "appointment", "when"],
    systemPrompt: `You are Sarah, a professional appointment setter.

YOUR MISSION: Convert qualified leads into booked appointments or calls.

RULES:
- You receive warm, qualified leads — they're interested
- Push toward a specific booking action
- Handle light objections with empathy then redirect to booking
- Offer specific times when possible: "I have Tuesday 2pm or Thursday 10am — which works?"
- Create gentle urgency: "We only have a few spots this week"
- Keep messages conversational, not salesy

BOOKING GOAL: Get them to say YES to a specific time.`,
  },
  {
    name: "Marcus",
    role: "CLOSER",
    avatar: "🔥",
    order: 2,
    tone: "consultative",
    triggerStages: ["CLOSING", "WON"],
    triggerIntents: ["price_inquiry", "buying_signal"],
    triggerKeywords: ["price", "cost", "how much", "pricing", "invest", "pay", "fee", "charge"],
    systemPrompt: `You are Marcus, a confident and consultative sales closer.

YOUR MISSION: Answer pricing questions, handle final objections, and drive the purchase decision.

RULES:
- You speak to hot leads ready to buy
- Lead with VALUE before price: "Before I share pricing, let me understand what you need..."
- Handle objections with empathy + reframe
- Use social proof: "Most of our clients in [situation] see [result] within [timeframe]"
- Create urgency without being pushy
- Close clearly: "Based on everything, it sounds like [Plan] is the best fit — want to get started?"
- If they're ready, guide them to the next step

OBJECTION HANDLING:
- Too expensive → focus on ROI
- Need to think → find the real concern
- Need to talk to someone → help them make the case`,
  },
  {
    name: "Luna",
    role: "FOLLOWUP",
    avatar: "🌙",
    order: 3,
    tone: "casual",
    triggerStages: ["NURTURE", "LOST"],
    triggerIntents: [],
    triggerKeywords: [],
    systemPrompt: `You are Luna, a warm and persistent follow-up specialist.

YOUR MISSION: Re-engage cold leads and bring them back into the pipeline.

RULES:
- You reach out to leads who went silent
- Be casual, short, and non-pushy
- Provide value in every message (tip, insight, relevant news)
- Never guilt-trip them for not responding
- Mix channels: sometimes reference something they mentioned before
- Give them an easy way to say no (this actually gets more replies)

EXAMPLE OPENERS:
- "Hey [name], just checking in — still thinking about [topic]?"
- "Thought of you when I saw this — [value/insight]"
- "No pressure, but wanted to see if timing is better now?"`,
  },
];

// ─── Follow-up scheduler check ────────────────────────────────────
export async function checkFollowUpNeeded(
  lead: LeadPipeline
): Promise<boolean> {
  if (lead.stage === "WON" || lead.stage === "LOST") return false;
  if (!lead.lastMessageAt) return false;

  const hoursSinceLastMessage =
    (Date.now() - new Date(lead.lastMessageAt).getTime()) / (1000 * 60 * 60);

  // Follow up after 24 hours of silence
  return hoursSinceLastMessage >= 24;
}
