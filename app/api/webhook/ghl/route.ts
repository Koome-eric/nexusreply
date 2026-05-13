/**
 * app/api/webhook/ghl/route.ts
 *
 * LEGACY REDIRECT — some GHL accounts may have this URL registered.
 * Forwards all POST requests to the canonical webhook handler at /api/ghl/webhook.
 * This ensures both URLs work regardless of which one is registered in GHL.
 */
import { NextRequest } from "next/server";

export const runtime     = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const rawUrl   = process.env.NEXT_PUBLIC_APP_URL || "";
  const appUrl   = (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost"))
    ? `https://${process.env.VERCEL_URL}`
    : (rawUrl && !rawUrl.includes("localhost")) ? rawUrl : "https://nexusreply.vercel.app";

  const body = await req.text();

  // Forward to the real webhook handler
  const res = await fetch(`${appUrl}/api/ghl/webhook`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = await res.json().catch(() => ({ ok: true }));
  return Response.json(data, { status: res.status });
}
