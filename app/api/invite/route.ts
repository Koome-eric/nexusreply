import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// ✅ Strong type (id is guaranteed)
type AgencyUser = {
  id: string;
  role: string;
};

// Resolve logged-in agency user
async function getAgencyUser(): Promise<AgencyUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;

  if (!u?.id || !u.role || u.role === "client" || u.role === "admin") {
    return null;
  }

  return {
    id: u.id,
    role: u.role,
  };
}

// ─────────────────────────────────────────────
// GET - list all invites
// ─────────────────────────────────────────────
export async function GET() {
  const user = await getAgencyUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await prisma.clientInvite.findMany({
    where: { ownerId: user.id },
    include: {
      location: {
        select: { name: true, ghlLocationId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    invites: invites.map((i) => ({
      id: i.id,
      token: i.token,
      email: i.email,
      locationId: i.locationId,
      locationName: i.location.name,
      expiresAt: i.expiresAt.toISOString(),
      acceptedAt: i.acceptedAt?.toISOString() ?? null,
      acceptedBy: i.acceptedBy,
      createdAt: i.createdAt.toISOString(),
      expired: new Date() > i.expiresAt && !i.acceptedAt,
      link: `${process.env.NEXTAUTH_URL}/invite/${i.token}`,
    })),
  });
}

// ─────────────────────────────────────────────
// POST - create invite
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getAgencyUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locationId, email, expiryDays = 7 } = await req.json();

  if (!locationId) {
    return NextResponse.json({ error: "locationId required" }, { status: 400 });
  }

  // Verify location ownership
  const location = await prisma.location.findFirst({
    where: { id: locationId, userId: user.id },
    select: { id: true, name: true },
  });

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  // Check existing active invite
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.clientInvite.findFirst({
      where: {
        ownerId: user.id,
        locationId,
        email: normalizedEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        invite: existing,
        link: `${process.env.NEXTAUTH_URL}/invite/${existing.token}`,
        message: "Existing active invite returned",
      });
    }
  }

  const expiresAt = new Date(
    Date.now() + expiryDays * 24 * 60 * 60 * 1000
  );

  const invite = await prisma.clientInvite.create({
    data: {
      ownerId: user.id, // ✅ now guaranteed string
      locationId,
      email: email ? email.toLowerCase().trim() : null,
      expiresAt,
    },
  });

  const link = `${process.env.NEXTAUTH_URL}/invite/${invite.token}`;

  return NextResponse.json({
    success: true,
    invite: {
      ...invite,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    },
    link,
    locationName: location.name,
  });
}

// ─────────────────────────────────────────────
// DELETE - revoke invite
// ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getAgencyUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inviteId } = await req.json();

  if (!inviteId) {
    return NextResponse.json({ error: "inviteId required" }, { status: 400 });
  }

  await prisma.clientInvite.deleteMany({
    where: {
      id: inviteId,
      ownerId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}