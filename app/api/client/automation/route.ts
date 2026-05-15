import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

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

  const [config, location] = await Promise.all([
    prisma.automationConfig.findUnique({ where: { locationId: ctx.locationId } }),
    prisma.location.findUnique({ where: { id: ctx.locationId }, select: { automationEnabled: true } }),
  ]);

  // If no config record yet, synthesise one from location.automationEnabled
  const effectiveConfig = config ?? (location ? {
    enabled:      location.automationEnabled,
    emailEnabled: true,
    smsEnabled:   true,
  } : null);

  return NextResponse.json({ config: effectiveConfig });
}

export async function POST(req: NextRequest) {
  const ctx = await getClientContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { locationId: _loc, ...rest } = data;

  const config = await prisma.automationConfig.upsert({
    where:  { locationId: ctx.locationId },
    update: rest,
    create: { userId: ctx.ownerId, locationId: ctx.locationId, ...rest },
  });

  // Always sync location.automationEnabled with config.enabled
  if (rest.enabled !== undefined) {
    await prisma.location.update({
      where: { id: ctx.locationId },
      data:  { automationEnabled: rest.enabled },
    });
  }

  return NextResponse.json({ success: true, config });
}