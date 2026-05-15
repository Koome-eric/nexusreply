import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/db";
import { notifyNewLead }             from "@/lib/notifications";
import { getOrCreateLead }           from "@/lib/handoff-engine";
import { getValidTokenForLocation }  from "@/lib/token-manager";

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export const runtime     = "nodejs";
export const maxDuration = 30;

// ─── Helpers ──────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBody(raw: string): string {
  const s = raw.trim();
  return s.startsWith("<") ? htmlToText(s) : s;
}

async function fetchEmailBody(emailId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `${GHL_BASE}/conversations/messages/email/${emailId}`,
      { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
    );
    if (!res.ok) {
      console.warn(`[Webhook] getEmailById ${emailId} -> HTTP ${res.status}`);
      return "";
    }
    const data = await res.json();
    const record = data?.email || data;
    const raw = String(record?.body || record?.text || record?.html || "").trim();
    return cleanBody(raw);
  } catch (err) {
    console.warn("[Webhook] fetchEmailBody error:", err);
    return "";
  }
}

async function fetchLatestInboundFromConversation(
  conversationId: string,
  token: string
): Promise<{ body: string; messageId: string; messageType: string }> {
  try {
    const res = await fetch(
      `${GHL_BASE}/conversations/${conversationId}/messages?limit=20`,
      { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
    );
    if (!res.ok) return { body: "", messageId: "", messageType: "EMAIL" };
    const data = await res.json();

    const msgs: Record<string, unknown>[] =
      (data?.messages?.messages ?? data?.messages ?? []) as Record<string, unknown>[];

    // Find latest inbound with a body, prefer email
    const inboundMsgs = [...msgs].reverse().filter(m => m.direction === "inbound");

    const emailMsg = inboundMsgs.find(m => {
      const mt = String(m.messageType || m.type || "").toUpperCase();
      return mt === "EMAIL" || mt === "TYPE_EMAIL";
    });

    const target = emailMsg || inboundMsgs.find(m => m.body);
    if (!target) return { body: "", messageId: "", messageType: "EMAIL" };

    const raw = String(target.body || "").trim();
    const mt  = String(target.messageType || target.type || "EMAIL").toUpperCase();
    return {
      body:        cleanBody(raw),
      messageId:   String(target.id || ""),
      messageType: mt === "TYPE_EMAIL" ? "EMAIL" : (mt === "TYPE_SMS" ? "SMS" : mt),
    };
  } catch (err) {
    console.warn("[Webhook] fetchLatestInboundFromConversation error:", err);
    return { body: "", messageId: "", messageType: "EMAIL" };
  }
}

/**
 * findLatestConversationForContact
 *
 * When a GHL Workflow Webhook action fires, it sends contact data only — no
 * conversationId. We must search GHL for the contact's most recent conversation.
 */
async function findLatestConversationForContact(
  contactId:     string,
  ghlLocationId: string,
  token:         string
): Promise<{ conversationId: string; messageType: string; body: string; messageId: string } | null> {
  try {
    // Search conversations for this specific contact
    const res = await fetch(
      `${GHL_BASE}/conversations/search?locationId=${ghlLocationId}&contactId=${contactId}&limit=5&sortBy=last_message_date&sortOrder=desc`,
      { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
    );
    if (!res.ok) {
      console.warn(`[Webhook] conversation search HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const conversations: Record<string, unknown>[] =
      (data?.conversations ?? []) as Record<string, unknown>[];

    if (!conversations.length) {
      console.warn(`[Webhook] No conversations found for contact ${contactId}`);
      return null;
    }

    // Try each conversation (most recent first) until we find one with inbound content
    for (const conv of conversations) {
      const conversationId = String(conv.id || "");
      if (!conversationId) continue;

      const result = await fetchLatestInboundFromConversation(conversationId, token);

      // If body is empty, try fetching it via email endpoint using the message ID
      let body = result.body;
      if (!body && result.messageId && result.messageType === "EMAIL") {
        body = await fetchEmailBody(result.messageId, token);
      }

      if (body) {
        return {
          conversationId,
          messageType: result.messageType || "EMAIL",
          body,
          messageId: result.messageId,
        };
      }
    }

    // Last resort: return first conversation even if no body yet
    // (AI will get an empty message, better than dropping it)
    const firstId = String(conversations[0].id || "");
    if (firstId) {
      console.warn(`[Webhook] All conversations empty for contact ${contactId}, using first`);
      return { conversationId: firstId, messageType: "EMAIL", body: "", messageId: "" };
    }

    return null;
  } catch (err) {
    console.warn("[Webhook] findLatestConversationForContact error:", err);
    return null;
  }
}

function normaliseMessageType(raw: string): string {
  const up = raw.toUpperCase().trim();
  if (up === "TYPE_EMAIL" || up === "EMAIL") return "EMAIL";
  if (up === "TYPE_SMS"   || up === "SMS")   return "SMS";
  if (up === "TYPE_CALL"  || up === "CALL")  return "CALL";
  return up;
}

function resolveEventType(body: Record<string, unknown>): string {
  const type = String(body.type || body.event || body.eventType || "").trim();

  const INBOUND_ALIASES = [
    "InboundMessage", "IncomingMessage", "MessageCreate",
    "MessageReceived", "ConversationMessage",
    "inbound_message", "incoming_message", "message",
    "inboundmessage", "incomingmessage",
  ];

  if (INBOUND_ALIASES.some(a => type.toLowerCase() === a.toLowerCase())) {
    return "InboundMessage";
  }

  // Payload has contactId + conversationId + content: treat as InboundMessage
  if (
    !type &&
    (body.contactId || body.contact_id) &&
    (body.conversationId || body.conversation_id) &&
    (body.body || body.message || body.messageBody || body.id)
  ) {
    console.log("[GHL Webhook] No type field — inferring InboundMessage from payload shape");
    return "InboundMessage";
  }

  return type;
}

// ─── Main handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: true }); }

  console.log("[GHL Webhook] RAW PAYLOAD:", JSON.stringify(body, null, 2));

  const ghlLocationId = String(
    body.locationId || body.location_id || body.ghlLocationId || ""
  );

  const type = resolveEventType(body);

  if (!ghlLocationId) {
    console.log("[GHL Webhook] Missing locationId in payload:", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  }

  const location = await prisma.location.findUnique({
    where:   { ghlLocationId },
    include: { user: { include: { subscription: true } }, automationConfig: true },
  });

  if (!location) {
    console.log("[GHL Webhook] Location not found:", ghlLocationId);
    return NextResponse.json({ ok: true });
  }

  const userId = location.userId;
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const appUrl = (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost"))
    ? `https://${process.env.VERCEL_URL}`
    : (rawUrl && !rawUrl.includes("localhost") && !rawUrl.includes("127.0.0.1"))
      ? rawUrl
      : "https://nexusreply.vercel.app";

  const tokenData = await getValidTokenForLocation(ghlLocationId);
  const token     = tokenData?.token || "";

  switch (type) {

    // ── Inbound message (native GHL webhook) ───────────────────────
    case "InboundMessage":
    case "IncomingMessage":
    case "MessageCreate":
    case "MessageReceived":
    case "ConversationMessage": {
      await handleInboundMessage(body, location, userId, ghlLocationId, appUrl, token);
      break;
    }

    // ── ContactCreate / ContactUpdate ─────────────────────────────
    // This is what GHL Workflow "Webhook" action sends when a lead
    // replies to an email. The payload contains contact details but
    // NO conversationId or message body. We must look them up.
    case "ContactCreate":
    case "ContactUpdate": {
      const contactId = String(
        body.id || body.contactId || (body.contact as Record<string,unknown>)?.id || ""
      );
      const contactFirstName = String(body.firstName || (body.contact as Record<string,unknown>)?.firstName || "");
      const contactLastName  = String(body.lastName  || (body.contact as Record<string,unknown>)?.lastName  || "");
      const contactEmail     = String(body.email     || (body.contact as Record<string,unknown>)?.email     || "");
      const contactPhone     = String(body.phone     || (body.contact as Record<string,unknown>)?.phone     || "");
      const contactName      = contactFirstName
        ? `${contactFirstName} ${contactLastName}`.trim()
        : String(body.name || (body.contact as Record<string,unknown>)?.name || "New Contact");

      // Always upsert the lead in the pipeline
      await getOrCreateLead(userId, location.id, contactId, {
        name: contactName, email: contactEmail, phone: contactPhone,
      });

      if (type === "ContactCreate") {
        await notifyNewLead(userId, contactName, contactEmail ? "Email" : "SMS").catch(() => {});
      }

      // ── WORKFLOW EMAIL TRIGGER ──────────────────────────────────
      // If this ContactCreate/Update was fired by a "Customer Replied"
      // workflow trigger, we need to find the email they sent and run AI.
      //
      // We detect this by checking if the location has automation enabled
      // and then looking up the latest inbound conversation for this contact.
      if (!token) {
        console.log("[GHL Webhook] No token — cannot look up conversation for workflow trigger");
        break;
      }

      const cfg = location.automationConfig;
      const automationOn = location.automationEnabled !== false && (!cfg || cfg.enabled !== false);

      if (!automationOn) {
        console.log("[GHL Webhook] Automation disabled — skipping workflow email lookup");
        break;
      }

      if (!contactId) {
        console.log("[GHL Webhook] No contactId — cannot look up conversation");
        break;
      }

      console.log(`[GHL Webhook] Workflow trigger for contact ${contactId} — looking up latest conversation`);

      const conv = await findLatestConversationForContact(contactId, ghlLocationId, token);

      if (!conv || !conv.body) {
        console.log(`[GHL Webhook] No inbound message found for contact ${contactId} — skipping AI`);
        break;
      }

      console.log(`[GHL Webhook] Found message in conv ${conv.conversationId}: "${conv.body.slice(0, 80)}"`);

      // Deduplicate: skip if we already processed this conversation very recently (< 60s)
      const recentEvent = await prisma.webhookEvent.findFirst({
        where: {
          ghlLocationId,
          contactId,
          conversationId: conv.conversationId,
          processed:      true,
          createdAt:      { gte: new Date(Date.now() - 60_000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recentEvent) {
        console.log(`[GHL Webhook] Duplicate — already processed conv ${conv.conversationId} within 60s, skipping`);
        break;
      }

      // DND / ai_disabled check
      let aiEnabled = true;
      try {
        const contactRes = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
          headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
        });
        if (contactRes.ok) {
          const cd      = await contactRes.json();
          const contact = cd.contact || cd;
          const tags: string[] = (contact.tags || []).map((t: string) => t.toLowerCase());
          if (contact.dnd)                                                      aiEnabled = false;
          if (tags.includes("ai_disabled") || tags.includes("do_not_contact")) aiEnabled = false;
        }
      } catch (e) {
        console.warn("[GHL Webhook] Contact DND check failed:", e);
      }

      if (!aiEnabled) { console.log(`[GHL Webhook] AI disabled for ${contactId}`); break; }

      // Channel check
      const msgType = conv.messageType || "EMAIL";
      if (cfg && msgType === "EMAIL" && cfg.emailEnabled === false) { console.log("[GHL Webhook] Email channel disabled"); break; }
      if (cfg && msgType === "SMS"   && cfg.smsEnabled   === false) { console.log("[GHL Webhook] SMS channel disabled");   break; }

      // Quota check
      const sub = location.user.subscription;
      if (sub) {
        if (sub.status === "trialing" && sub.trialMessagesUsed >= sub.trialMessagesLimit) {
          console.log("[GHL Webhook] Trial quota exhausted"); break;
        }
        if (sub.status === "active" && sub.messagesUsedThisPeriod >= sub.monthlyMessageLimit) {
          console.log("[GHL Webhook] Monthly limit reached"); break;
        }
        if (!["trialing", "active"].includes(sub.status)) {
          console.log("[GHL Webhook] Subscription inactive:", sub.status); break;
        }
      }

      // Update conversation cache
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: conv.conversationId },
        update: { lastMessageAt: new Date(), status: "active", contactName, contactEmail, contactPhone },
        create: {
          userId, locationId: location.id,
          ghlConversationId: conv.conversationId,
          contactId, contactName, contactEmail, contactPhone,
          lastMessageAt: new Date(), status: "active",
        },
      }).catch(() => {});

      const event = await prisma.webhookEvent.create({
        data: {
          ghlLocationId,
          locationId:     location.id,
          contactId,
          conversationId: conv.conversationId,
          messageBody:    conv.body,
          messageType:    msgType,
          source:         `WorkflowWebhook:${type}`,
        },
      });

      console.log(`[GHL Webhook] Firing AI for workflow event ${event.id}`);

      fetch(`${appUrl}/api/ai/process`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId:        event.id,
          userId,
          locationId:     location.id,
          ghlLocationId,
          contactId,
          conversationId: conv.conversationId,
          message:        conv.body,
          type:           msgType === "EMAIL" ? "Email" : "SMS",
        }),
      }).catch(e => console.error("[GHL Webhook] AI process fire error:", e));

      break;
    }

    // ── Conversation events ───────────────────────────────────────
    case "ConversationCreate":
    case "ConversationUpdate": {
      const { id: conversationId, contactId } = body as { id: string; contactId: string };
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: conversationId },
        update: { lastMessageAt: new Date() },
        create: {
          userId, locationId: location.id,
          ghlConversationId: conversationId,
          contactId, lastMessageAt: new Date(), status: "active",
        },
      }).catch(() => {});
      break;
    }

    // ── Outbound message ──────────────────────────────────────────
    case "OutboundMessage": {
      const { contactId, conversationId } = body as { contactId: string; conversationId: string };
      if (conversationId) {
        await prisma.conversationCache.upsert({
          where:  { ghlConversationId: conversationId },
          update: { lastMessageAt: new Date() },
          create: {
            userId, locationId: location.id,
            ghlConversationId: conversationId,
            contactId, lastMessageAt: new Date(), status: "active",
          },
        }).catch(() => {});
      }
      break;
    }

    default: {
      console.log(`[GHL Webhook] Unhandled event type: "${type}" — payload logged above`);
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── handleInboundMessage ─────────────────────────────────────────
// Extracted so ContactCreate/Update can also call the same AI pipeline.

async function handleInboundMessage(
  body:          Record<string, unknown>,
  location:      { id: string; userId: string; ghlLocationId: string; automationEnabled: boolean | null; automationConfig: { enabled: boolean; smsEnabled: boolean; emailEnabled: boolean } | null; user: { subscription: { status: string; trialMessagesUsed: number; trialMessagesLimit: number; messagesUsedThisPeriod: number; monthlyMessageLimit: number } | null } },
  userId:        string,
  ghlLocationId: string,
  appUrl:        string,
  token:         string,
) {
  const contactId      = String(body.contactId      || body.contact_id      || "");
  const conversationId = String(body.conversationId || body.conversation_id || "");
  const emailMessageId = String(body.id || body.messageId || body.message_id || body.emailId || "");

  const rawMsgType  = String(body.messageType || body.message_type || body.channel || body.type || "SMS");
  const messageType = normaliseMessageType(rawMsgType);

  const direction = String(body.direction || body.messageDirection || "inbound").toLowerCase();
  if (direction === "outbound") { console.log("[GHL Webhook] Skipping outbound"); return; }

  const SKIP_TYPES = ["CALL", "VOICEMAIL", "ACTIVITY", "ACTIVITY_CONTACT"];
  if (SKIP_TYPES.includes(messageType)) return;

  if (!contactId || !conversationId) {
    console.log("[GHL Webhook] Missing contactId or conversationId:", { contactId, conversationId });
    return;
  }

  let messageBody = String(body.body || body.message || body.messageBody || body.text || "").trim();
  if (messageBody.startsWith("<")) messageBody = htmlToText(messageBody);

  const isEmail = messageType === "EMAIL";

  if (isEmail && !messageBody) {
    if (!token) { console.error("[GHL Webhook] No token — cannot fetch email body"); return; }

    if (emailMessageId) {
      messageBody = await fetchEmailBody(emailMessageId, token);
      if (messageBody) console.log(`[GHL Webhook] Email body fetched (${messageBody.length} chars)`);
    }

    if (!messageBody && conversationId) {
      const result = await fetchLatestInboundFromConversation(conversationId, token);
      messageBody = result.body;
      if (messageBody) console.log(`[GHL Webhook] Conv fallback succeeded (${messageBody.length} chars)`);
    }
  }

  if (!messageBody) { console.log("[GHL Webhook] No message body — skipping AI"); return; }

  console.log(`[GHL Webhook] ${messageType} from ${contactId}: "${messageBody.slice(0, 100)}"`);

  await prisma.conversationCache.upsert({
    where:  { ghlConversationId: conversationId },
    update: { lastMessageAt: new Date(), status: "active" },
    create: {
      userId, locationId: location.id,
      ghlConversationId: conversationId,
      contactId, lastMessageAt: new Date(), status: "active",
    },
  }).catch(() => {});

  // DND check
  let aiEnabled = true;
  if (token) {
    try {
      const contactRes = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
        headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
      });
      if (contactRes.ok) {
        const cd      = await contactRes.json();
        const contact = cd.contact || cd;
        const tags: string[] = (contact.tags || []).map((t: string) => t.toLowerCase());
        if (contact.dnd)                                                      aiEnabled = false;
        if (tags.includes("ai_disabled") || tags.includes("do_not_contact")) aiEnabled = false;
      }
    } catch (e) { console.warn("[GHL Webhook] Contact check failed:", e); }
  }
  if (!aiEnabled) { console.log(`[GHL Webhook] AI disabled for ${contactId}`); return; }

  const cfg = location.automationConfig;
  if (location.automationEnabled === false) { console.log("[GHL Webhook] Automation disabled"); return; }
  if (cfg && !cfg.enabled)                  { console.log("[GHL Webhook] Automation config disabled"); return; }
  if (cfg && messageType === "SMS"   && cfg.smsEnabled   === false) { console.log("[GHL Webhook] SMS disabled");   return; }
  if (cfg && messageType === "EMAIL" && cfg.emailEnabled === false) { console.log("[GHL Webhook] Email disabled"); return; }

  const sub = location.user.subscription;
  if (sub) {
    if (sub.status === "trialing" && sub.trialMessagesUsed >= sub.trialMessagesLimit) { console.log("[GHL Webhook] Trial exhausted"); return; }
    if (sub.status === "active"   && sub.messagesUsedThisPeriod >= sub.monthlyMessageLimit) { console.log("[GHL Webhook] Monthly limit"); return; }
    if (!["trialing", "active"].includes(sub.status)) { console.log("[GHL Webhook] Inactive sub:", sub.status); return; }
  }

  const event = await prisma.webhookEvent.create({
    data: {
      ghlLocationId, locationId: location.id,
      contactId, conversationId, messageBody, messageType,
      source: "InboundMessage",
    },
  });

  console.log(`[GHL Webhook] Firing AI for event ${event.id}`);

  fetch(`${appUrl}/api/ai/process`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: event.id, userId, locationId: location.id,
      ghlLocationId, contactId, conversationId,
      message: messageBody,
      type:    isEmail ? "Email" : "SMS",
    }),
  }).catch(e => console.error("[GHL Webhook] AI fire error:", e));
}