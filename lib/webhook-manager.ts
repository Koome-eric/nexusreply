import { prisma } from "./db";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

const WEBHOOK_EVENTS = [
  "InboundMessage",
  "ContactCreate",
  "ContactUpdate",
  "ConversationCreate",
];

export async function autoRegisterWebhook(
  locationId: string,   // internal DB id
  ghlLocationId: string,
  accessToken: string
): Promise<{ success: boolean; webhookId?: string; error?: string }> {
  // Always resolve to a real HTTPS URL — NEXT_PUBLIC_APP_URL may be localhost
  const _rawUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const appUrl = (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost"))
    ? `https://${process.env.VERCEL_URL}`
    : (_rawUrl && !_rawUrl.includes("localhost") && !_rawUrl.includes("127.0.0.1"))
      ? _rawUrl.replace(/\/$/, "")
      : "https://nexusreply.vercel.app";
  const webhookUrl = `${appUrl}/api/ghl/webhook`;

  try {
    // Check if already registered
    const existing = await prisma.webhookRegistration.findUnique({
      where: { locationId },
    });
    if (existing?.isActive) {
      return { success: true, webhookId: existing.ghlWebhookId || undefined };
    }

    // Create webhook in GHL
    const res = await fetch(`${GHL_BASE}/webhooks/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locationId: ghlLocationId,   // ← THE FIX — was missing in original
        url:        webhookUrl,
        events:     WEBHOOK_EVENTS,
        name:       "NexusReply AI Webhook",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[WebhookManager] GHL webhook creation failed:", errText);

      // Save failed registration so we can show fallback UI
      await prisma.webhookRegistration.upsert({
        where: { locationId },
        update: { isActive: false, lastError: errText, url: webhookUrl, events: WEBHOOK_EVENTS },
        create: { locationId, url: webhookUrl, events: WEBHOOK_EVENTS, isActive: false, lastError: errText },
      });

      return { success: false, error: errText };
    }

    const data = await res.json();
    const ghlWebhookId = data.webhook?.id || data.id;

    // Save registration
    await prisma.webhookRegistration.upsert({
      where: { locationId },
      update: { ghlWebhookId, isActive: true, lastError: null, url: webhookUrl, events: WEBHOOK_EVENTS },
      create: { locationId, ghlWebhookId, url: webhookUrl, events: WEBHOOK_EVENTS, isActive: true },
    });

    console.log("[WebhookManager] Webhook registered:", ghlWebhookId);
    return { success: true, webhookId: ghlWebhookId };
  } catch (err) {
    console.error("[WebhookManager] Error:", err);
    return { success: false, error: String(err) };
  }
}

export async function checkWebhookStatus(locationId: string) {
  return prisma.webhookRegistration.findUnique({ where: { locationId } });
}