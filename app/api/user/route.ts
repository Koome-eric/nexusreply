import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { subscription: true, _count: { select: { locations: true } } } });
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.subscription?.plan || "trial", status: user.subscription?.status || "trialing", trialEndsAt: user.subscription?.trialEndsAt, trialMessagesUsed: user.subscription?.trialMessagesUsed || 0, trialMessagesLimit: user.subscription?.trialMessagesLimit || 50, locationCount: user._count.locations, locationLimit: user.subscription?.locationLimit || 1, messagesUsed: user.subscription?.messagesUsedThisPeriod || 0, monthlyLimit: user.subscription?.monthlyMessageLimit || 500 } });
}
