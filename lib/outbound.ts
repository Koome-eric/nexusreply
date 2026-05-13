import { prisma } from "./db";
import { openai } from "./openai";
import { sendMessage } from "./ghl";
import { getValidTokenForLocation } from "./token-manager";
import { getOrCreateLead, findBestAgent } from "./handoff-engine";
import type { AIAgent } from "@prisma/client";

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

// ─── Fetch contacts from GHL location ────────────────────────────
export async function fetchGHLContacts(
  locationId: string,
  token:      string,
  limit = 50,
  page  = 1
): Promise<{
  contacts: Array<{
    id: string; firstName?: string; lastName?: string;
    name?: string; email?: string; phone?: string; tags?: string[];
  }>;
  total: number;
}> {
  const res = await fetch(
    `${GHL_BASE}/contacts/?locationId=${locationId}&limit=${limit}&skip=${(page - 1) * limit}`,
    { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
  );
  if (!res.ok) throw new Error(`GHL contacts fetch failed: ${await res.text()}`);
  const data = await res.json();
  return { contacts: data.contacts || [], total: data.meta?.total || 0 };
}

// ─── Build full business context string ──────────────────────────
async function buildBusinessContext(locationId: string): Promise<{
  context: string;
  businessName: string;
  businessProfile: { language?: string; tone?: string } | null;
}> {
  const bp = await prisma.businessProfile.findUnique({ where: { locationId } });
  if (!bp) return { context: "", businessName: "us", businessProfile: null };
  const context = [
    `Business: ${bp.businessName}`,
    `Industry: ${bp.niche}`,
    `About: ${bp.description || ""}`,
    `Products/Services: ${bp.offers}`,
    bp.faqs        ? `FAQs: ${bp.faqs}`           : null,
    bp.objections  ? `Objection Handling: ${bp.objections}` : null,
    bp.customRules ? `Special Rules: ${bp.customRules}`     : null,
    `Language: Reply ONLY in ${bp.language || "English"}`,
    `Tone: ${bp.tone || "friendly"}`,
  ].filter(Boolean).join("\n");
  return { context, businessName: bp.businessName, businessProfile: bp };
}

// ─── Generate initial outbound message ───────────────────────────
export async function generateOutboundMessage(
  agent:           AIAgent,
  contactName:     string,
  businessContext: string,
  channel:         "SMS" | "Email"
): Promise<string> {
  const safeName = (contactName || "").trim() || "there";
  const formatNote = channel === "SMS"
    ? "Write a single conversational sentence under 140 characters. No bullet points. No emojis overload."
    : "Write a short, warm paragraph under 80 words. No formal headers. Casual and personal.";

  try {
    const completion = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0.8,
      max_tokens:  channel === "SMS" ? 80 : 180,
      messages: [
        {
          role:    "system",
          content: `${agent.systemPrompt}\n\n${businessContext}\n\nYou are sending the VERY FIRST message to a cold lead named ${safeName}. ${formatNote}\nWrite ONLY the message body — no labels, no quotes, no subject lines, no placeholders like [Name].`,
        },
        {
          role:    "user",
          content: `Write the first outreach message to ${safeName}.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Replace any leftover placeholder text the AI might include
    const cleaned = raw
      .replace(/\[Name\]/g, safeName)
      .replace(/\[Your Name\]/g, agent.name)
      .replace(/\[Business Name\]/g, "us")
      .trim();

    if (cleaned.length >= 10) {
      console.log(`[generateOutboundMessage] ✅ AI (${channel}): "${cleaned.slice(0, 80)}"`);
      return cleaned;
    }

    console.warn(`[generateOutboundMessage] AI returned too short (${cleaned.length} chars) — using fallback`);
  } catch (err) {
    console.error("[generateOutboundMessage] AI error:", err);
  }

  // Guaranteed fallback — always a valid, non-empty string
  const fallback = channel === "SMS"
    ? `Hi ${safeName}! Thanks for your interest. How can we help you today?`
    : `Hi ${safeName},\n\nThanks for reaching out! We'd love to learn how we can help you. What brings you here today?\n\nLooking forward to connecting!`;

  console.log(`[generateOutboundMessage] Using fallback (${channel})`);
  return fallback;
}

// ─── Initiate a single conversation via one channel ──────────────
//
// KEY FIX: does NOT check outboundStarted here — that check belongs in
// activateAIForContacts which orchestrates multi-channel sends.
// outboundStarted is only set AFTER all channels are processed.
export async function initiateConversation(
  userId:        string,
  locationId:    string,
  ghlLocationId: string,
  contactId:     string,
  channel:       "SMS" | "Email",
  message:       string,
  agentId?:      string,
  contactEmail?: string,
  contactPhone?: string,
  markStarted  = true   // set false when sending 2nd channel so lead isn't double-blocked
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // ── STEP 1: Validate message BEFORE anything touches GHL ────
    const trimmedMessage = (message || "").trim();
    if (!trimmedMessage) {
      const err = `[initiateConversation] BLOCKED: empty message for contact ${contactId} channel ${channel}`;
      console.error(err);
      return { success: false, error: "Message is empty — cannot send to GHL" };
    }

    console.log(`[initiateConversation] ${channel} → contact ${contactId}: "${trimmedMessage.slice(0, 80)}"`);

    // ── STEP 2: Validate contact has required field for channel ──
    if (channel === "SMS" && !contactPhone) {
      return { success: false, error: "Contact has no phone number for SMS" };
    }
    if (channel === "Email" && !contactEmail) {
      return { success: false, error: "Contact has no email address for Email" };
    }

    // ── STEP 3: Get GHL token ────────────────────────────────────
    const tokenData = await getValidTokenForLocation(ghlLocationId);
    if (!tokenData) return { success: false, error: "No valid GHL connection" };
    const { token } = tokenData;

    // ── STEP 4: Check usage quota ────────────────────────────────
    const { allowed } = await checkUsageAllowed(userId);
    if (!allowed) {
      return { success: false, error: "Usage limit reached — upgrade your plan" };
    }

    // ── STEP 5: Get business name for email subject ──────────────
    let businessName = "us";
    try {
      const bp = await prisma.businessProfile.findUnique({
        where:  { locationId },
        select: { businessName: true },
      });
      businessName = bp?.businessName || "us";
    } catch { /* use default */ }

    const emailSubject = `A quick message from ${businessName}`;

    // ── STEP 6: Get/create lead (don't touch outboundStarted yet) ─
    const lead = await getOrCreateLead(userId, locationId, contactId, {
      name:  contactEmail ? undefined : undefined,
      email: contactEmail,
      phone: contactPhone,
    });

    // ── STEP 7: SEND TO GHL ──────────────────────────────────────
    await sendMessage(
      contactId,
      trimmedMessage,
      channel,
      token,
      ghlLocationId,         // ← required for conversation lookup/create
      channel === "Email" ? emailSubject : undefined,
      channel === "Email" ? contactEmail : undefined,
      undefined              // no existing conversationId for first outbound
    );

    // ── STEP 8: Update lead pipeline ────────────────────────────
    await prisma.leadPipeline.update({
      where: { id: lead.id },
      data: {
        ...(markStarted && { outboundStarted: true }),
        outboundChannel:  channel,
        stage:            "ENGAGED",
        assignedAgentId:  agentId || lead.assignedAgentId,
        lastMessageAt:    new Date(),
        messageCount:     { increment: 1 },
      },
    });

    // ── STEP 9: Log the message ──────────────────────────────────
    await prisma.aIMessageLog.create({
      data: {
        userId,
        locationId,
        contactId,
        conversationId: `outbound_${contactId}_${channel}`,
        messageType:    channel,
        inputMessage:   "(outbound initiated)",
        aiResponse:     trimmedMessage,
        agentId:        agentId || null,
        intent:         "greeting",
        agentAction:    "reply",
        status:         "sent",
      },
    });

    // ── STEP 9b: Cache conversation so it shows in Conversations page ──
    const convCacheId = `outbound_${contactId}_${channel}`;
    await prisma.conversationCache.upsert({
      where:  { ghlConversationId: convCacheId },
      update: {
        lastMessageAt: new Date(),
        status: "active",
        ...(contactEmail && { contactEmail }),
        ...(contactPhone && { contactPhone }),
      },
      create: {
        userId,
        locationId,
        ghlConversationId: convCacheId,
        contactId,
        contactName:  null,  // will be updated by webhook when lead replies
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        lastMessageAt: new Date(),
        status: "active",
      },
    }).catch(e => console.warn("[initiateConversation] ConversationCache upsert failed:", e));

    // ── STEP 10: Increment usage ─────────────────────────────────
    await incrementUsage(userId);

    console.log(`[initiateConversation] ✅ ${channel} sent to ${contactId}`);
    return { success: true, message: trimmedMessage };

  } catch (err) {
    console.error(`[initiateConversation] ❌ Error (${channel} → ${contactId}):`, err);
    return {
      success: false,
      error:   err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Check if account can send more messages ──────────────────────
async function checkUsageAllowed(userId: string): Promise<{ allowed: boolean }> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { allowed: false };
  if (sub.status === "trialing") return { allowed: sub.trialMessagesUsed   < sub.trialMessagesLimit };
  if (sub.status === "active")   return { allowed: sub.messagesUsedThisPeriod < sub.monthlyMessageLimit };
  return { allowed: false };
}

// ─── Increment usage counter ──────────────────────────────────────
async function incrementUsage(userId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return;
  if (sub.status === "trialing") {
    await prisma.subscription.update({ where: { userId }, data: { trialMessagesUsed: { increment: 1 } } });
  } else if (sub.status === "active") {
    await prisma.subscription.update({ where: { userId }, data: { messagesUsedThisPeriod: { increment: 1 } } });
  }
}
