import { prisma } from "./db";
import { Prisma } from "@prisma/client";

type JsonData = Prisma.InputJsonValue;

interface NotifyAllUsersOpts {
  type: string;
  title: string;
  message: string;
  data?: JsonData;
}

// Helper to normalize JSON safely
function normalizeJson(data?: JsonData): JsonData | Prisma.NullTypes.JsonNull {
  return data ?? Prisma.JsonNull;
}

// Send a notification to every user in the system
export async function notifyAllUsers(opts: NotifyAllUsersOpts): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) return 0;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      data: normalizeJson(opts.data),
      read: false,
    })),
  });

  return users.length;
}

// Send a notification to a single user
export async function notifyUser(
  userId: string,
  opts: NotifyAllUsersOpts
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      data: normalizeJson(opts.data),
      read: false,
    },
  });
}

// Send notification to users who have a default agent of a specific role
export async function notifyUsersWithRole(
  role: string,
  opts: NotifyAllUsersOpts
): Promise<number> {
  const agents = await prisma.aIAgent.findMany({
    where: { role, isDefault: true },
    select: { userId: true },
    distinct: ["userId"],
  });

  if (agents.length === 0) {
    // fallback: notify all users
    return notifyAllUsers(opts);
  }

  const userIds = Array.from(
  new Set(agents.map((a) => a.userId))
);

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      data: normalizeJson(opts.data),
      read: false,
    })),
  });

  return userIds.length;
}

// Send notifications to all client users belonging to a given agency owner
export async function notifyClientsByAgency(
  agencyOwnerId: string,
  opts: NotifyAllUsersOpts
): Promise<number> {
  const members = await prisma.locationMember.findMany({
    where: { ownerId: agencyOwnerId },
    select: { userId: true },
    distinct: ["userId"],
  });

  if (members.length === 0) return 0;

  const userIds = members.map((m) => m.userId);

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      data: normalizeJson(opts.data),
      read: false,
    })),
  });

  return userIds.length;
}