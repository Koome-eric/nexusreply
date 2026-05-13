import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function getAgencyId(req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id || u.role === "client" || u.role === "admin") return null;
  return u.id;
}

export async function GET(req: NextRequest) {
  const agencyId = await getAgencyId(req);
  if (!agencyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const loc = await prisma.location.findFirst({ where: { id: locationId, userId: agencyId } });
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await prisma.locationMember.findMany({
    where: { locationId, ownerId: agencyId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ members });
}

export async function DELETE(req: NextRequest) {
  const agencyId = await getAgencyId(req);
  if (!agencyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  const member = await prisma.locationMember.findUnique({ where: { id: memberId } });
  if (!member || member.ownerId !== agencyId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.locationMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
