/**
 * app/api/ghl/webhook/route.ts
 *
 * Receives ALL incoming GHL webhook events.
 * This URL is pasted into the GHL Workflow "Webhook" action.
 *
 * GHL Workflow Webhook action sends a ContactCreate payload:
 * { type: "ContactCreate", locationId, id (contactId), firstName, lastName, email, phone, ... }
 * There is no conversationId or messageBody — we look those up via the GHL API.
 *
 * IMPORTANT: This endpoint processes messages REGARDLESS of automationEnabled.
 * The automation flag only prevents the AI from REPLYING — we always capture the event.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/db";
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

async function ghlGet(path: string, token: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
  });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
}

/** Fetch real email body — GHL always returns empty body in message lists */
async function fetchEmailBody(emailId: string, token: string): Promise<string> {
  try {
    const { ok, data } = await ghlGet(`/conversations/messages/email/${emailId}`, token);
    if (!ok || !data) return "";
    const record = data?.email || data;
    const raw = String(record?.body || record?.text || record?.html || "").trim();
    return cleanBody(raw);
  } catch { return ""; }
}

/** Fetch latest inbound message from a conversation (with email body resolved) */
async function fetchLatestInboundFromConversation(
  conversationId: string,
  token: string
): Promise<{ body: string; messageId: string; messageType: string }> {
  try {
    const { ok, data } = await ghlGet(`/conversations/${conversationId}/messages?limit=20`, token);
    if (!ok || !data) return { body: "", messageId: "", messageType: "EMAIL" };

    const msgs: Record<string, unknown>[] =
      (data?.messages?.messages ?? data?.messages ?? []) as Record<string, unknown>[];

    // Find latest inbound — prefer email
    const inbound = [...msgs].reverse().filter(m => m.direction === "inbound");
    const emailMsg = inbound.find(m => {
      const mt = String(m.messageType || m.type || "").toUpperCase();
      return mt === "EMAIL" || mt === "TYPE_EMAIL";
    });
    const target = emailMsg || inbound[0];
    if (!target) return { body: "", messageId: "", messageType: "EMAIL" };

    const mt = String(target.messageType || target.type || "EMAIL").toUpperCase();
    const messageType = mt === "TYPE_EMAIL" ? "EMAIL" : (mt === "TYPE_SMS" ? "SMS" : mt);
    const messageId   = String(target.id || "");

    let body = cleanBody(String(target.body || ""));
    if (!body && messageType === "EMAIL" && messageId) {
      body = await fetchEmailBody(messageId, token);
    }
    return { body, messageId, messageType };
  } catch { return { body: "", messageId: "", messageType: "EMAIL" }; }
}

/** Search GHL for a contact's most recent conversation, return it with resolved email body */
async function findLatestConversationForContact(
  contactId:     string,
  ghlLocationId: string,
  token:         string
): Promise<{ conversationId: string; messageType: string; body: string; messageId: string } | null> {
  try {
    const { ok, data } = await ghlGet(
      `/conversations/search?locationId=${ghlLocationId}&contactId=${contactId}&limit=5&sortBy=last_message_date&sortOrder=desc`,
      token
    );
    if (!ok || !data) return null;

    const conversations: Record<string, unknown>[] = (data?.conversations ?? []) as Record<string, unknown>[];
    if (!conversations.length) {
      console.warn(`[Webhook] No conversations for contact ${contactId}`);
      return null;
    }

    for (const conv of conversations) {
      const conversationId = String(conv.id || "");
      if (!conversationId) continue;
      const result = await fetchLatestInboundFromConversation(conversationId, token);
      if (result.body) return { conversationId, ...result };
    }

    // Return first conversation even if no body — better than dropping silently
    const firstId = String(conversations[0]?.id || "");
    if (firstId) {
      console.warn(`[Webhook] No inbound body found for ${contactId} — returning first conv`);
      return { conversationId: firstId, messageType: "EMAIL", body: "", messageId: "" };
    }
    return null;
  } catch (err) {
    console.warn("[Webhook] findLatestConversationForContact error:", err);
    return null;
  }
}

function normaliseType(raw: string): string {
  const u = raw.toUpperCase().trim();
  if (u === "TYPE_EMAIL" || u === "EMAIL") return "EMAIL";
  if (u === "TYPE_SMS"   || u === "SMS")   return "SMS";
  if (u === "TYPE_CALL"  || u === "CALL")  return "CALL";
  return u;
}

function resolveEventType(body: Record<string, unknown>): string {
  const raw = String(body.type || body.event || body.eventType || "").trim();
  const INBOUND = ["InboundMessage","IncomingMessage","MessageCreate","MessageReceived",
    "ConversationMessage","inbound_message","incoming_message","message","inboundmessage"];
  if (INBOUND.some(a => raw.toLowerCase() === a.toLowerCase())) return "InboundMessage";
  // Shape-based inference: has contactId + conversationId + content but no type
  if (!raw
    && (body.contactId || body.contact_id)
    && (body.conversationId || body.conversation_id)
    && (body.body || body.message || body.messageBody || body.id)
  ) return "InboundMessage";
  return raw;
}

function resolveAppUrl(): string {
  if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost"))
    return `https://${process.env.VERCEL_URL}`;
  const raw = process.env.NEXT_PUBLIC_APP_URL || "";
  if (raw && !raw.includes("localhost") && !raw.includes("127.0.0.1")) return raw;
  return "https://nexusreply.vercel.app";
}

// ─── Shared AI pipeline fire ───────────────────────────────────────

async function fireAIPipeline(params: {
  location:      { id: string; userId: string; ghlLocationId: string; automationEnabled: boolean; automationConfig: { enabled: boolean; emailEnabled: boolean; smsEnabled: boolean } | null; user: { subscription: { status: string; trialMessagesUsed: number; trialMessagesLimit: number; messagesUsedThisPeriod: number; monthlyMessageLimit: number } | null } };
  contactId:     string;
  conversationId:string;
  messageBody:   string;
  messageType:   string;
  token:         string;
  source:        string;
  contactName?:  string;
  contactEmail?: string;
  contactPhone?: string;
}) {
  const { location, contactId, conversationId, messageBody, messageType, token, source } = params;
  const { userId } = location;
  const appUrl = resolveAppUrl();

  // Always upsert conversation cache so it shows in conversations page
  await prisma.conversationCache.upsert({
    where:  { ghlConversationId: conversationId },
    update: {
      lastMessageAt: new Date(), status: "active",
      ...(params.contactName  && { contactName:  params.contactName }),
      ...(params.contactEmail && { contactEmail: params.contactEmail }),
      ...(params.contactPhone && { contactPhone: params.contactPhone }),
    },
    create: {
      userId, locationId: location.id,
      ghlConversationId: conversationId,
      contactId,
      contactName:  params.contactName  || null,
      contactEmail: params.contactEmail || null,
      contactPhone: params.contactPhone || null,
      lastMessageAt: new Date(), status: "active",
    },
  }).catch(() => {});

  // Check automation — only blocks AI reply, not capture
  const cfg = location.automationConfig;
  const automationOn =
    location.automationEnabled !== false &&
    (!cfg || cfg.enabled !== false);

  if (!automationOn) {
    console.log("[Webhook] Automation disabled — message captured but AI will not reply");
    // Still save the event so it shows in diagnostics/conversations
    await prisma.webhookEvent.create({
      data: {
        ghlLocationId: location.ghlLocationId,
        locationId:    location.id,
        contactId, conversationId, messageBody, messageType,
        source: `${source}:automation_off`,
        processed: true, processedAt: new Date(),
        error: "automation_disabled",
      },
    }).catch(() => {});
    return;
  }

  // Channel check
  if (cfg && messageType === "EMAIL" && cfg.emailEnabled === false) {
    console.log("[Webhook] Email channel disabled"); return;
  }
  if (cfg && messageType === "SMS" && cfg.smsEnabled === false) {
    console.log("[Webhook] SMS channel disabled"); return;
  }

  // DND check
  let aiEnabled = true;
  try {
    const { ok, data: cd } = await ghlGet(`/contacts/${contactId}`, token);
    if (ok && cd) {
      const contact = cd.contact || cd;
      const tags: string[] = (contact.tags || []).map((t: string) => t.toLowerCase());
      if (contact.dnd) aiEnabled = false;
      if (tags.includes("ai_disabled") || tags.includes("do_not_contact")) aiEnabled = false;

      // Enrich cache with fresh contact data
      const cName = contact.firstName
        ? `${contact.firstName} ${contact.lastName || ""}`.trim()
        : contact.name || null;
      await prisma.conversationCache.updateMany({
        where: { ghlConversationId: conversationId },
        data: {
          ...(cName && { contactName: cName }),
          ...(contact.email && { contactEmail: contact.email }),
          ...(contact.phone && { contactPhone: contact.phone }),
        },
      }).catch(() => {});
    }
  } catch { /* allow on failure */ }

  if (!aiEnabled) { console.log(`[Webhook] AI disabled for ${contactId}`); return; }

  // Quota
  const sub = location.user.subscription;
  if (sub) {
    if (sub.status === "trialing" && sub.trialMessagesUsed >= sub.trialMessagesLimit) {
      console.log("[Webhook] Trial quota exhausted"); return;
    }
    if (sub.status === "active" && sub.messagesUsedThisPeriod >= sub.monthlyMessageLimit) {
      console.log("[Webhook] Monthly limit reached"); return;
    }
    if (!["trialing", "active"].includes(sub.status)) {
      console.log("[Webhook] Subscription inactive:", sub.status); return;
    }
  }

  // Save webhook event
  const event = await prisma.webhookEvent.create({
    data: {
      ghlLocationId: location.ghlLocationId,
      locationId:    location.id,
      contactId, conversationId, messageBody, messageType, source,
    },
  });

  console.log(`[Webhook] Firing AI for event ${event.id} — ${messageType}: "${messageBody.slice(0, 80)}"`);

  // Fire AI (non-blocking)
  fetch(`${appUrl}/api/ai/process`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId:        event.id,
      userId,
      locationId:     location.id,
      ghlLocationId:  location.ghlLocationId,
      contactId, conversationId,
      message:        messageBody,
      type:           messageType === "EMAIL" ? "Email" : "SMS",
    }),
  }).catch(e => console.error("[Webhook] AI fire error:", e));
}

// ─── Main handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: true }); }

  console.log("[GHL Webhook] PAYLOAD:", JSON.stringify(body, null, 2));

  const ghlLocationId = String(
    body.locationId || body.location_id || body.ghlLocationId || ""
  );

  if (!ghlLocationId) {
    console.warn("[GHL Webhook] No locationId — cannot route. Full body:", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  }

  const location = await prisma.location.findUnique({
    where:   { ghlLocationId },
    include: {
      user: { include: { subscription: true } },
      automationConfig: true,
    },
  });

  if (!location) {
    console.warn("[GHL Webhook] Location not found for ghlLocationId:", ghlLocationId);
    return NextResponse.json({ ok: true });
  }

  const tokenData = await getValidTokenForLocation(ghlLocationId);
  const token     = tokenData?.token || "";

  const type = resolveEventType(body);
  console.log(`[GHL Webhook] Resolved event type: "${type}" for location ${ghlLocationId}`);

  // ── ContactCreate / ContactUpdate ─────────────────────────────
  // This is what GHL Workflow "Webhook" action sends when a lead replies.
  if (type === "ContactCreate" || type === "ContactUpdate" || type === "" ) {

    // Extract contact info from the payload (GHL Workflow Webhook sends flat contact fields)
    const contactId    = String(body.id || body.contactId || (body.contact as Record<string,unknown>)?.id || "");
    const firstName    = String(body.firstName || (body.contact as Record<string,unknown>)?.firstName || "");
    const lastName     = String(body.lastName  || (body.contact as Record<string,unknown>)?.lastName  || "");
    const contactEmail = String(body.email     || (body.contact as Record<string,unknown>)?.email     || "");
    const contactPhone = String(body.phone     || (body.contact as Record<string,unknown>)?.phone     || "");
    const contactName  = firstName
      ? `${firstName} ${lastName}`.trim()
      : String(body.name || (body.contact as Record<string,unknown>)?.name || "");

    if (!contactId) {
      console.warn("[GHL Webhook] ContactCreate/Update but no contactId found");
      return NextResponse.json({ ok: true });
    }

    console.log(`[GHL Webhook] WorkflowWebhook contact: ${contactId} (${contactName || "no name"})`);

    // Upsert lead in pipeline so they appear in contacts/conversations
    try {
      const { getOrCreateLead } = await import("@/lib/handoff-engine");
      await getOrCreateLead(location.userId, location.id, contactId, {
        name: contactName, email: contactEmail, phone: contactPhone,
      });
    } catch (e) {
      console.warn("[GHL Webhook] getOrCreateLead failed:", e);
    }

    if (!token) {
      console.error("[GHL Webhook] No GHL token — cannot look up conversation");
      return NextResponse.json({ ok: true });
    }

    // Find their latest conversation with an inbound email
    const conv = await findLatestConversationForContact(contactId, ghlLocationId, token);

    if (!conv) {
      console.warn(`[GHL Webhook] No conversation found for ${contactId}`);
      return NextResponse.json({ ok: true });
    }

    if (!conv.body) {
      console.warn(`[GHL Webhook] Conversation ${conv.conversationId} found but email body empty`);
      // Still save to cache so the conversation appears in the UI
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: conv.conversationId },
        update: { lastMessageAt: new Date(), contactName, contactEmail, contactPhone },
        create: {
          userId: location.userId, locationId: location.id,
          ghlConversationId: conv.conversationId,
          contactId, contactName, contactEmail, contactPhone,
          lastMessageAt: new Date(), status: "active",
        },
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    // Deduplicate: skip if same conversation processed very recently (60s)
    const recentDupe = await prisma.webhookEvent.findFirst({
      where: {
        ghlLocationId,
        contactId,
        conversationId: conv.conversationId,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentDupe) {
      console.log(`[GHL Webhook] Deduped — conv ${conv.conversationId} processed within 60s`);
      return NextResponse.json({ ok: true });
    }

    await fireAIPipeline({
      location,
      contactId,
      conversationId: conv.conversationId,
      messageBody:    conv.body,
      messageType:    conv.messageType || "EMAIL",
      token,
      source:         `WorkflowWebhook:${type || "ContactCreate"}`,
      contactName,
      contactEmail,
      contactPhone,
    });

    return NextResponse.json({ ok: true });
  }

  // ── Native GHL InboundMessage webhook ─────────────────────────
  if (["InboundMessage","IncomingMessage","MessageCreate","MessageReceived","ConversationMessage"].includes(type)) {
    const contactId      = String(body.contactId      || body.contact_id      || "");
    const conversationId = String(body.conversationId || body.conversation_id || "");
    const emailMsgId     = String(body.id || body.messageId || body.message_id || body.emailId || "");

    const rawMsgType  = String(body.messageType || body.message_type || body.channel || body.type || "SMS");
    const messageType = normaliseType(rawMsgType);

    const direction = String(body.direction || body.messageDirection || "inbound").toLowerCase();
    if (direction === "outbound") {
      console.log("[GHL Webhook] Skipping outbound");
      return NextResponse.json({ ok: true });
    }

    if (["CALL","VOICEMAIL","ACTIVITY","ACTIVITY_CONTACT"].includes(messageType)) {
      return NextResponse.json({ ok: true });
    }

    if (!contactId || !conversationId) {
      console.warn("[GHL Webhook] Missing contactId/conversationId:", { contactId, conversationId });
      return NextResponse.json({ ok: true });
    }

    let messageBody = cleanBody(String(body.body || body.message || body.messageBody || body.text || ""));
    const isEmail   = messageType === "EMAIL";

    if (isEmail && !messageBody && token) {
      if (emailMsgId) messageBody = await fetchEmailBody(emailMsgId, token);
      if (!messageBody) {
        const res = await fetchLatestInboundFromConversation(conversationId, token);
        messageBody = res.body;
      }
    }

    if (!messageBody) {
      console.warn("[GHL Webhook] No message body — capturing empty event for diagnostics");
      // Still upsert conversation cache
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: conversationId },
        update: { lastMessageAt: new Date() },
        create: {
          userId: location.userId, locationId: location.id,
          ghlConversationId: conversationId, contactId,
          lastMessageAt: new Date(), status: "active",
        },
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    // Dedup
    const recentDupe = await prisma.webhookEvent.findFirst({
      where: {
        ghlLocationId, contactId, conversationId,
        messageBody,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentDupe) {
      console.log("[GHL Webhook] Deduped inbound message");
      return NextResponse.json({ ok: true });
    }

    await fireAIPipeline({
      location, contactId, conversationId, messageBody, messageType, token,
      source: "InboundMessage",
    });

    return NextResponse.json({ ok: true });
  }

  // ── Conversation events ───────────────────────────────────────
  if (type === "ConversationCreate" || type === "ConversationUpdate") {
    const convId    = String(body.id || "");
    const contactId = String(body.contactId || "");
    if (convId) {
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: convId },
        update: { lastMessageAt: new Date() },
        create: {
          userId: location.userId, locationId: location.id,
          ghlConversationId: convId, contactId,
          lastMessageAt: new Date(), status: "active",
        },
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (type === "OutboundMessage") {
    const convId    = String(body.conversationId || "");
    const contactId = String(body.contactId || "");
    if (convId) {
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: convId },
        update: { lastMessageAt: new Date() },
        create: {
          userId: location.userId, locationId: location.id,
          ghlConversationId: convId, contactId,
          lastMessageAt: new Date(), status: "active",
        },
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  console.log(`[GHL Webhook] Unhandled type: "${type}"`);
  return NextResponse.json({ ok: true });
}