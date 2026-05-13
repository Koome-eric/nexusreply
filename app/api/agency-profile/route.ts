import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Resolve agency owner id — if caller is a client, return their agencyOwnerId
async function resolveAgencyId(userId: string, role: string): Promise<string | null> {
  if (role === "client") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { agencyOwnerId: true } });
    return user?.agencyOwnerId ?? null;
  }
  if (role === "agency") return userId;
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return NextResponse.json({ profile: null });

  const agencyId = await resolveAgencyId(u.id, u.role || "");
  if (!agencyId) return NextResponse.json({ profile: null });

  const profile = await prisma.agencyProfile.findUnique({ where: { userId: agencyId } });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id || u.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { agencyName, logoUrl, primaryColor, secondaryColor, accentColor, supportEmail, website, phone, address, tagline } = body;

  const profile = await prisma.agencyProfile.upsert({
    where: { userId: u.id },
    update: {
      ...(agencyName !== undefined && { agencyName }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(primaryColor && { primaryColor }),
      ...(secondaryColor && { secondaryColor }),
      ...(accentColor && { accentColor }),
      ...(supportEmail !== undefined && { supportEmail }),
      ...(website !== undefined && { website }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(tagline !== undefined && { tagline }),
    },
    create: {
      userId: u.id,
      agencyName: agencyName || "My Agency",
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || "#14b8a6",
      secondaryColor: secondaryColor || "#0f172a",
      accentColor: accentColor || "#8b5cf6",
      supportEmail: supportEmail || null,
      website: website || null,
      phone: phone || null,
      address: address || null,
      tagline: tagline || null,
    },
  });

  return NextResponse.json({ success: true, profile });
}
