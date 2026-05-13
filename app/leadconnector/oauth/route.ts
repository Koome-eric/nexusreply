import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { autoRegisterWebhook } from "@/lib/webhook-manager";
import { createOrConnectGHLPipeline } from "@/lib/pipeline-sync";
import { createNotification } from "@/lib/notifications";

const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const GHL_VERSION = "2021-07-28";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nexusreply.vercel.app";

  console.log("[GHL OAuth] Params:", Object.fromEntries(searchParams.entries()));

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/dashboard/locations?error=${error || "no_code"}`);
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/login?error=please_login_first&callbackUrl=/dashboard/locations`);
  }

  try {
    const redirectUri = process.env.GHL_REDIRECT_URI || `${appUrl}/leadconnector/oauth`;

    const tokenRes = await fetch(GHL_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GHL_CLIENT_ID!,
        client_secret: process.env.GHL_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenText = await tokenRes.text();
    console.log("[GHL OAuth] Token status:", tokenRes.status, tokenText.slice(0, 200));

    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenText}`);

    const tokens = JSON.parse(tokenText);
    const { access_token, refresh_token, expires_in, locationId, userId: ghlUserId, companyId } = tokens;

    if (!access_token) throw new Error("No access token received");

    const tokenExpiresAt = new Date(Date.now() + (expires_in || 86400) * 1000);

    // Check location limit
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const locationCount = await prisma.location.count({ where: { userId } });
    if (sub && locationCount >= sub.locationLimit) {
      return NextResponse.redirect(`${appUrl}/dashboard/locations?error=location_limit`);
    }

    // Create GHL connection
    const conn = await prisma.gHLConnection.create({
      data: { userId, ghlUserId: ghlUserId || null, ghlCompanyId: companyId || null, accessToken: access_token, refreshToken: refresh_token || access_token, tokenExpiresAt },
    });

    // Fetch location name
    let locationName = "My GHL Location";
    const ghlLocationId = locationId || companyId;
    if (ghlLocationId) {
      try {
        const locRes = await fetch(`https://services.leadconnectorhq.com/locations/${ghlLocationId}`, {
          headers: { Authorization: `Bearer ${access_token}`, Version: GHL_VERSION },
        });
        if (locRes.ok) {
          const locData = await locRes.json();
          locationName = locData.location?.name || locData.name || locationName;
        }
      } catch { /* use default */ }
    }

    // Upsert location
    const location = await prisma.location.upsert({
      where: { ghlLocationId: ghlLocationId || `conn_${conn.id}` },
      update: { userId, ghlConnectionId: conn.id, name: locationName, isActive: true },
      create: { userId, ghlConnectionId: conn.id, ghlLocationId: ghlLocationId || `conn_${conn.id}`, name: locationName },
    });

    // AUTO: Register webhook (fire and forget — don't block redirect)
    autoRegisterWebhook(location.id, ghlLocationId, access_token).then(result => {
      console.log("[GHL OAuth] Webhook auto-register:", result.success ? "✓" : "✗ " + result.error);
    }).catch(console.error);

    // AUTO: Create/connect GHL pipeline
    createOrConnectGHLPipeline(location.id, ghlLocationId, access_token).then(result => {
      console.log("[GHL OAuth] Pipeline sync:", result.success ? "✓" : "✗ " + result.error);
    }).catch(console.error);

    // Send welcome notification
    createNotification(userId, "webhook_connected", "🔗 Location connected!", 
      `${locationName} is now connected. Your AI will start responding to messages automatically.`,
      { locationName }
    ).catch(console.error);

    return NextResponse.redirect(`${appUrl}/dashboard/locations?connected=true`);
  } catch (err) {
    console.error("[GHL OAuth] Error:", err);
    return NextResponse.redirect(`${appUrl}/dashboard/locations?error=oauth_failed`);
  }
}

export async function POST(req: NextRequest) { return GET(req); }
