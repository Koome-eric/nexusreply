/**
 * app/api/ghl/webhook-setup/route.ts
 *
 * GET  — returns webhook status + the exact URL to paste in GHL manually
 * POST { action: "retry" }       — force-retries auto-registration with GHL
 * POST { action: "mark-active" } — user confirms they manually added it in GHL
 *
 * Works for both "user" (owner) and "client" roles.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth-options";
import { prisma }                    from "@/lib/db";
import { autoRegisterWebhook }       from "@/lib/webhook-manager";
import { getValidTokenForLocation }  from "@/lib/token-manager";

const WEBHOOK_EVENTS = [
  "InboundMessage",
  "ContactCreate",
  "ContactUpdate",
  "ConversationCreate",
];

function buildWebhookUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
  const base = raw.startsWith("http")
    ? raw.replace(/\/$/, "")
    : raw
    ? `https://${raw}`
    : "https://nexusreply.vercel.app";
  return `${base}/api/ghl/webhook`;
}

/** Resolves a location for any role (owner or client-member) */
async function resolveLocation(userId: string, role: string, locationIdHint?: string) {
  if (role === "client") {
    const membership = await prisma.locationMember.findFirst({
      where: { userId, ...(locationIdHint ? { locationId: locationIdHint } : {}) },
      include: { location: { include: { webhookReg: true } } },
    });
    return membership?.location ?? null;
  }
  if (!locationIdHint) return null;
  return prisma.location.findFirst({
    where:   { id: locationIdHint, userId },
    include: { webhookReg: true },
  });
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locationIdHint = req.nextUrl.searchParams.get("locationId") ?? undefined;
  const location = await resolveLocation(user.id, user.role ?? "user", locationIdHint);
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const webhookUrl = buildWebhookUrl();
  const reg        = location.webhookReg;

  return NextResponse.json({
    webhookUrl,
    webhookEvents:  WEBHOOK_EVENTS,
    ghlLocationId:  location.ghlLocationId,
    locationId:     location.id,
    locationName:   location.name,
    registration: reg ? {
      isActive:     reg.isActive,
      ghlWebhookId: reg.ghlWebhookId,
      lastError:    reg.lastError,
      events:       reg.events,
      url:          reg.url,
    } : null,
  });
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body           = await req.json();
  const action         = (body.action as string) ?? "retry";
  const locationIdHint = body.locationId as string | undefined;

  const location = await resolveLocation(user.id, user.role ?? "user", locationIdHint);
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const webhookUrl    = buildWebhookUrl();
  const ghlLocationId = location.ghlLocationId;
  const locationId    = location.id;

  // User confirmed they manually added the webhook in GHL
  if (action === "mark-active") {
    await prisma.webhookRegistration.upsert({
      where:  { locationId },
      update: { isActive: true, lastError: null, url: webhookUrl, events: WEBHOOK_EVENTS },
      create: { locationId, url: webhookUrl, events: WEBHOOK_EVENTS, isActive: true },
    });
    return NextResponse.json({ success: true, webhookUrl, ghlLocationId, manuallyConfirmed: true });
  }

  // Force fresh auto-registration attempt
  if (location.webhookReg?.isActive) {
    await prisma.webhookRegistration.update({ where: { locationId }, data: { isActive: false } });
  }

  const tokenData = await getValidTokenForLocation(ghlLocationId);
  if (!tokenData?.token) {
    return NextResponse.json({
      success: false, webhookUrl, ghlLocationId, manualNeeded: true,
      error: "No valid GHL token — reconnect the location first.",
    });
  }

  const result = await autoRegisterWebhook(locationId, ghlLocationId, tokenData.token);
  return NextResponse.json({
    success: result.success, webhookUrl, ghlLocationId,
    webhookId: result.webhookId, error: result.error, manualNeeded: !result.success,
  });
}