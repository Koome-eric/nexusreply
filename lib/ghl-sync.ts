/**
 * lib/ghl-sync.ts  (FIXED)
 *
 * Background sync that catches inbound messages the webhook missed.
 *
 * KEY FIXES vs original:
 *
 *  FIX 1 — Email body fetching:
 *    The original code read `latestInbound.body` directly from the messages
 *    list. GHL ALWAYS returns body="" for email messages in the list endpoint.
 *    This caused every email reply to be silently skipped.
 *    Fix: detect email message type and call
 *    GET /conversations/messages/email/:id to get the real body.
 *
 *  FIX 2 — Stale cutoff raised for emails:
 *    The original 10-min stale cutoff dropped emails that GHL delayed > 10 min
 *    (common with Mailgun / LC Email routing). Raised to 60 min for emails.
 *
 *  FIX 3 — Contact detail enrichment:
 *    searchGHLConversations doesn't include contact details in its response.
 *    After upserting a conversation, we now fetch the contact record and
 *    update name/email/phone so the app doesn't show "Unknown".
 */

import { prisma }                   from "@/lib/db";
import { getValidTokenForLocation } from "@/lib/token-manager";

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function ghlGet(path: string, token: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
  });
  if (!res.ok) throw new Error(`GHL ${path} → ${res.status}`);
  return res.json();
}

// Always returns a real HTTPS URL for internal API calls.
// NEXT_PUBLIC_APP_URL may be localhost in .env — we must override in production.
function resolveAppUrl(hint: string): string {
  // If Vercel deployment URL is available, prefer it (always HTTPS, always correct)
  if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost")) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // If the hint is localhost, fall back to the hardcoded production URL
  if (!hint || hint.includes("localhost") || hint.includes("127.0.0.1")) {
    return "https://nexusreply.vercel.app";
  }
  return hint.startsWith("http") ? hint : `https://${hint}`;
}

// ── FIX 1: fetch the real email body via the dedicated email endpoint ──
async function fetchEmailBodyById(messageId: string, token: string): Promise<string> {
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages/email/${messageId}`, {
      headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
    });
    if (!res.ok) {
      console.warn(`[Sync] fetchEmailBodyById ${messageId} → HTTP ${res.status}`);
      return "";
    }
    const data = await res.json();
    const raw  = String(data?.body || "").trim();
    return raw.startsWith("<") ? htmlToText(raw) : raw;
  } catch (err) {
    console.warn("[Sync] fetchEmailBodyById error:", err);
    return "";
  }
}

// ── FIX 3: fetch contact details to enrich the conversation cache ──
async function fetchContactDetails(
  contactId: string,
  token:     string
): Promise<{ name?: string; email?: string; phone?: string }> {
  try {
    const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
    });
    if (!res.ok) return {};
    const data    = await res.json();
    const contact = data?.contact || data;
    const name    = contact.firstName
      ? `${contact.firstName} ${contact.lastName || ""}`.trim()
      : contact.name || undefined;
    return {
      name:  name  || undefined,
      email: contact.email || undefined,
      phone: contact.phone || undefined,
    };
  } catch {
    return {};
  }
}

export async function syncMessagesForLocation(
  ghlLocationId: string,
  appLocationId: string,
  userId:        string,
  appUrl:        string
): Promise<{ processed: number; skipped: number }> {

  const tokenData = await getValidTokenForLocation(ghlLocationId);
  if (!tokenData) {
    console.warn(`[Sync] No token for location ${ghlLocationId}`);
    return { processed: 0, skipped: 0 };
  }
  const token = tokenData.token;

  const locationRecord = await prisma.location.findUnique({
    where:   { ghlLocationId },
    include: {
      automationConfig: true,
      user: { include: { subscription: true } },
    },
  });

  // Only hard-block if automation is EXPLICITLY disabled — null config = allow
  if (locationRecord?.automationEnabled === false) {
    console.log(`[Sync] Skipping ${ghlLocationId} — automationEnabled=false`);
    return { processed: 0, skipped: 0 };
  }
  if (locationRecord?.automationConfig && !locationRecord.automationConfig.enabled) {
    console.log(`[Sync] Skipping ${ghlLocationId} — automationConfig.enabled=false`);
    return { processed: 0, skipped: 0 };
  }

  // Quota check — only enforce if subscription record exists
  const sub = locationRecord?.user?.subscription;
  if (sub) {
    if (sub.status === "trialing" && sub.trialMessagesUsed >= sub.trialMessagesLimit) {
      console.log(`[Sync] Skipping ${ghlLocationId} — trial quota exhausted`);
      return { processed: 0, skipped: 0 };
    }
    if (sub.status === "active" && sub.messagesUsedThisPeriod >= sub.monthlyMessageLimit) {
      console.log(`[Sync] Skipping ${ghlLocationId} — monthly limit reached`);
      return { processed: 0, skipped: 0 };
    }
    if (!["trialing", "active"].includes(sub.status)) {
      console.log(`[Sync] Skipping ${ghlLocationId} — subscription status: ${sub.status}`);
      return { processed: 0, skipped: 0 };
    }
  }
  // No subscription = allow (dev / onboarding mode)

  let processed = 0;
  let skipped   = 0;

  try {
    const convData = await ghlGet(
      `/conversations/search?locationId=${ghlLocationId}&limit=20&sortBy=lastMessageDate&sortOrder=desc`,
      token
    );
    const conversations: { id: string; contactId: string }[] = convData?.conversations || [];

    for (const conv of conversations) {
      try {
        const msgData = await ghlGet(`/conversations/${conv.id}/messages?limit=5`, token);
        const msgs: Record<string, unknown>[] =
          msgData?.messages?.messages ?? msgData?.messages ?? [];

        // Find the most-recent inbound message (with OR without body — emails have empty body)
        const latestInbound = [...msgs]
          .reverse()
          .find(m => m.direction === "inbound");

        if (!latestInbound) { skipped++; continue; }

        const rawType    = String(latestInbound.messageType || latestInbound.type || "SMS").toUpperCase();
        const messageType = rawType === "TYPE_EMAIL" ? "EMAIL" : rawType;
        const isEmail    = messageType === "EMAIL";
        const dateAdded  = String(latestInbound.dateAdded || "");

        // ── FIX 1: resolve body — never trust m.body for emails ──
        let messageBody = String(latestInbound.body || "").trim();
        if (messageBody.startsWith("<")) messageBody = htmlToText(messageBody);

        if (isEmail && !messageBody) {
          const emailMsgId = String(latestInbound.id || "");
          if (emailMsgId) {
            console.log(`[Sync] Email body empty — fetching via ID: ${emailMsgId}`);
            messageBody = await fetchEmailBodyById(emailMsgId, token);
            if (messageBody) {
              console.log(`[Sync] ✅ Email body resolved (${messageBody.length} chars)`);
            } else {
              console.warn(`[Sync] Email body still empty after endpoint fetch — skipping`);
              skipped++;
              continue;
            }
          } else {
            console.warn(`[Sync] Email message has no ID field — cannot fetch body`);
            skipped++;
            continue;
          }
        }

        if (!messageBody) { skipped++; continue; }

        // ── FIX 2: raise stale cutoff to 60 min for emails ────────
        if (dateAdded) {
          const msgDate   = new Date(dateAdded);
          const cutoffMs  = isEmail ? 60 * 60 * 1000 : 10 * 60 * 1000; // 60 min emails, 10 min SMS
          const cutoffAgo = new Date(Date.now() - cutoffMs);
          if (msgDate < cutoffAgo) { skipped++; continue; }
        }

        // ── Deduplication ─────────────────────────────────────────
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const alreadyProcessed = await prisma.webhookEvent.findFirst({
          where: {
            conversationId: conv.id,
            messageBody,
            createdAt: { gte: fiveMinAgo },
          },
        });
        if (alreadyProcessed) { skipped++; continue; }

        // ── Contact DND / ai_disabled check ──────────────────────
        let aiEnabled = true;
        try {
          const contactRes = await fetch(`${GHL_BASE}/contacts/${conv.contactId}`, {
            headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
          });
          if (contactRes.ok) {
            const contactData = await contactRes.json();
            const contact     = contactData.contact || contactData;
            const tags: string[] = (contact.tags || []).map((t: string) => t.toLowerCase());
            if (contact.dnd)                                                       aiEnabled = false;
            if (tags.includes("ai_disabled") || tags.includes("do_not_contact"))   aiEnabled = false;

            // ── FIX 3: enrich conversation cache with contact details ──
            await prisma.conversationCache.updateMany({
              where: { ghlConversationId: conv.id },
              data: {
                ...(contact.firstName || contact.name
                  ? { contactName: contact.firstName ? `${contact.firstName} ${contact.lastName || ""}`.trim() : contact.name }
                  : {}),
                ...(contact.email ? { contactEmail: contact.email } : {}),
                ...(contact.phone ? { contactPhone: contact.phone } : {}),
              },
            }).catch(() => {});
          }
        } catch { /* allow on check failure */ }

        if (!aiEnabled) { skipped++; continue; }

        // ── Save to WebhookEvent ──────────────────────────────────
        const event = await prisma.webhookEvent.create({
          data: {
            ghlLocationId,
            locationId:     appLocationId,
            contactId:      conv.contactId,
            conversationId: conv.id,
            messageBody,
            messageType,
            source:         "sync",
          },
        });

        console.log(`[Sync] ✅ Found missed ${messageType} for contact ${conv.contactId}: "${messageBody.slice(0, 80)}"`);

        // ── Fire AI pipeline ──────────────────────────────────────
        const resolvedUrl = resolveAppUrl(appUrl);
        await fetch(`${resolvedUrl}/api/ai/process`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId:        event.id,
            userId,
            locationId:     appLocationId,
            ghlLocationId,
            contactId:      conv.contactId,
            conversationId: conv.id,
            message:        messageBody,
            type:           isEmail ? "Email" : "SMS",
          }),
        }).catch(e => console.error("[Sync] AI fire error:", e));

        processed++;

      } catch (convErr) {
        console.warn(`[Sync] Error processing conversation ${conv.id}:`, convErr);
        skipped++;
      }
    }
  } catch (err) {
    console.error(`[Sync] Error for location ${ghlLocationId}:`, err);
  }

  return { processed, skipped };
}

export async function syncAllActiveLocations(appUrl: string): Promise<void> {
  const locations = await prisma.location.findMany({
    where:  { isActive: true, automationEnabled: true },
    select: { id: true, ghlLocationId: true, userId: true },
  });

  console.log(`[Sync] Running for ${locations.length} active locations`);

  for (const loc of locations) {
    const result = await syncMessagesForLocation(loc.ghlLocationId, loc.id, loc.userId, appUrl);
    if (result.processed > 0) {
      console.log(`[Sync] Location ${loc.ghlLocationId}: ${result.processed} new messages fired`);
    }
  }
}