import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface AccessContext {
  userId: string;
  role?: string;
  locationId: string;
  ownerId: string;
}

export async function resolveLocationAccess(req: NextRequest, locationId: string): Promise<AccessContext | null> {
  const session = await getSession();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return null;

  if (u.role === "client") {
    const membership = await prisma.locationMember.findFirst({
      where: { userId: u.id, locationId },
      select: { ownerId: true, locationId: true },
    });
    if (!membership) return null;
    return { userId: u.id, role: u.role, locationId: membership.locationId, ownerId: membership.ownerId };
  }

  const location = await prisma.location.findFirst({ where: { id: locationId, userId: u.id } });
  if (!location) return null;
  return { userId: u.id, role: u.role, locationId, ownerId: u.id };
}

export async function resolveClientContext(req: NextRequest): Promise<AccessContext | null> {
  const session = await getSession();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id || u.role !== "client") return null;

  const membership = await prisma.locationMember.findFirst({
    where: { userId: u.id },
    select: { ownerId: true, locationId: true },
  });
  if (!membership) return null;
  return { userId: u.id, role: u.role, locationId: membership.locationId, ownerId: membership.ownerId };
}
