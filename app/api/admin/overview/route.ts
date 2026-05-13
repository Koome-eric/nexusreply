import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function isAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  return u?.role === "admin";
}

export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  const [
    totalUsers,
    activeLocations,
    totalLocations,
    msgsToday,
    msgsThisMonth,
    wonLeads,
    planBreakdown,
    recentUsers,
    trialCount,
    activeSubscriptions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.location.count({ where: { automationEnabled: true } }),
    prisma.location.count(),
    prisma.aIMessageLog.count({ where: { createdAt: { gte: today } } }),
    prisma.aIMessageLog.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.leadPipeline.count({ where: { stage: "WON" } }),
    prisma.subscription.groupBy({ by: ["plan"], _count: { plan: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, email: true, name: true, createdAt: true,
        subscription: { select: { plan: true, status: true } },
      },
    }),
    prisma.subscription.count({ where: { status: "trialing" } }),
    prisma.subscription.count({ where: { status: { in: ["active", "trialing"] } } }),
  ]);

  // MRR estimate from paid plans only
  const revenueMap: Record<string, number> = { starter: 97, pro: 197, agency: 397, enterprise: 797 };
  const mrr = planBreakdown
    .filter(p => !["trial", "trialing", "free"].includes(p.plan))
    .reduce((sum, p) => sum + (revenueMap[p.plan] || 0) * p._count.plan, 0);

  return NextResponse.json({
    stats: {
      totalUsers,
      activeSubscriptions,
      totalLocations,
      activeLocations,
      msgsToday,
      msgsThisMonth,
      trialUsers: trialCount,
      wonLeads,
      mrr,
    },
    planBreakdown: planBreakdown.map(p => ({ plan: p.plan, count: p._count.plan })),
    recentUsers: recentUsers.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.subscription?.plan || "trial",
      status: u.subscription?.status || "trialing",
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
