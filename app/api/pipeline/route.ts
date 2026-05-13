import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function getUserId(req: NextRequest) {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string })?.id || null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const stage = searchParams.get("stage");

  const leads = await prisma.leadPipeline.findMany({
    where: {
      userId,
      ...(locationId && { locationId }),
      ...(stage && { stage }),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      assignedAgent: { select: { id: true, name: true, avatar: true, role: true } },
      stageHistory: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  const stageCounts = await prisma.leadPipeline.groupBy({
    by: ["stage"],
    where: { userId, ...(locationId && { locationId }) },
    _count: true,
  });

  return NextResponse.json({ leads, stageCounts });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, stage, agentId, notes } = await req.json();

  const lead = await prisma.leadPipeline.findFirst({ where: { id: leadId, userId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const updated = await prisma.leadPipeline.update({
    where: { id: leadId },
    data: {
      ...(stage && { stage }),
      ...(agentId !== undefined && { assignedAgentId: agentId }),
      ...(notes && { notes }),
    },
  });

  if (stage && stage !== lead.stage) {
    await prisma.pipelineStageHistory.create({
      data: {
        leadId,
        fromStage: lead.stage,
        toStage: stage,
        agentId,
        reason: "Manual update",
        triggeredBy: "manual",
      },
    });
  }

  return NextResponse.json({ success: true, lead: updated });
}
