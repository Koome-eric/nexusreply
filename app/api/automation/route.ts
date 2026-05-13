import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function getUserId(req: NextRequest) {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string })?.id || null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });
  const config = await prisma.automationConfig.findUnique({ where: { locationId } });
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const { locationId, ...rest } = data;
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });
  const loc = await prisma.location.findFirst({ where: { id: locationId, userId } });
  if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 });
  const config = await prisma.automationConfig.upsert({
    where: { locationId },
    update: rest,
    create: { userId, locationId, ...rest },
  });
  if (rest.enabled !== undefined) {
    await prisma.location.update({ where: { id: locationId }, data: { automationEnabled: rest.enabled } });
  }
  return NextResponse.json({ success: true, config });
}
