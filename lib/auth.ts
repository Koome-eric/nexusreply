import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { NextResponse } from "next/server";
import { prisma } from "./db";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user as {
    id: string;
    email: string;
    name?: string;
    role: string;
    plan: string;
    subStatus: string;
  };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function checkTrialOrActive(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  sub?: { plan: string; status: string; trialMessagesUsed: number; trialMessagesLimit: number; monthlyMessageLimit: number; messagesUsedThisPeriod: number };
}> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { allowed: false, reason: "no_subscription" };

  const now = new Date();

  if (sub.status === "trialing") {
    if (now > sub.trialEndsAt) return { allowed: false, reason: "trial_expired" };
    if (sub.trialMessagesUsed >= sub.trialMessagesLimit) return { allowed: false, reason: "trial_messages_exhausted" };
    return { allowed: true, sub: sub as any };
  }

  if (sub.status === "active") {
    if (sub.messagesUsedThisPeriod >= sub.monthlyMessageLimit) return { allowed: false, reason: "monthly_limit_reached" };
    return { allowed: true, sub: sub as any };
  }

  return { allowed: false, reason: `subscription_${sub.status}` };
}

export async function incrementUsage(userId: string, tokens: number, locationId?: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return;

  await prisma.usageLog.create({ data: { userId, locationId, tokens } });

  if (sub.status === "trialing") {
    await prisma.subscription.update({
      where: { userId },
      data: { trialMessagesUsed: { increment: 1 } },
    });
  } else {
    await prisma.subscription.update({
      where: { userId },
      data: { messagesUsedThisPeriod: { increment: 1 } },
    });
  }
}
