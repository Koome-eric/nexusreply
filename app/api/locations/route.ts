import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function getUserId(req: NextRequest) {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string })?.id || null;
}

// GET /api/locations — list all user's locations
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locations = await prisma.location.findMany({
    where: { userId },
    include: {
      businessProfile: true,
      automationConfig: true,
      _count: { select: { aiLogs: true, conversations: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const sub = await prisma.subscription.findUnique({ where: { userId } });

  return NextResponse.json({ locations, subscription: sub });
}

// POST /api/locations — update a location (toggle automation, rename)
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { locationId, automationEnabled, name } = await req.json();

  const location = await prisma.location.findFirst({ where: { id: locationId, userId } });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.location.update({
    where: { id: locationId },
    data: {
      ...(automationEnabled !== undefined && { automationEnabled }),
      ...(name && { name }),
    },
  });

  return NextResponse.json({ success: true, location: updated });
}

// DELETE /api/locations — remove a location
export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { locationId } = await req.json();

  const location = await prisma.location.findFirst({ where: { id: locationId, userId } });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.location.delete({ where: { id: locationId } });

  return NextResponse.json({ success: true });
}
