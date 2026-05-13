import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function resolveAgencyId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      agencyOwnerId: true,
    },
  });

  if (user?.role === "client" && user.agencyOwnerId) {
    return user.agencyOwnerId;
  }

  return userId;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const agencyId = await resolveAgencyId(userId);

    const branding = await prisma.agencyProfile.findUnique({
      where: { userId: agencyId },
    });

    return NextResponse.json({ branding });

  } catch (error) {
    console.error("Branding GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch branding" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "client") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const {
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      appName,
      supportEmail,
      website,
      phone,
      address,
      tagline,
    } = await req.json();

    const branding = await prisma.agencyProfile.upsert({
      where: { userId },

      update: {
        ...(logoUrl !== undefined && { logoUrl }),
        ...(primaryColor && { primaryColor }),
        ...(secondaryColor && { secondaryColor }),
        ...(accentColor && { accentColor }),
        ...(appName && { agencyName: appName }),
        ...(supportEmail !== undefined && { supportEmail }),
        ...(website !== undefined && { website }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(tagline !== undefined && { tagline }),
      },

      create: {
        userId,
        agencyName: appName || "NexusReply",
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

    return NextResponse.json({
      success: true,
      branding,
    });

  } catch (error) {
    console.error("Branding POST error:", error);

    return NextResponse.json(
      { error: "Failed to update branding" },
      { status: 500 }
    );
  }
}