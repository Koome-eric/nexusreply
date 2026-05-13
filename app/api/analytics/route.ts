import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { resolveLocationAccess } from "@/lib/client-access";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");
  const locationId = searchParams.get("locationId") || undefined;
  const scope = searchParams.get("scope") || "single"; // "single" | "all"

  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;

  const since    = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);

  let userId: string;
  let locationFilter: { locationId?: string } = {};
  let locationIds: string[] | undefined;

  // ── Scope resolution ─────────────────────────────────────────────
  if (scope === "all" && u?.role === "agency" && u?.id) {
    // Agency: aggregate across ALL their locations
    userId = u.id;
    const allLocs = await prisma.location.findMany({
      where: { userId },
      select: { id: true, name: true, ghlLocationId: true },
    });
    locationIds = allLocs.map(l => l.id);
    locationFilter = {}; // we'll filter by userId + locationIds
  } else if (locationId) {
    const access = await resolveLocationAccess(req, locationId);
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = access.ownerId;
    locationFilter = { locationId };
  } else if (u?.id) {
    userId = u.id;
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const buildWhere = (extra: object = {}) => ({
    userId,
    ...(locationIds ? { locationId: { in: locationIds } } : locationFilter),
    ...extra,
  });

  const where     = buildWhere({ createdAt: { gte: since } });
  const prevWhere = buildWhere({ createdAt: { gte: prevSince, lt: since } });

  // ── Core message stats ───────────────────────────────────────────
  const [total, sent, humanFallbacks, prevTotal, prevFallbacks] = await Promise.all([
    prisma.aIMessageLog.count({ where }),
    prisma.aIMessageLog.count({ where: { ...where, status: "sent" } }),
    prisma.aIMessageLog.count({ where: { ...where, humanTookOver: true } }),
    prisma.aIMessageLog.count({ where: prevWhere }),
    prisma.aIMessageLog.count({ where: { ...prevWhere, humanTookOver: true } }),
  ]);

  // ── Lead / Pipeline stats ────────────────────────────────────────
  const pWhere     = buildWhere({ createdAt: { gte: since } });
  const pPrevWhere = buildWhere({ createdAt: { gte: prevSince, lt: since } });

  const [
    totalLeads, qualifiedLeads, wonLeads, lostLeads, nurtureLeads,
    bookedLeads, prevQualified, prevWon,
  ] = await Promise.all([
    prisma.leadPipeline.count({ where: pWhere }),
    prisma.leadPipeline.count({ where: { ...pWhere, isQualified: true } }),
    prisma.leadPipeline.count({ where: { ...pWhere, stage: "WON" } }),
    prisma.leadPipeline.count({ where: { ...pWhere, stage: "LOST" } }),
    prisma.leadPipeline.count({ where: { ...pWhere, stage: "NURTURE" } }),
    prisma.leadPipeline.count({ where: { ...pWhere, hasBooked: true } }),
    prisma.leadPipeline.count({ where: { ...pPrevWhere, isQualified: true } }),
    prisma.leadPipeline.count({ where: { ...pPrevWhere, stage: "WON" } }),
  ]);

  // ── Per-location breakdown (agency scope) ────────────────────────
  let locationBreakdown: {
    id: string; name: string; leads: number; won: number; messages: number;
    automationRate: number;
  }[] = [];

  if (scope === "all" && locationIds) {
    const allLocs = await prisma.location.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    locationBreakdown = await Promise.all(allLocs.map(async loc => {
      const lWhere = { userId, locationId: loc.id, createdAt: { gte: since } };
      const [msgs, sentMsgs, leads, won] = await Promise.all([
        prisma.aIMessageLog.count({ where: lWhere }),
        prisma.aIMessageLog.count({ where: { ...lWhere, status: "sent" } }),
        prisma.leadPipeline.count({ where: lWhere }),
        prisma.leadPipeline.count({ where: { ...lWhere, stage: "WON" } }),
      ]);
      return {
        id: loc.id, name: loc.name, leads, won, messages: msgs,
        automationRate: msgs > 0 ? Math.round((sentMsgs / msgs) * 100) : 0,
      };
    }));
  }

  // ── Intent breakdown ─────────────────────────────────────────────
  const intentGroups = await prisma.aIMessageLog.groupBy({
    by: ["intent"], where: { ...where, intent: { not: null } },
    _count: true, orderBy: { _count: { intent: "desc" } }, take: 6,
  });

  // ── Agent stats ──────────────────────────────────────────────────
  const agentQuery = locationIds
    ? { userId, locationId: { in: locationIds }, isActive: true }
    : { userId, ...(locationFilter.locationId && { locationId: locationFilter.locationId }), isActive: true };

  const agents = await prisma.aIAgent.findMany({
    where: agentQuery,
    select: {
      id: true, name: true, role: true, avatar: true,
      _count: { select: { assignedLeads: true, messageLogs: true } },
    },
  });

  const agentStats = await Promise.all(agents.map(async (a) => {
    const agentWhere = { agentId: a.id, createdAt: { gte: since } };
    const [msgs, takeovers, avgConf, wonByAgent, totalByAgent] = await Promise.all([
      prisma.aIMessageLog.count({ where: agentWhere }),
      prisma.aIMessageLog.count({ where: { ...agentWhere, humanTookOver: true } }),
      prisma.aIMessageLog.aggregate({
        where: { ...agentWhere, confidence: { not: null } }, _avg: { confidence: true },
      }),
      prisma.leadPipeline.count({ where: { assignedAgentId: a.id, stage: "WON", createdAt: { gte: since } } }),
      prisma.leadPipeline.count({ where: { assignedAgentId: a.id, createdAt: { gte: since } } }),
    ]);
    return {
      id: a.id, name: a.name, role: a.role, avatar: a.avatar || "🤖",
      totalMessages: msgs, humanTakeovers: takeovers,
      avgConfidence: Math.round((avgConf._avg.confidence || 0) * 100),
      autonomyRate: msgs > 0 ? Math.round(((msgs - takeovers) / msgs) * 100) : 0,
      leadsAssigned: totalByAgent, leadsWon: wonByAgent,
      conversionRate: totalByAgent > 0 ? Math.round((wonByAgent / totalByAgent) * 100) : 0,
    };
  }));

  // ── Daily chart data ─────────────────────────────────────────────
  const chartDays = Math.min(days, 14);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dailyData = await Promise.all(
    Array.from({ length: chartDays }, (_, i) => {
      const d = new Date(today.getTime() - (chartDays - 1 - i) * 86400000);
      const next = new Date(d.getTime() + 86400000);
      const dayWhere = buildWhere({ createdAt: { gte: d, lt: next } });
      return Promise.all([
        prisma.aIMessageLog.count({ where: dayWhere }),
        prisma.aIMessageLog.count({ where: { ...dayWhere, humanTookOver: true } }),
        prisma.leadPipeline.count({ where: dayWhere }),
      ]).then(([msgs, fallbacks, leads]) => ({
        date: d.toISOString().slice(5, 10), messages: msgs, fallbacks, leads,
      }));
    })
  );

  // ── Drop-off / handoff rates ─────────────────────────────────────
  const dropOffRate = totalLeads > 0 ? Math.round((lostLeads / totalLeads) * 100) : 0;
  const humanWon = await prisma.aIMessageLog.findMany({
    where: { ...where, humanTookOver: true },
    select: { contactId: true }, distinct: ["contactId"],
  });
  const humanContactIds = humanWon.map(h => h.contactId);
  const humanWonLeads = humanContactIds.length > 0
    ? await prisma.leadPipeline.count({ where: { userId, contactId: { in: humanContactIds }, stage: "WON" } })
    : 0;
  const handoffSuccessRate = humanContactIds.length > 0
    ? Math.round((humanWonLeads / humanContactIds.length) * 100) : 0;

  // ── Confidence distribution ──────────────────────────────────────
  const allConf = await prisma.aIMessageLog.findMany({
    where: { ...where, confidence: { not: null } }, select: { confidence: true },
  });
  const confBuckets = { high: 0, medium: 0, low: 0 };
  allConf.forEach(({ confidence }) => {
    if (!confidence) return;
    if (confidence >= 0.75) confBuckets.high++;
    else if (confidence >= 0.5) confBuckets.medium++;
    else confBuckets.low++;
  });

  // ── Recent logs ──────────────────────────────────────────────────
  const recentLogs = await prisma.aIMessageLog.findMany({
    where: buildWhere(),
    orderBy: { createdAt: "desc" }, take: 15,
    select: {
      id: true, contactId: true, locationId: true, messageType: true,
      inputMessage: true, aiResponse: true, status: true, humanTookOver: true,
      confidence: true, intent: true, agentAction: true, createdAt: true,
    },
  });

  // Enrich recentLogs with location name if agency scope
  let locationNameMap: Record<string, string> = {};
  if (scope === "all" && locationIds) {
    const locs = await prisma.location.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } });
    locationNameMap = Object.fromEntries(locs.map(l => [l.id, l.name]));
  }
  const enrichedLogs = recentLogs.map(l => ({
    ...l,
    locationName: l.locationId ? locationNameMap[l.locationId] || undefined : undefined,
  }));

  const sub = await prisma.subscription.findUnique({ where: { userId } });

  const delta = (curr: number, prev: number) =>
    prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

  return NextResponse.json({
    scope,
    stats: {
      totalMessages: total, sentMessages: sent, humanFallbacks,
      automationRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      dropOffRate, handoffSuccessRate,
      totalLeads, qualifiedLeads, wonLeads, lostLeads, nurtureLeads, bookedLeads,
      qualifyRate: totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0,
      closeRate: qualifiedLeads > 0 ? Math.round((wonLeads / qualifiedLeads) * 100) : 0,
      bookingRate: qualifiedLeads > 0 ? Math.round((bookedLeads / qualifiedLeads) * 100) : 0,
      avgConfidence: allConf.length > 0
        ? Math.round((allConf.reduce((s, c) => s + (c.confidence || 0), 0) / allConf.length) * 100) : 0,
      confBuckets,
      deltaMessages: delta(total, prevTotal),
      deltaFallbacks: delta(humanFallbacks, prevFallbacks),
      deltaQualified: delta(qualifiedLeads, prevQualified),
      deltaWon: delta(wonLeads, prevWon),
    },
    locationBreakdown,
    agentStats,
    intentBreakdown: intentGroups.map(g => ({ intent: g.intent || "unknown", count: g._count })),
    dailyData,
    recentLogs: enrichedLogs,
    subscription: sub,
  });
}
