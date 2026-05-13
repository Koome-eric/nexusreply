import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// GET - validate invite token (for the invite page to show location info)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const invite = await prisma.clientInvite.findUnique({
    where: { token },
    include: { location: { select: { name: true, ghlLocationId: true } } },
  });

  if (!invite) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "This invite has already been used", used: true }, { status: 410 });
  if (new Date() > invite.expiresAt) return NextResponse.json({ error: "This invite has expired", expired: true }, { status: 410 });

  return NextResponse.json({
    valid: true,
    locationName: invite.location.name,
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
  });
}

// POST - accept invite (create account or link existing account)
export async function POST(req: NextRequest) {
  const { token, name, email, password } = await req.json();

  if (!token || !email || !password) {
    return NextResponse.json({ error: "Token, email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Validate invite
  const invite = await prisma.clientInvite.findUnique({
    where: { token },
    include: { location: true },
  });

  if (!invite) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  if (new Date() > invite.expiresAt) return NextResponse.json({ error: "This invite link has expired" }, { status: 410 });

  // If invite was for a specific email, enforce it
  if (invite.email && invite.email !== email.toLowerCase().trim()) {
    return NextResponse.json({ error: "This invite was sent to a different email address" }, { status: 403 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  let clientUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (clientUser) {
    // User exists — check they aren't already an agency owner or admin
    if (clientUser.role === "admin") {
      return NextResponse.json({ error: "This email is already an admin account" }, { status: 409 });
    }
    // Check if already a member of this location
    const alreadyMember = await prisma.locationMember.findUnique({
      where: { userId_locationId: { userId: clientUser.id, locationId: invite.locationId } },
    });
    if (alreadyMember) {
      return NextResponse.json({ error: "You already have access to this location" }, { status: 409 });
    }
    // If they're an agency user, still add them as a location member (dual role scenario)
  } else {
    // Create new client user (no subscription needed — they use agency's subscription)
    const hashed = await bcrypt.hash(password, 12);
    clientUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || null,
        password: hashed,
        role: "client",
        agencyOwnerId: invite.ownerId,   // links client → agency for branding + scoping
      },
    });
  }

  // Create location membership
  await prisma.locationMember.create({
    data: {
      userId: clientUser.id,
      locationId: invite.locationId,
      ownerId: invite.ownerId,
      role: "client",
    },
  });

  // Mark invite as accepted
  await prisma.clientInvite.update({
    where: { token },
    data: { acceptedAt: new Date(), acceptedBy: clientUser.id },
  });

  // Notify the agency owner
  await prisma.notification.create({
    data: {
      userId: invite.ownerId,
      type: "client_joined",
      title: `👤 ${clientUser.name || normalizedEmail} joined ${invite.location.name}`,
      message: `A client has accepted your invite and now has access to ${invite.location.name}.`,
      data: { clientUserId: clientUser.id, locationId: invite.locationId },
    },
  });

  return NextResponse.json({ success: true, message: "Account created. You can now log in." });
}
