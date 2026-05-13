import { openai } from "./openai";
import { prisma } from "./db";

export type AgentAction =
  | "reply"
  | "ask_question"
  | "push_booking"
  | "handle_objection"
  | "tag_hot_lead"
  | "create_human_task"
  | "do_nothing"
  | "send_followup";

export interface AgentDecision {
  intent: string;
  stage: string;
  action: AgentAction;
  confidence: number;
  reasoning: string;
  suggestedReply?: string;
}

const DECISION_SYSTEM = `You are an AI sales agent decision engine. 
Analyze the incoming message and conversation context, then output a JSON decision object.

Output ONLY valid JSON — no markdown, no explanation:
{
  "intent": "greeting|question|objection|buying_signal|complaint|unsubscribe|general|price_inquiry|scheduling",
  "stage": "new|warm|hot|closing|customer|lost",
  "action": "reply|ask_question|push_booking|handle_objection|tag_hot_lead|create_human_task|do_nothing",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Intent guide:
- greeting: first contact or hello
- question: asking about services/process
- objection: price, timing, hesitation, "need to think"
- buying_signal: ready to proceed, asking about next steps
- price_inquiry: specifically asking about cost
- scheduling: asking about availability or booking
- complaint: unhappy, issue, refund request
- unsubscribe: stop, remove, unsubscribe

Action guide:
- reply: standard conversational reply
- ask_question: lead with a qualifying question
- push_booking: guide directly to scheduling
- handle_objection: address the concern with empathy
- tag_hot_lead: buying signal detected, tag and reply
- create_human_task: confidence low or complex issue
- do_nothing: spam or irrelevant`;

export async function makeAgentDecision(
  message: string,
  history: string,
  contactMemory: {
    stage: string;
    messageCount: number;
    objections: string[];
    interests: string[];
  }
): Promise<AgentDecision> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: DECISION_SYSTEM },
        {
          role: "user",
          content: `Contact stage: ${contactMemory.stage}
Message count with contact: ${contactMemory.messageCount}
Known interests: ${contactMemory.interests.join(", ") || "none"}
Known objections: ${contactMemory.objections.join(", ") || "none"}

Conversation history (last 5):
${history || "(first message)"}

New message: "${message}"`,
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });

    const raw = completion.choices[0].message.content?.trim() || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const decision = JSON.parse(clean) as AgentDecision;
    return decision;
  } catch {
    // Fallback decision
    return {
      intent: "general",
      stage: contactMemory.stage,
      action: "reply",
      confidence: 0.6,
      reasoning: "Fallback — parsing error",
    };
  }
}

export async function getOrCreateContactMemory(
  userId: string,
  contactId: string,
  locationId?: string
) {
  return prisma.contactMemory.upsert({
    where: { userId_contactId: { userId, contactId } },
    update: {},
    create: {
      userId,
      contactId,
      locationId,
      interests: [],
      objections: [],
      tags: [],
      stage: "new",
    },
  });
}

export async function updateContactMemoryFromDecision(
  userId: string,
  contactId: string,
  decision: AgentDecision,
  message: string
) {
  const memory = await prisma.contactMemory.findUnique({
    where: { userId_contactId: { userId, contactId } },
  });
  if (!memory) return;

  const updates: Record<string, unknown> = {
    lastIntent: decision.intent,
    messageCount: { increment: 1 },
  };

  // Update stage
  if (decision.stage && decision.stage !== memory.stage) {
    updates.stage = decision.stage;
  }

  // Extract interests from message keywords
  const interestKeywords = ["interested in", "looking for", "need", "want"];
  for (const kw of interestKeywords) {
    if (message.toLowerCase().includes(kw)) {
      const existing = memory.interests || [];
      if (!existing.includes(message.slice(0, 50))) {
        updates.interests = [...existing, message.slice(0, 50)].slice(-5);
      }
    }
  }

  // Track objections
  if (decision.intent === "objection") {
    const existing = memory.objections || [];
    const snippet = message.slice(0, 80);
    if (!existing.includes(snippet)) {
      updates.objections = [...existing, snippet].slice(-5);
    }
  }

  await prisma.contactMemory.update({
    where: { userId_contactId: { userId, contactId } },
    data: updates,
  });
}
