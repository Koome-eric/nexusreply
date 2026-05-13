/**
 * app/api/ghl/webhook-settings/route.ts
 * GET  — return current webhook registration status for a location
 * POST — register (or re-register) the webhook in GHL
 * DELETE — remove the webhook from GHL
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth-options";
import { prisma }                    from "@/lib/db";
import { getValidTokenForLocation }  from "@/lib/token-manager";
import { resolveLocationAccess }     from "@/lib/client-access";

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

const WEBHOOK_EVENTS = [
  "InboundMessage",
  "ContactCreate",
  "ContactUpdate",
  "ConversationCreate",
  "ConversationUpdate",
];

function getAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
  return raw.startsWith("http") ? raw.replace(/\/$/, "") : raw ? `https://${raw}` : "https://nexusreply.vercel.app";
}

export async function GET(req: NextRequest) {
  const locationId = new URL(req.url).searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = await prisma.location.findFirst({
    where:   { id: locationId, userId: access.ownerId },
    include: { ghlConnection: true, webhookReg: true },
  });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const appUrl     = getAppUrl();
  const webhookUrl = `${appUrl}/api/ghl/webhook`;
  const reg        = location.webhookReg;

  // Check live GHL status if we have a registered webhook ID
  let ghlVerified = false;
  let ghlEvents: string[] = [];
  if (reg?.ghlWebhookId && location.ghlConnection?.accessToken) {
    try {
      const res = await fetch(
        `${GHL_BASE}/webhooks/${reg.ghlWebhookId}?locationId=${location.ghlLocationId}`,
        { headers: { Authorization: `Bearer ${location.ghlConnection.accessToken}`, Version: GHL_VERSION } }
      );
      if (res.ok) {
        const data = await res.json();
        const w    = data.webhook || data;
        ghlVerified = !!w.id;
        ghlEvents   = w.events || [];
      }
    } catch { /* live check is best-effort */ }
  }

  return NextResponse.json({
    registered:  !!reg?.isActive,
    ghlVerified,
    ghlWebhookId: reg?.ghlWebhookId || null,
    url:          reg?.url || webhookUrl,
    expectedUrl:  webhookUrl,
    events:       reg?.events || [],
    ghlEvents,
    lastError:    reg?.lastError || null,
    registeredAt: reg?.registeredAt || null,
  });
}

export async function POST(req: NextRequest) {
  const { locationId } = await req.json();
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = await prisma.location.findFirst({
    where:   { id: locationId, userId: access.ownerId },
    include: { ghlConnection: true },
  });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = location.ghlConnection?.accessToken;
  if (!token) return NextResponse.json({ error: "No GHL token — reconnect the location first" }, { status: 400 });

  const appUrl     = getAppUrl();
  const webhookUrl = `${appUrl}/api/ghl/webhook`;

  // Remove any existing webhook first (prevent duplicates)
  const existing = await prisma.webhookRegistration.findUnique({ where: { locationId } });
  if (existing?.ghlWebhookId) {
    await fetch(`${GHL_BASE}/webhooks/${existing.ghlWebhookId}?locationId=${location.ghlLocationId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
    }).catch(() => {});
  }

  // Register fresh webhook in GHL
  const res = await fetch(`${GHL_BASE}/webhooks/`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({
      locationId: location.ghlLocationId,
      url:        webhookUrl,
      name:       "NexusReply AI",
      events:     WEBHOOK_EVENTS,
    }),
  });

  const body = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(body); } catch { /* non-JSON */ }

  if (!res.ok) {
    const errMsg = (data.message as string) || body.slice(0, 200);
    await prisma.webhookRegistration.upsert({
      where:  { locationId },
      update: { isActive: false, lastError: errMsg, url: webhookUrl, events: WEBHOOK_EVENTS },
      create: { locationId, url: webhookUrl, events: WEBHOOK_EVENTS, isActive: false, lastError: errMsg },
    });
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }

  const webhook    = (data.webhook as Record<string,unknown>) || data;
  const webhookId  = String(webhook.id || "");

  await prisma.webhookRegistration.upsert({
    where:  { locationId },
    update: { ghlWebhookId: webhookId, isActive: true, lastError: null, url: webhookUrl, events: WEBHOOK_EVENTS, updatedAt: new Date() },
    create: { locationId, ghlWebhookId: webhookId, url: webhookUrl, events: WEBHOOK_EVENTS, isActive: true },
  });

  return NextResponse.json({ ok: true, webhookId, url: webhookUrl, events: WEBHOOK_EVENTS });
}

export async function DELETE(req: NextRequest) {
  const { locationId } = await req.json();
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = await prisma.location.findFirst({
    where:   { id: locationId, userId: access.ownerId },
    include: { ghlConnection: true, webhookReg: true },
  });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reg   = location.webhookReg;
  const token = location.ghlConnection?.accessToken;

  if (reg?.ghlWebhookId && token) {
    await fetch(`${GHL_BASE}/webhooks/${reg.ghlWebhookId}?locationId=${location.ghlLocationId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
    }).catch(() => {});
  }

  await prisma.webhookRegistration.updateMany({
    where: { locationId },
    data:  { isActive: false, ghlWebhookId: null },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
