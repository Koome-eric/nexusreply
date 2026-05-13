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

/** Strip HTML tags + decode entities → plain text for AI */
function htmlToText(html: string): string {
  return html
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

/**
 * fetchEmailBody
 *
 * GHL email webhooks fire with body = "" — the real body lives in the
 * email record fetched via:
 *   GET /conversations/messages/email/:id
 *
 * CRITICAL ID FIELD:
 *   The webhook payload's TOP-LEVEL `id` field is the email message ID.
 *   Do NOT use `messageId` or `threadId` — those are different objects.
 *   GHL docs confirm the path is /conversations/messages/email/{id}
 *   where {id} is the message's own ID.
 */
async function fetchEmailBody(emailId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `${GHL_BASE}/conversations/messages/email/${emailId}`,
      { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
    );
    if (!res.ok) {
      console.warn(`[Webhook] getEmailById ${emailId} → HTTP ${res.status}: ${await res.text()}`);
      return "";
    }
    const data = await res.json();
    const raw  = String(data?.body || "").trim();
    // GHL can return HTML body — strip it so AI receives clean text
    return raw.startsWith("<") ? htmlToText(raw) : raw;
  } catch (err) {
    console.warn("[Webhook] fetchEmailBody error:", err);
    return "";
  }
}

/**
 * fetchLatestInboundFromConversation
 *
 * Last-resort fallback: pull conversation messages and return the most
 * recent inbound body. Fires when both webhook body AND getEmailById
 * return empty (network hiccup, delayed GHL indexing, etc.).
 */
async function fetchLatestInboundFromConversation(
  conversationId: string,
  token:          string
): Promise<string> {
  try {
    const res = await fetch(
      `${GHL_BASE}/conversations/${conversationId}/messages?limit=10`,
      { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
    );
    if (!res.ok) return "";
    const data = await res.json();

    // GHL nests:  data.messages.messages  OR  data.messages
    const msgs: Record<string, unknown>[] =
      (data?.messages?.messages ?? data?.messages ?? []) as Record<string, unknown>[];

    const found = [...msgs]
      .reverse()
      .find(m => m.direction === "inbound" && m.body);

    const raw = String(found?.body || "").trim();
    return raw.startsWith("<") ? htmlToText(raw) : raw;
  } catch (err) {
    console.warn("[Webhook] fetchLatestInboundFromConversation error:", err);
    return "";
  }
}

// ─── Main handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: true }); }

  // Log every payload so you can debug real GHL events
  console.log("[GHL Webhook] RAW PAYLOAD:", JSON.stringify(body, null, 2));

  const type           = String(body.type           || "");
  const ghlLocationId  = String(body.locationId     || "");

  if (!type || !ghlLocationId) return NextResponse.json({ ok: true });

  // Lookup location + user subscription in one query
  const location = await prisma.location.findUnique({
    where:   { ghlLocationId },
    include: { user: { include: { subscription: true } }, automationConfig: true },
  });

  if (!location) {
    console.log("[GHL Webhook] Location not found:", ghlLocationId);
    return NextResponse.json({ ok: true });
  }

  const userId = location.userId;
  // Resolve production URL — NEXT_PUBLIC_APP_URL may be localhost in dev
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const appUrl = (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost"))
    ? `https://${process.env.VERCEL_URL}`
    : (rawUrl && !rawUrl.includes("localhost") && !rawUrl.includes("127.0.0.1"))
      ? rawUrl
      : "https://nexusreply.vercel.app";

  // Always get a fresh, valid token (auto-refreshes if < 5 min to expiry)
  const tokenData = await getValidTokenForLocation(ghlLocationId);
  const token     = tokenData?.token || "";

  switch (type) {

    // ── Inbound message from lead (SMS, Email, FB, IG, WhatsApp…) ──
    case "InboundMessage":
    case "IncomingMessage":
    case "MessageCreate":
    case "MessageReceived":
    case "ConversationMessage": {

      const contactId      = String(body.contactId      || "");
      const conversationId = String(body.conversationId || "");

      // ────────────────────────────────────────────────────────────
      // CORRECT EMAIL ID:
      //   The top-level `id` field in the GHL webhook payload is the
      //   email message ID used by GET /conversations/messages/email/:id
      //   This is confirmed by GHL API docs. Do NOT use `messageId` or
      //   `threadId` — those refer to different resources.
      // ────────────────────────────────────────────────────────────
      const emailMessageId = String(body.id || "");

      // Normalise messageType — GHL sometimes sends "TYPE_EMAIL"
      const rawType    = String(body.messageType || body.type || "SMS").toUpperCase();
      const messageType = rawType === "TYPE_EMAIL" ? "EMAIL" : rawType;

      const direction = String(body.direction || "").toLowerCase();

      // Only process inbound (lead → us); skip outbound echoes
      if (direction === "outbound") break;

      // Skip non-text event types
      const SKIP_TYPES = ["CALL", "VOICEMAIL", "ACTIVITY", "ACTIVITY_CONTACT"];
      if (SKIP_TYPES.includes(messageType)) break;

      if (!contactId || !conversationId) {
        console.log("[GHL Webhook] Missing contactId or conversationId");
        break;
      }

      // ── Extract body (SMS arrives with body; Email almost always empty) ──
      let messageBody = String(
        body.body || body.message || body.messageBody || ""
      ).trim();

      // Strip HTML if GHL sent it inline
      if (messageBody.startsWith("<")) messageBody = htmlToText(messageBody);

      // ── EMAIL: body is empty → must fetch from GHL email endpoint ──
      if (messageType === "EMAIL" && !messageBody) {

        if (!token) {
          console.error("[GHL Webhook] No access token — cannot fetch email body. Check GHL connection.");
          break;
        }

        if (emailMessageId) {
          console.log(`[GHL Webhook] Email body empty. Fetching via message ID: ${emailMessageId}`);
          messageBody = await fetchEmailBody(emailMessageId, token);

          if (messageBody) {
            console.log(`[GHL Webhook] ✅ Email body fetched (${messageBody.length} chars)`);
          } else {
            console.warn("[GHL Webhook] getEmailById returned empty body");
          }
        } else {
          console.warn("[GHL Webhook] No `id` field in email webhook payload");
        }

        // ── FALLBACK: pull from conversation messages ──
        if (!messageBody && conversationId) {
          console.log("[GHL Webhook] Fallback: fetching latest inbound from conversation messages");
          messageBody = await fetchLatestInboundFromConversation(conversationId, token);

          if (messageBody) {
            console.log(`[GHL Webhook] ✅ Conversation fallback succeeded (${messageBody.length} chars)`);
          }
        }
      }

      if (!messageBody) {
        console.log("[GHL Webhook] No message body after all attempts — skipping AI");
        break;
      }

      console.log(`[GHL Webhook] ✅ ${messageType} from ${contactId}: "${messageBody.slice(0, 100)}"`);

      // ── Update conversation cache ─────────────────────────────
      await prisma.conversationCache.upsert({
        where:  { ghlConversationId: conversationId },
        update: { lastMessageAt: new Date(), status: "active" },
        create: {
          userId,
          locationId:        location.id,
          ghlConversationId: conversationId,
          contactId,
          lastMessageAt:     new Date(),
          status:            "active",
        },
      }).catch(() => {});

      // ── DND / ai_disabled tag check ───────────────────────────
      let aiEnabled = true;
      if (token) {
        try {
          const contactRes = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
            headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
          });
          if (contactRes.ok) {
            const contactData = await contactRes.json();
            const contact     = contactData.contact || contactData;
            const tags: string[] = (contact.tags || []).map((t: string) => t.toLowerCase());
            if (contact.dnd)                                                      aiEnabled = false;
            if (tags.includes("ai_disabled") || tags.includes("do_not_contact")) aiEnabled = false;
          }
        } catch (e) {
          console.warn("[GHL Webhook] Contact check failed:", e);
        }
      }

      if (!aiEnabled) { console.log(`[GHL Webhook] AI disabled for ${contactId}`); break; }

      // ── Automation enabled? ───────────────────────────────────
      // automationConfig may not exist yet (freshly connected location) — default to ALLOW
      const cfg = location.automationConfig;
      if (location.automationEnabled === false) {
        console.log("[GHL Webhook] Automation disabled (location.automationEnabled=false)"); break;
      }
      if (cfg && !cfg.enabled) {
        console.log("[GHL Webhook] Automation disabled (automationConfig.enabled=false)"); break;
      }
      // Only block specific channels if config explicitly disables them
      if (cfg && messageType === "SMS"   && cfg.smsEnabled   === false) { console.log("[GHL Webhook] SMS channel disabled");   break; }
      if (cfg && messageType === "EMAIL" && cfg.emailEnabled  === false) { console.log("[GHL Webhook] Email channel disabled");  break; }

      // ── Quota check ───────────────────────────────────────────
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
      // No subscription = allow (dev/onboarding mode)

      // ── Save webhook event ────────────────────────────────────
      const event = await prisma.webhookEvent.create({
        data: {
          ghlLocationId,
          locationId:     location.id,
          contactId,
          conversationId,
          messageBody,
          messageType,
          source:         String(type),
        },
      });

      console.log(`[GHL Webhook] Firing AI for event ${event.id}`);

      // ── Fire AI (non-blocking) ────────────────────────────────
      fetch(`${appUrl}/api/ai/process`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId:        event.id,
          userId,
          locationId:     location.id,
          ghlLocationId,
          contactId,
          conversationId,
          message:        messageBody,
          type:           messageType === "EMAIL" ? "Email" : "SMS",
        }),
      }).catch(e => console.error("[GHL Webhook] AI process fire error:", e));

      break;
    }

    // ── New contact created ───────────────────────────────────────
    case "ContactCreate": {
      const { id: contactId, firstName, lastName, name, email, phone } = body as {
        id: string; firstName?: string; lastName?: string; name?: string; email?: string; phone?: string;
      };
      const contactName = firstName ? `${firstName} ${lastName || ""}`.trim() : name || "New Contact";
      await getOrCreateLead(userId, location.id, contactId, { name: contactName, email, phone });
      await notifyNewLead(userId, contactName, email ? "Email" : "SMS").catch(() => {});
      break;
    }

    // ── Contact updated ───────────────────────────────────────────
    case "ContactUpdate": {
      const { id: contactId, firstName, lastName, name, email, phone } = body as {
        id: string; firstName?: string; lastName?: string; name?: string; email?: string; phone?: string;
      };
      const contactName = firstName ? `${firstName} ${lastName || ""}`.trim() : name || undefined;
      await prisma.leadPipeline.updateMany({
        where: { locationId: location.id, contactId },
        data: {
          ...(contactName && { contactName }),
          ...(email && { contactEmail: email }),
          ...(phone && { contactPhone: phone }),
        },
      }).catch(() => {});
      await prisma.conversationCache.updateMany({
        where: { locationId: location.id, contactId },
        data: {
          ...(contactName && { contactName }),
          ...(email && { contactEmail: email }),
          ...(phone && { contactPhone: phone }),
        },
      }).catch(() => {});
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

    // ── Outbound message sent from GHL UI / workflow ──────────────
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
  }

  return NextResponse.json({ ok: true });
}
