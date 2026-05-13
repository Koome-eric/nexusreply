/**
 * app/api/cron/sync/route.ts
 *
 * Sync endpoint that catches inbound messages the GHL webhook missed.
 *
 * HOW TO TRIGGER (no cron plan required):
 *
 *  1. GHL Workflow trigger (free):
 *     In GHL → Automations, create a workflow that fires every 5 minutes
 *     and calls this URL:  GET {APP_URL}/api/cron/sync?secret=CRON_SECRET
 *
 *  2. From the app (on conversations page load):
 *     The conversations page calls POST /api/cron/sync on every load.
 *     This ensures recent messages are always fetched.
 *
 *  3. Vercel Cron (Pro plan only — optional):
 *     If you upgrade to Vercel Pro, add back to vercel.json:
 *     "crons": [{ "path": "/api/cron/sync", "schedule": "* * * * *" }]
 *
 * SECURITY:
 *   GET requests require ?secret=CRON_SECRET query param.
 *   POST requests require a valid user session (called from the app).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth-options";
import { syncAllActiveLocations, syncMessagesForLocation } from "@/lib/ghl-sync";
import { prisma }                    from "@/lib/db";

export const runtime     = "nodejs";
export const maxDuration = 60;

function resolveAppUrl(): string {
  if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost")) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const raw = process.env.NEXT_PUBLIC_APP_URL || "";
  if (raw && !raw.includes("localhost") && !raw.includes("127.0.0.1")) return raw;
  return "https://nexusreply.vercel.app";
}

// ── GET: called by GHL workflow or Vercel cron ───────────────────
export async function GET(req: NextRequest) {
  const secret     = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  // Accept either secret param OR Vercel's Authorization header
  const authHeader = req.headers.get("authorization");
  const validAuth  = (cronSecret && secret === cronSecret)
    || (cronSecret && authHeader === `Bearer ${cronSecret}`)
    || !cronSecret; // if no secret set, allow (dev mode)

  if (!validAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron/GET] Starting GHL message sync...");
  await syncAllActiveLocations(resolveAppUrl());
  console.log("[Cron/GET] Sync complete");

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}

// ── POST: called by the app itself (session required) ────────────
// The conversations page calls this on load so replies are always fresh.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body       = await req.json().catch(() => ({}));
  const locationId = body.locationId as string | undefined;

  const appUrl = resolveAppUrl();

  // If a specific location is given, sync only that one (faster)
  if (locationId) {
    const loc = await prisma.location.findFirst({
      where: user.role === "client"
        ? { id: locationId, locationMembers: { some: { userId: user.id } } }
        : { id: locationId, userId: user.id },
      select: { id: true, ghlLocationId: true, userId: true },
    });

    if (!loc) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const result = await syncMessagesForLocation(loc.ghlLocationId, loc.id, loc.userId, appUrl);
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  }

  // Otherwise sync all locations for this user
  await syncAllActiveLocations(appUrl);
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
