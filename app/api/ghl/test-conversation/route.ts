/**
 * app/api/ghl/test-conversation/route.ts
 *
 * Simulates the full conversation flow for a real contact in the location.
 * Does NOT send an actual message to GHL — runs the AI pipeline dry-run
 * so you can see exactly what would be replied and why.
 *
 * POST {
 *   locationId:     string;  // internal DB id
 *   testMessage?:  string;  // simulated inbound message (default: "Hi, I'm interested")
 *   send?:         boolean; // if true, actually sends via GHL (careful!)
 *   contactId?:    string;  // use a specific contact, else picks first from GHL
 * }
 */

import { NextRequest, NextResponse }    from "next/server";
import { resolveLocationAccess }        from "@/lib/client-access";
import { prisma }                       from "@/lib/db";
import { getValidTokenForLocation }     from "@/lib/token-manager";
import { getContact, getConversationMessages, sendMessage } from "@/lib/ghl";
import { buildSystemPrompt, buildEmailSubject, injectLocationContext } from "@/lib/prompt";
import { makeAgentDecision, getOrCreateContactMemory } from "@/lib/agent";
import { getOrCreateLead, runHandoffEngine, buildAgentContext } from "@/lib/handoff-engine";
import { openai } from "@/lib/openai";

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export async function POST(req: NextRequest) {
  const { locationId, testMessage, send, contactId: reqContactId } = await req.json();
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = await prisma.location.findFirst({
    where:   { id: locationId, userId: access.ownerId },
    include: { ghlConnection: true, automationConfig: true },
  });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const tokenData = await getValidTokenForLocation(location.ghlLocationId);
  if (!tokenData) return NextResponse.json({ error: "No GHL token — reconnect the location" }, { status: 400 });
  const token = tokenData.token;

  const checks: Record<string, string> = {};

  // ── Check 1: Token ─────────────────────────────────────────────
  checks["1_token"] = `✅ Token valid (${token.slice(0,12)}...)`;

  // ── Check 2: Automation config ─────────────────────────────────
  const cfg = location.automationConfig;
  checks["2_automation"] = cfg?.enabled
    ? `✅ Automation enabled (SMS: ${cfg.smsEnabled}, Email: ${cfg.emailEnabled})`
    : `⚠️ Automation config missing or disabled — run /api/ghl/bootstrap first`;

  // ── Check 3: Business profile ──────────────────────────────────
  const bp = await prisma.businessProfile.findUnique({ where: { locationId } });
  checks["3_business_profile"] = bp
    ? `✅ Business profile: "${bp.businessName}" (${bp.niche})`
    : `⚠️ No business profile — AI will use defaults. Set one up in Setup → Business Info`;

  // ── Check 4: AI agents ─────────────────────────────────────────
  const agents = await prisma.aIAgent.findMany({ where: { locationId, isActive: true }, orderBy: { order: "asc" } });
  checks["4_agents"] = agents.length > 0
    ? `✅ ${agents.length} active agent(s): ${agents.map(a => `${a.name}(${a.role})`).join(", ")}`
    : `⚠️ No active agents — run /api/ghl/bootstrap to create defaults`;

  // ── Check 5: Find a contact to test with ──────────────────────
  let contactId = reqContactId;
  let contactName = "Test Lead";
  let contactEmail = "";
  let conversationId = "";

  if (!contactId) {
    // Grab first contact from GHL
    try {
      const res = await fetch(
        `${GHL_BASE}/contacts/?locationId=${location.ghlLocationId}&limit=1`,
        { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
      );
      const data = await res.json();
      const firstContact = data.contacts?.[0];
      if (firstContact) {
        contactId    = firstContact.id;
        contactName  = firstContact.firstName
          ? `${firstContact.firstName} ${firstContact.lastName || ""}`.trim()
          : firstContact.name || "Test Lead";
        contactEmail = firstContact.email || "";
      }
    } catch (err) {
      checks["5_contact"] = `❌ Failed to fetch contacts: ${String(err).slice(0, 100)}`;
    }
  }

  if (contactId) {
    try {
      const contact = await getContact(contactId, token);
      contactName  = contact.firstName
        ? `${contact.firstName} ${contact.lastName || ""}`.trim()
        : contact.name || contactName;
      contactEmail = contact.email || contactEmail;
      checks["5_contact"] = `✅ Contact: "${contactName}" (${contactEmail || "no email"}) — ID: ${contactId}`;
    } catch (err) {
      checks["5_contact"] = `⚠️ Contact fetch failed: ${String(err).slice(0, 100)}`;
    }
  } else {
    checks["5_contact"] = "⚠️ No contacts found in this GHL location — add at least one contact";
  }

  // ── Check 6: Conversation history ─────────────────────────────
  let history = "";
  if (contactId) {
    try {
      // Find or create conversation
      const convSearch = await fetch(
        `${GHL_BASE}/conversations/search?locationId=${location.ghlLocationId}&contactId=${contactId}&limit=1`,
        { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
      );
      if (convSearch.ok) {
        const convData = await convSearch.json();
        conversationId = convData.conversations?.[0]?.id || "";
      }

      if (conversationId) {
        const msgs = await getConversationMessages(conversationId, token, 10);
        history = msgs.slice(-8).map(m => `${m.direction === "inbound" ? contactName : "Agent"}: ${m.body}`).join("\n");
        checks["6_history"] = `✅ ${msgs.length} message(s) in conversation (ID: ${conversationId})`;
      } else {
        checks["6_history"] = "ℹ️ No existing conversation — this would be the first message";
      }
    } catch (err) {
      checks["6_history"] = `⚠️ Could not fetch history: ${String(err).slice(0, 100)}`;
    }
  }

  // ── Check 7: AI decision + response generation ─────────────────
  const inboundMessage = testMessage || "Hi, I'm interested in your services";
  let aiReply       = "";
  let agentUsed     = "";
  let decisionData: Record<string, unknown> = {};

  if (contactId) {
    try {
      const rawLead = await getOrCreateLead(access.ownerId, locationId, contactId, {
        name: contactName, email: contactEmail, conversationId,
      });
      const lead = await prisma.leadPipeline.findUnique({
        where:   { id: rawLead.id },
        include: { assignedAgent: true },
      });

      const memory = await getOrCreateContactMemory(access.ownerId, contactId, locationId);

      const decision = await makeAgentDecision(inboundMessage, history, {
        stage:        memory.stage,
        messageCount: memory.messageCount,
        objections:   memory.objections || [],
        interests:    memory.interests  || [],
      });

      decisionData = {
        intent:     decision.intent,
        stage:      decision.stage,
        action:     decision.action,
        confidence: decision.confidence,
        reasoning:  decision.reasoning,
      };

      const { nextStage, nextAgent } = await runHandoffEngine(lead!, decision.intent, inboundMessage);

      agentUsed = nextAgent ? `${nextAgent.name} (${nextAgent.role})` : "Default AI";

      const businessProfile = bp || {
        businessName: location.name, niche: "general", description: "",
        offers: "products and services", faqs: "", objections: "",
        closingStyle: "consultative", tone: "friendly", language: "English",
        customRules: null,
      };

      let systemPrompt: string;
      if (nextAgent) {
        const agentCtx = await buildAgentContext(lead!, history, nextAgent, lead?.assignedAgent || null);
        const raw = `You are ${nextAgent.name}, a ${nextAgent.role} specialist.\n\n${nextAgent.systemPrompt}\n\nBUSINESS: ${businessProfile.businessName} | ${businessProfile.niche}\nOffers: ${businessProfile.offers}\n\nLEAD: ${agentCtx}`;
        systemPrompt = injectLocationContext(raw, {
          locationId, locationName: location.name, ghlLocationId: location.ghlLocationId,
          agentName: nextAgent.name, agentRole: nextAgent.role,
        });
      } else {
        systemPrompt = injectLocationContext(buildSystemPrompt(businessProfile as never, memory), {
          locationId, locationName: location.name, ghlLocationId: location.ghlLocationId,
          agentName: "AI Agent", agentRole: "ASSISTANT",
        });
      }

      const completion = await openai.chat.completions.create({
        model:       cfg?.aiModel || "gpt-4o-mini",
        messages:    [
          { role: "system", content: systemPrompt },
          { role: "user",   content: `${contactName}: "${inboundMessage}"\n\nWrite ONLY the reply:` },
        ],
        temperature: 0.85,
        max_tokens:  200,
      });

      aiReply = completion.choices[0].message.content?.trim() || "";
      checks["7_ai_reply"] = `✅ AI generated reply (${aiReply.length} chars) via ${agentUsed}`;

      // ── Optionally send for real ───────────────────────────────
      if (send && aiReply && conversationId) {
        try {
          await sendMessage(contactId, aiReply, "SMS", token, location.ghlLocationId, undefined, contactEmail, conversationId);
          checks["8_send"] = `✅ Message SENT to GHL conversation ${conversationId}`;
        } catch (sendErr) {
          checks["8_send"] = `❌ Send failed: ${String(sendErr).slice(0, 200)}`;
        }
      } else if (send) {
        checks["8_send"] = "⚠️ Could not send — missing conversationId or reply";
      }

    } catch (err) {
      checks["7_ai_reply"] = `❌ AI generation failed: ${String(err).slice(0, 200)}`;
    }
  } else {
    checks["7_ai_reply"] = "⏭️ Skipped — no contact to test with";
  }

  return NextResponse.json({
    ok:   true,
    summary: {
      location:     location.name,
      ghlLocationId: location.ghlLocationId,
      contactId,
      contactName,
      testMessage:  inboundMessage,
      agentUsed,
      aiReply,
      decision:     decisionData,
      sent:         send && !!aiReply && !!conversationId,
    },
    checks,
  });
}
