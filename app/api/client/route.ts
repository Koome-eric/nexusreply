import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Resolve client's locationId and ownerId from session
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

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") || "overview";
  const days = parseInt(searchParams.get("days") || "30");

  const since = new Date(Date.now() - days * 86400000);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { locationId, ownerId } = ctx;

  if (section === "overview") {
    const [totalLeads, wonLeads, activeLeads, totalMessages, humanFallbacks, agents] = await Promise.all([
      prisma.leadPipeline.count({ where: { locationId } }),
      prisma.leadPipeline.count({ where: { locationId, stage: "WON" } }),
      prisma.leadPipeline.count({ where: { locationId, stage: { notIn: ["WON", "LOST"] } } }),
      prisma.aIMessageLog.count({ where: { locationId, createdAt: { gte: since } } }),
      prisma.aIMessageLog.count({ where: { locationId, humanTookOver: true, createdAt: { gte: since } } }),
      prisma.aIAgent.findMany({ where: { locationId, isActive: true }, select: { name: true, role: true, avatar: true } }),
    ]);
    const qualifiedLeads = await prisma.leadPipeline.count({ where: { locationId, isQualified: true } });
    const automationRate = totalMessages > 0 ? Math.round(((totalMessages - humanFallbacks) / totalMessages) * 100) : 0;
    return NextResponse.json({ totalLeads, wonLeads, activeLeads, qualifiedLeads, totalMessages, automationRate, agents });
  }

  if (section === "pipeline") {
    const leads = await prisma.leadPipeline.findMany({
      where: { locationId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true, contactName: true, contactEmail: true, stage: true,
        score: true, isQualified: true, hasBooked: true, lastIntent: true,
        lastMessageAt: true, messageCount: true, outboundStarted: true,
        assignedAgent: { select: { name: true, avatar: true } },
        createdAt: true, updatedAt: true,
      },
    });
    const stageCounts = await prisma.leadPipeline.groupBy({
      by: ["stage"], where: { locationId }, _count: true,
    });
    return NextResponse.json({ leads, stageCounts });
  }

  if (section === "conversations") {
    const conversations = await prisma.conversationCache.findMany({
      where: { locationId },
      orderBy: { lastMessageAt: "desc" },
      take: 40,
      select: {
        id: true, contactName: true, contactEmail: true, contactPhone: true,
        status: true, lastMessageAt: true, ghlConversationId: true,
      },
    });

    const enriched = await Promise.all(conversations.map(async conv => {
      const logs = await prisma.aIMessageLog.findMany({
        where: { locationId, conversationId: conv.ghlConversationId },
        orderBy: { createdAt: "asc" },
        select: {
          inputMessage: true, aiResponse: true, messageType: true,
          humanTookOver: true, createdAt: true, intent: true,
          agent: { select: { name: true, avatar: true, role: true } },
        },
      });
      const lastLog = logs.length ? logs[logs.length - 1] : null;
      return {
        ...conv,
        lastLog: lastLog ? {
          inputMessage:  lastLog.inputMessage,
          aiResponse:    lastLog.aiResponse,
          messageType:   lastLog.messageType,
          humanTookOver: lastLog.humanTookOver,
          createdAt:     lastLog.createdAt.toISOString(),
          intent:        lastLog.intent,
          agent:         lastLog.agent,
        } : null,
        logs: logs.map(log => ({
          inputMessage:  log.inputMessage,
          aiResponse:    log.aiResponse,
          messageType:   log.messageType,
          humanTookOver: log.humanTookOver,
          createdAt:     log.createdAt.toISOString(),
          intent:        log.intent,
          agent:         log.agent,
        })),
      };
    }));

    return NextResponse.json({ conversations: enriched });
  }

  if (section === "analytics") {
    const dailyData = await Promise.all(
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today.getTime() - (13 - i) * 86400000);
        const next = new Date(d.getTime() + 86400000);
        return Promise.all([
          prisma.aIMessageLog.count({ where: { locationId, createdAt: { gte: d, lt: next } } }),
          prisma.leadPipeline.count({ where: { locationId, createdAt: { gte: d, lt: next } } }),
        ]).then(([messages, leads]) => ({ date: d.toISOString().slice(5, 10), messages, leads }));
      })
    );
    const [total, fallbacks, qualified, won] = await Promise.all([
      prisma.aIMessageLog.count({ where: { locationId, createdAt: { gte: since } } }),
      prisma.aIMessageLog.count({ where: { locationId, humanTookOver: true, createdAt: { gte: since } } }),
      prisma.leadPipeline.count({ where: { locationId, isQualified: true } }),
      prisma.leadPipeline.count({ where: { locationId, stage: "WON" } }),
    ]);
    const totalLeads = await prisma.leadPipeline.count({ where: { locationId } });
    return NextResponse.json({
      dailyData,
      stats: {
        totalMessages: total,
        automationRate: total > 0 ? Math.round(((total - fallbacks) / total) * 100) : 0,
        qualifyRate: totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 0,
        closeRate: qualified > 0 ? Math.round((won / qualified) * 100) : 0,
      },
    });
  }

  if (section === "agents") {
    const agents = await prisma.aIAgent.findMany({
      where: { locationId },
      select: { id: true, name: true, role: true, avatar: true, tone: true, isActive: true, triggerStages: true, triggerIntents: true },
    });
    return NextResponse.json({ agents });
  }

  if (section === "notifications") {
    const notifs = await prisma.notification.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    await prisma.notification.updateMany({ where: { userId: ctx.userId, read: false }, data: { read: true } });
    return NextResponse.json({ notifications: notifs });
  }

  return NextResponse.json({ error: "Invalid section" }, { status: 400 });
}
