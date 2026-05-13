import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Route user to their correct panel's locations page after OAuth
const LOCATIONS_PAGE: Record<string, string> = {
  admin:  "/admin",
  agency: "/agency/locations",
  user:   "/dashboard/locations",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  const session  = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  const userId = u?.id;
  const role   = u?.role ?? "user";
  const locationsPage = LOCATIONS_PAGE[role] ?? "/dashboard/locations";

  if (!userId) return NextResponse.redirect(new URL("/login?error=not_logged_in", req.url));
  if (error || !code) {
    return NextResponse.redirect(new URL(`${locationsPage}?error=${error || "no_code"}`, req.url));
  }

  try {
    const tokenRes = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.GHL_CLIENT_ID!,
        client_secret: process.env.GHL_CLIENT_SECRET!,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env.GHL_REDIRECT_URI!,
      }),
    });
    if (!tokenRes.ok) throw new Error("Token exchange failed");

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in, locationId, userId: ghlUserId, companyId } = tokens;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Check location limit
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const locationCount = await prisma.location.count({ where: { userId } });
    if (sub && locationCount >= sub.locationLimit) {
      return NextResponse.redirect(new URL(`${locationsPage}?error=location_limit`, req.url));
    }

    const conn = await prisma.gHLConnection.create({
      data: { userId, ghlUserId, ghlCompanyId: companyId, accessToken: access_token, refreshToken: refresh_token, tokenExpiresAt },
    });

    let locationName = "My Location";
    try {
      const locRes = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
        headers: { Authorization: `Bearer ${access_token}`, Version: "2021-07-28" },
      });
      if (locRes.ok) {
        const locData = await locRes.json();
        locationName = locData.location?.name || locData.name || locationName;
      }
    } catch { /* default name */ }

    await prisma.location.upsert({
      where:  { ghlLocationId: locationId },
      update: { userId, ghlConnectionId: conn.id, name: locationName, isActive: true },
      create: { userId, ghlConnectionId: conn.id, ghlLocationId: locationId, name: locationName },
    });

    return NextResponse.redirect(new URL(`${locationsPage}?connected=true`, req.url));
  } catch (err) {
    console.error("OAuth error:", err);
    return NextResponse.redirect(new URL(`${locationsPage}?error=oauth_failed`, req.url));
  }
}
