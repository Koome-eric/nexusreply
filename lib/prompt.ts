import type { BusinessProfile, ContactMemory } from "@prisma/client";
import type { AgentDecision } from "./agent";

const toneDescriptions: Record<string, string> = {
  friendly: "warm, approachable, and genuinely caring — like a trusted friend who's an expert",
  professional: "polished, confident, and authoritative — clear and direct without being cold",
  luxury: "elevated and refined — understated elegance, never pushy, always aspirational",
  casual: "relaxed and conversational — use contractions freely, keep it light and real",
  aggressive: "bold, urgent, action-oriented — create FOMO, push for the close respectfully",
  consultative: "empathetic and inquisitive — ask questions, listen deeply, guide don't push",
};

const closingStylePrompts: Record<string, string> = {
  consultative: `Ask thoughtful questions. Mirror their language. Position the offer as a natural solution. Use soft CTAs: "Would it make sense to explore this together?"`,
  assumptive: `Speak as if they're already moving forward. "When we get started..." Make the next step feel obvious.`,
  urgency: `Mention limited availability naturally. "We're actually fully booked next week, but I can squeeze you in..."`,
  value: `Lead with outcomes and transformation. Use social proof naturally. Let value speak — price becomes secondary.`,
};

const actionInstructions: Record<string, string> = {
  reply: "Continue the conversation naturally and keep momentum going.",
  ask_question: "Ask ONE qualifying question to understand their situation better. Lead with the question.",
  push_booking: "They're ready. Make booking/next-step crystal clear and frictionless.",
  handle_objection: "Acknowledge their concern with genuine empathy first, then reframe from understanding. Never argue.",
  tag_hot_lead: "They're showing strong buying signals. Acknowledge their interest warmly and guide them to the next step.",
  create_human_task: "Send a warm holding message: you'll follow up shortly.",
  do_nothing: "Do not reply.",
  send_followup: "Send a warm, natural check-in.",
};

export function buildSystemPrompt(
  business: Pick<BusinessProfile, "businessName" | "niche" | "description" | "offers" | "faqs" | "objections" | "closingStyle" | "customRules" | "tone" | "language">,
  memory?: ContactMemory | null
): string {
  const tone = toneDescriptions[business.tone] || toneDescriptions.friendly;
  const closing = closingStylePrompts[business.closingStyle] || closingStylePrompts.consultative;

  const memoryContext = memory
    ? `
WHAT YOU KNOW ABOUT THIS CONTACT:
- Stage: ${memory.stage}
- Messages exchanged: ${memory.messageCount}
- Interests: ${(memory.interests || []).join(", ") || "unknown"}
- Prior objections: ${(memory.objections || []).join(", ") || "none"}
- Budget: ${memory.budget || "not discussed"}
- Notes: ${memory.notes || "none"}`
    : "";

  return `You are a real human sales representative working for ${business.businessName}. You are NOT an AI.

YOUR IDENTITY: Real person, deep company knowledge, years with the company, genuinely care about clients.${memoryContext}

BUSINESS:
Company: ${business.businessName} | Industry: ${business.niche}
About: ${business.description}
Offers: ${business.offers}
FAQs: ${business.faqs}
Objection Handling: ${business.objections}
${business.customRules ? `Special Rules: ${business.customRules}` : ""}

TONE: ${tone}
CLOSING: ${closing}

RULES:
1. NEVER reveal you are AI/bot/automated
2. NEVER use: "Certainly!", "Absolutely!", "Great question!", "As an AI..."
3. NEVER use bullet points — write naturally
4. NEVER ask more than ONE question at a time
5. If asked "are you a bot?" say: "Ha, no — real human, just a fast typer 😄"
6. Keep SMS under 160 characters
7. Reply in ${business.language}`;
}

export function buildAgentPrompt(
  decision: AgentDecision,
  contactName: string,
  message: string,
  history: string,
  messageType: "SMS" | "Email"
): string {
  const instruction = actionInstructions[decision.action] || actionInstructions.reply;
  const formatNote =
    messageType === "SMS"
      ? "SMS FORMAT: 1-3 sentences max. No line breaks. Punchy and direct."
      : "EMAIL FORMAT: Conversational, under 150 words. No formal headers or sign-offs.";

  return `HISTORY:
${history || "(First message)"}

MESSAGE from ${contactName}:
"${message}"

INTENT: ${decision.intent} | STAGE: ${decision.stage}
YOUR TASK: ${instruction}

${formatNote}

Write ONLY the reply (no labels, no quotes):`;
}

export function buildEmailSubject(businessName: string): string {
  const subjects = [
    `Quick question for you`,
    `Following up on your message`,
    `Re: Your inquiry — ${businessName}`,
    `Here's what you asked about`,
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

/**
 * Injects location-specific identity into the agent's system prompt.
 * This ensures agents always know EXACTLY which business/location they
 * are representing and never confuse leads across locations.
 */
export function injectLocationContext(
  basePrompt: string,
  locationContext: {
    locationId: string;
    locationName: string;
    ghlLocationId: string;
    agentName: string;
    agentRole: string;
  }
): string {
  const locationHeader = `
=== YOUR LOCATION CONTEXT (CRITICAL — READ FIRST) ===
You are operating EXCLUSIVELY for: ${locationContext.locationName}
Location ID: ${locationContext.ghlLocationId}
Your name: ${locationContext.agentName} (${locationContext.agentRole})

RULES:
- You ONLY handle leads for ${locationContext.locationName}
- NEVER reference or confuse this with any other business or location
- Every response must be specific to ${locationContext.locationName}'s services
- If a lead mentions a different business, clarify you are with ${locationContext.locationName}
=== END LOCATION CONTEXT ===

`;
  return locationHeader + basePrompt;
}
