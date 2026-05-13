import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openai } from "@/lib/openai";
import { getContact, getConversationMessages, sendMessage, updateContactTags, createTask } from "@/lib/ghl";
import { buildSystemPrompt, buildEmailSubject, injectLocationContext } from "@/lib/prompt";
import { makeAgentDecision, getOrCreateContactMemory, updateContactMemoryFromDecision } from "@/lib/agent";
import { getOrCreateLead, runHandoffEngine, applyHandoff, buildAgentContext } from "@/lib/handoff-engine";
import { getValidTokenForLocation } from "@/lib/token-manager";
import { checkTrialOrActive, incrementUsage } from "@/lib/auth";
import { sleep } from "@/lib/utils";
import { getEmailProviderForLocation, sendEmailViaProvider, plainTextToHtml } from "@/lib/email-sender";

export async function POST(req: NextRequest) {
  const { eventId, userId, locationId, ghlLocationId, contactId, conversationId, message, type } = await req.json();

  try {
    const tokenData = await getValidTokenForLocation(ghlLocationId);
    if (!tokenData) throw new Error("No token for location");
    const { token } = tokenData;

    // 1. Fetch contact — getContact() already unwraps { contact: {...} }
    let contactName  = "there";
    let contactEmail = "";
    let contactPhone = "";
    try {
      const contact  = await getContact(contactId, token);
      contactName    = (contact.firstName
        ? `${contact.firstName} ${contact.lastName || ""}`.trim()
        : contact.name) || "there";
      contactEmail   = (contact.email || contact.emailAddress || "").trim();
      contactPhone   = (contact.phone || contact.phoneNumber  || "").trim();
      console.log(`[AI Process] Contact ${contactId}: name="${contactName}" email="${contactEmail}" phone="${contactPhone}"`);
    } catch (err) {
      console.warn("[AI Process] Could not fetch contact details — using defaults:", err);
    }

    // 2. Fetch conversation history — GHL returns { messages: { messages: [...] } }
    let history = "";
    try {
      const msgs = await getConversationMessages(conversationId, token, 15);
      history = msgs
        .slice(-12)
        .map(m => `${m.direction === "inbound" ? contactName : "You"}: ${m.body}`)
        .join("\n");
    } catch { /* proceed without history */ }

    // 3. Get or create lead in pipeline
    const rawLead = await getOrCreateLead(userId, locationId, contactId, {
      name:  contactName,
      email: contactEmail,
      phone: contactPhone,
      conversationId,
    });
    const lead = await prisma.leadPipeline.findUnique({
      where: { id: rawLead.id },
      include: { assignedAgent: true },
    });
    if (!lead) throw new Error("Lead not found");

    // 4. Agent decision engine
    const memory = await getOrCreateContactMemory(userId, contactId, locationId);
    const decision = await makeAgentDecision(message, history, {
      stage:        memory.stage,
      messageCount: memory.messageCount,
      objections:   memory.objections || [],
      interests:    memory.interests  || [],
    });

    // 5. Handle unsubscribe
    if (decision.intent === "unsubscribe") {
      await updateContactTags(contactId, ["Unsubscribed"], token);
      await applyHandoff(lead.id, "LOST", null, "unsubscribe", "Unsubscribed", lead.stage);
      await prisma.webhookEvent.update({ where: { id: eventId }, data: { processed: true, processedAt: new Date() } });
      return NextResponse.json({ success: true, action: "unsubscribed" });
    }

    // 6. Run handoff engine
    const { nextStage, nextAgent, stageChanged, agentChanged, reason } =
      await runHandoffEngine(lead, decision.intent, message);

    // 7. Skip if do_nothing
    if (decision.action === "do_nothing") {
      await prisma.webhookEvent.update({ where: { id: eventId }, data: { processed: true, processedAt: new Date() } });
      return NextResponse.json({ success: true, action: "skipped" });
    }

    // 8. Human task
    const automationConfig = await prisma.automationConfig.findUnique({ where: { locationId } });
    // automationConfig may not exist for freshly connected locations — use safe defaults
    if (decision.action === "create_human_task") {
      const dueDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await createTask(contactId, `⚠️ ${nextAgent?.name || "AI"} needs human: "${message.slice(0, 80)}"`, dueDate, token);
      await applyHandoff(lead.id, nextStage, nextAgent?.id || null, decision.intent, reason, lead.stage);
      // Log for conversation visibility
      await prisma.aIMessageLog.create({
        data: {
          userId, locationId, contactId, conversationId, messageType: type,
          inputMessage: message, aiResponse: "(escalated to human)",
          intent: decision.intent, agentAction: "create_human_task",
          agentId: nextAgent?.id, confidence: decision.confidence,
          humanTookOver: true, status: "human_task",
        },
      }).catch(() => {});
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: conversationId },
        update: { lastMessageAt: new Date(), contactName, contactEmail, contactPhone },
        create: { userId, locationId, ghlConversationId: conversationId, contactId, contactName, contactEmail, contactPhone },
      }).catch(() => {});
      await prisma.webhookEvent.update({ where: { id: eventId }, data: { processed: true, processedAt: new Date() } });
      return NextResponse.json({ success: true, action: "human_task" });
    }

    // 9. Check usage quota — only enforce if subscription exists
    const usageCheck = await checkTrialOrActive(userId);
    if (!usageCheck.allowed && usageCheck.reason !== "no_subscription") {
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data:  { processed: true, processedAt: new Date(), error: usageCheck.reason || "usage_limit_exceeded" },
      }).catch(() => {});
      return NextResponse.json({ error: "PLAN_LIMIT_REACHED", reason: usageCheck.reason }, { status: 402 });
    }

    // 10. Get business profile — use default if not configured yet
    const businessProfile = await prisma.businessProfile.findUnique({ where: { locationId } }) || {
      businessName:  "the company",
      niche:         "general",
      description:   "",
      offers:        "our products and services",
      faqs:          "",
      objections:    "",
      closingStyle:  "consultative",
      customRules:   null,
      tone:          "friendly",
      language:      "English",
    };

    // 11. Build system prompt with location context
    const locationRecord = await prisma.location.findUnique({
      where:  { id: locationId },
      select: { name: true, ghlLocationId: true },
    });
    const locationCtx = {
      locationId,
      locationName:  locationRecord?.name           || businessProfile.businessName,
      ghlLocationId: locationRecord?.ghlLocationId  || ghlLocationId,
      agentName:     nextAgent?.name  || "AI Agent",
      agentRole:     nextAgent?.role  || "ASSISTANT",
    };

    let systemPrompt: string;
    if (nextAgent) {
      const agentContext = await buildAgentContext(lead, history, nextAgent, lead.assignedAgent);
      const raw = `You are ${nextAgent.name}, a ${nextAgent.role} sales specialist. You are a real human — NEVER reveal you are AI.

YOUR PERSONA & APPROACH:
${nextAgent.systemPrompt}

BUSINESS YOU REPRESENT:
- Company: ${businessProfile.businessName}
- Industry: ${businessProfile.niche}
- About: ${businessProfile.description || ""}
- Products/Services: ${businessProfile.offers}
- FAQs: ${businessProfile.faqs || ""}
- Objection Handling: ${businessProfile.objections || ""}
${businessProfile.customRules ? `- Special Rules: ${businessProfile.customRules}` : ""}

LEAD CONTEXT:
${agentContext}

ABSOLUTE RULES:
1. You are ${nextAgent.name} — NEVER say you are an AI, bot, or automated system
2. Never use: "Certainly!", "Absolutely!", "Great question!", "As an AI..."
3. ${type === "Email" ? "Email: under 150 words. Conversational paragraphs." : "SMS: under 160 characters. No line breaks."}
4. ALWAYS reply in ${businessProfile.language || "English"}
5. Tone: ${nextAgent.tone || businessProfile.tone || "friendly"}
6. Never ask more than ONE question at a time
7. If asked "are you a bot?" say: "Ha, no — real human here, just a fast typer 😄"`;
      systemPrompt = injectLocationContext(raw, locationCtx);
    } else {
      systemPrompt = injectLocationContext(buildSystemPrompt(businessProfile, memory), locationCtx);
    }

    // 12. User prompt
    const actionInstructions: Record<string, string> = {
      reply:            "Continue naturally and keep momentum.",
      ask_question:     "Ask ONE qualifying question.",
      push_booking:     "Guide clearly to booking/next step.",
      handle_objection: "Acknowledge concern with empathy, then reframe.",
      tag_hot_lead:     "Acknowledge strong interest, guide to next step.",
      send_followup:    "Send a warm natural check-in.",
    };

    const userPrompt = `INCOMING MESSAGE from ${contactName}:
"${message}"

INTENT: ${decision.intent} | PIPELINE STAGE: ${nextStage}
${stageChanged ? `[STAGE CHANGED: ${lead.stage} → ${nextStage}]` : ""}
${agentChanged && nextAgent ? `[HANDOFF: Now handled by ${nextAgent.name}]` : ""}
YOUR TASK: ${actionInstructions[decision.action] || "Reply naturally."}

Write ONLY the reply message:`;

    // 13. Call OpenAI
    const aiModel  = automationConfig?.aiModel || "gpt-4o-mini";
    const completion = await openai.chat.completions.create({
      model:             aiModel,
      messages:          [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature:       0.85,
      max_tokens:        type === "Email" ? 400 : 160,
      presence_penalty:  0.3,
      frequency_penalty: 0.5,
    });

    let aiReply = completion.choices[0].message.content?.trim() || "";
    if (!aiReply || aiReply.length < 8) {
      console.warn("[AI Process] Empty AI response, using fallback");
      aiReply = type === "Email"
        ? "Thanks for reaching out! I'd love to help — could you share a few more details?"
        : "Thanks for your message! Can you tell me a bit more so I can help?";
    }

    // 14. Confidence check → human fallback
    if (decision.confidence < (automationConfig?.confidenceThreshold || 0.7) && automationConfig?.humanFallbackEnabled) {
      const dueDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await createTask(contactId, `⚠️ Low confidence (${Math.round(decision.confidence * 100)}%): "${message.slice(0, 80)}"`, dueDate, token);
      // Log so conversation appears in UI with humanTookOver=true flag
      await prisma.aIMessageLog.create({
        data: {
          userId, locationId, contactId, conversationId, messageType: type,
          inputMessage: message, aiResponse: "(flagged for human review)",
          intent: decision.intent, agentAction: "create_human_task",
          agentId: nextAgent?.id,
          confidence: decision.confidence,
          humanTookOver: true,
          status: "human_fallback",
        },
      }).catch(() => {});
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: conversationId },
        update: { lastMessageAt: new Date(), contactName, contactEmail, contactPhone },
        create: { userId, locationId, ghlConversationId: conversationId, contactId, contactName, contactEmail, contactPhone },
      }).catch(() => {});
      await prisma.webhookEvent.update({ where: { id: eventId }, data: { processed: true, processedAt: new Date() } });
      return NextResponse.json({ success: true, action: "human_fallback" });
    }

    // 15. Human-like delay (1-4 seconds)
    const minD = (automationConfig?.minDelaySec ?? 1) * 1000;
    const maxD = (automationConfig?.maxDelaySec ?? 4) * 1000;
    await sleep(Math.floor(Math.random() * (maxD - minD) + minD));

    // 16. Send reply — use custom email provider if configured, else GHL
    const emailSubject = type === "Email" ? buildEmailSubject(businessProfile.businessName) : undefined;

    if (type === "Email" && contactEmail) {
      const emailProvider = await getEmailProviderForLocation(locationId).catch(() => null);
      if (emailProvider?.fromEmail && emailProvider?.verified) {
        // Send via custom provider (Resend / SMTP)
        await sendEmailViaProvider(emailProvider, {
          to:      contactEmail,
          subject: emailSubject || "Following up",
          html:    plainTextToHtml(aiReply, emailProvider.fromName || emailProvider.fromEmail),
          text:    aiReply,
          replyTo: emailProvider.replyTo || undefined,
        });
      } else {
        // Fall back to GHL
        await sendMessage(contactId, aiReply, "Email", token, ghlLocationId, emailSubject, contactEmail, conversationId);
      }
    } else {
      await sendMessage(contactId, aiReply, type as "SMS" | "Email", token, ghlLocationId, emailSubject, contactEmail || undefined, conversationId);
    }

    // 17. Tag hot leads
    if (decision.intent === "buying_signal" || nextStage === "CLOSING") {
      await updateContactTags(contactId, ["Hot Lead", "AI Qualified"], token).catch(() => {});
    }

    // 18. Apply handoff
    await applyHandoff(lead.id, nextStage, nextAgent?.id || lead.assignedAgentId, decision.intent, reason, lead.stage);

    // 19. Update contact memory
    await updateContactMemoryFromDecision(userId, contactId, decision, message);

    // 20. Log message
    await prisma.aIMessageLog.create({
      data: {
        userId, locationId, contactId, conversationId, messageType: type,
        inputMessage: message, aiResponse: aiReply,
        intent: decision.intent, agentAction: decision.action,
        agentId: nextAgent?.id,
        promptTokens:      completion.usage?.prompt_tokens,
        completionTokens:  completion.usage?.completion_tokens,
        confidence:        decision.confidence,
        status:            "sent",
      },
    });

    // 21. Track usage
    await incrementUsage(userId, completion.usage?.total_tokens || 0, locationId);

    // 22. Cache conversation
    await prisma.conversationCache.upsert({
      where:  { ghlConversationId: conversationId },
      update: { lastMessageAt: new Date(), contactName, contactEmail, contactPhone },
      create: { userId, locationId, ghlConversationId: conversationId, contactId, contactName, contactEmail, contactPhone },
    });

    await prisma.webhookEvent.update({ where: { id: eventId }, data: { processed: true, processedAt: new Date() } });

    return NextResponse.json({
      success: true, reply: aiReply, agent: nextAgent?.name,
      stageChanged, nextStage, agentChanged,
    });

  } catch (err) {
    console.error("AI Process Error:", err);
    await prisma.webhookEvent.update({ where: { id: eventId }, data: { error: String(err) } }).catch(() => {});
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

