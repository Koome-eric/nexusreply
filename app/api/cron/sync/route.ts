/**
 * app/api/cron/sync/route.ts
 *
 * Vercel Cron Job — runs every 1 minute.
 *
 * PURPOSE:
 *   Catches any inbound messages (especially email replies) that the
 *   GHL webhook failed to deliver or delivered with an empty body.
 *
 * SETUP in vercel.json:
 *   "crons": [{ "path": "/api/cron/sync", "schedule": "* * * * *" }]
 *
 * SECURITY:
 *   Vercel automatically sets the Authorization header with CRON_SECRET
 *   when invoking cron endpoints in production. We validate it here.
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllActiveLocations }    from "@/lib/ghl-sync";

export const runtime     = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel's cron scheduler
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Cron] Unauthorized sync attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const _rawUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const appUrl = (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost"))
    ? `https://${process.env.VERCEL_URL}`
    : (_rawUrl && !_rawUrl.includes("localhost") && !_rawUrl.includes("127.0.0.1"))
      ? _rawUrl
      : "https://nexusreply.vercel.app";

  console.log("[Cron] Starting GHL message sync...");
  await syncAllActiveLocations(appUrl);
  console.log("[Cron] Sync complete");

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
