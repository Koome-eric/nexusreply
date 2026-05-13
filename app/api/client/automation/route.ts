import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Resolve client's locationId and ownerId from session
async function getClientContext(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id || u.role !== "client") return null;

  const membership = await prisma.locationMember.findFirst({
    where: { userId: u.id },
    select: { locationId: true, ownerId: true },
  });
  if (!membership) return null;
  return { userId: u.id, locationId: membership.locationId, ownerId: membership.ownerId };
}

export async function GET(req: NextRequest) {
  const ctx = await getClientContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.automationConfig.findUnique({ where: { locationId: ctx.locationId } });
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  const ctx = await getClientContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const { locationId, ...rest } = data;

  // Clients can only modify their own location's automation
  const config = await prisma.automationConfig.upsert({
    where: { locationId: ctx.locationId },
    update: rest,
    create: { userId: ctx.ownerId, locationId: ctx.locationId, ...rest },
  });

  if (rest.enabled !== undefined) {
    await prisma.location.update({ where: { id: ctx.locationId }, data: { automationEnabled: rest.enabled } });
  }

  return NextResponse.json({ success: true, config });
}