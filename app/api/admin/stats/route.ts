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

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "7d";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const rangeStart = range === "7d" ? weekAgo : range === "30d" ? monthAgo : new Date(2020, 0, 1);

  const [
    totalUsers, activeUsers, totalMessages, messagesToday,
    messagesThisWeek, messagesThisMonth, humanTakeovers,
    planBreakdown, leadCounts, wonLeads, lostLeads, qualifiedLeads,
    globalAgents, recentErrors,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { aiLogs: { some: { createdAt: { gte: weekAgo } } } } }),
    prisma.aIMessageLog.count({ where: { createdAt: { gte: rangeStart } } }),
    prisma.aIMessageLog.count({ where: { createdAt: { gte: today } } }),
    prisma.aIMessageLog.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.aIMessageLog.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.aIMessageLog.count({ where: { createdAt: { gte: rangeStart }, humanTookOver: true } }),
    prisma.subscription.groupBy({ by: ["plan"], _count: { plan: true } }),
    prisma.leadPipeline.count({ where: { createdAt: { gte: rangeStart } } }),
    prisma.leadPipeline.count({ where: { stage: "WON", createdAt: { gte: rangeStart } } }),
    prisma.leadPipeline.count({ where: { stage: "LOST", createdAt: { gte: rangeStart } } }),
    prisma.leadPipeline.count({ where: { isQualified: true, createdAt: { gte: rangeStart } } }),
    prisma.globalAgentTemplate.findMany({ orderBy: { role: "asc" } }),
    prisma.aIMessageLog.findMany({
      where: { status: "error", createdAt: { gte: rangeStart } },
      orderBy: { createdAt: "desc" }, take: 10,
      select: { inputMessage: true, createdAt: true, locationId: true },
    }),
  ]);

  // Daily message breakdown
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const dailyMessages: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const next = new Date(d.getTime() + 86400000);
    const count = await prisma.aIMessageLog.count({ where: { createdAt: { gte: d, lt: next } } });
    dailyMessages.push({ date: d.toISOString().slice(0, 10), count });
  }

  // Conversion funnel
  const stageOrder = ["NEW", "ENGAGED", "QUALIFIED", "BOOKING", "CLOSING", "WON"];
  const conversionFunnel = await Promise.all(
    stageOrder.map(async (stage) => ({
      stage,
      count: await prisma.leadPipeline.count({ where: { stage, createdAt: { gte: rangeStart } } }),
    }))
  );

  const revenueMap: Record<string, number> = { starter: 97, pro: 197, agency: 397, enterprise: 797 };
  const estimatedRevenue = planBreakdown
    .filter(p => p.plan !== "trial" && p.plan !== "trialing")
    .reduce((sum, p) => sum + (revenueMap[p.plan] || 0) * (p._count.plan || 0), 0);

  const automationRate = totalMessages > 0 ? Math.round(((totalMessages - humanTakeovers) / totalMessages) * 100) : 0;
  const fallbackRate = totalMessages > 0 ? Math.round((humanTakeovers / totalMessages) * 100) : 0;

  const agentStats = globalAgents.map(a => ({
    name: a.name, role: a.role,
    messages: 0, // will be real once agentId is populated in logs
    successRate: Math.round(a.performanceScore || 78),
  }));

  return NextResponse.json({
    totalUsers, activeUsers, totalMessages, messagesToday,
    messagesThisWeek, messagesThisMonth, automationRate, fallbackRate,
    estimatedRevenue, totalLeads: leadCounts, qualifiedLeads, wonLeads, lostLeads,
    agentStats, dailyMessages,
    recentErrors: recentErrors.map(e => ({
      message: e.inputMessage.slice(0, 120),
      createdAt: e.createdAt.toISOString(),
      locationId: e.locationId,
    })),
    planBreakdown: planBreakdown.map(p => ({ plan: p.plan, count: p._count.plan || 0 })),
    conversionFunnel: conversionFunnel.filter(f => f.count > 0),
  });
}
