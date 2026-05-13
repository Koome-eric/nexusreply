import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { DEFAULT_AGENT_TEMPLATES } from "@/lib/handoff-engine";
import { notifyClientsByAgency } from "@/lib/notify";

const MAX_AGENTS_AGENCY = 6;

async function getSession() {
  const session = await getServerSession(authOptions);
  return session?.user as { id?: string; role?: string } | undefined;
}

// For agency role: agencyId = their own userId
// For user role: agencyId = their own userId (single account)
function resolveAgencyId(userId: string, _role: string) {
  return userId;
}

// GET /api/agents?locationId=xxx
export async function GET(req: NextRequest) {
  const u = await getSession();
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  // For client users, find the owner's userId via LocationMember
  let ownerUserId = u.id;
  if (u.role === "client") {
    const member = await prisma.locationMember.findFirst({
      where: { userId: u.id, locationId },
      select: { ownerId: true },
    });
    if (!member) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    ownerUserId = member.ownerId;
  }

  let agents = await prisma.aIAgent.findMany({
    where: { userId: ownerUserId, locationId },
    orderBy: { order: "asc" },
    include: { _count: { select: { assignedLeads: true, messageLogs: true } } },
  });

  // Auto-seed defaults if none exist (only for the owner)
  if (agents.length === 0 && u.role !== "client") {
    const location = await prisma.location.findFirst({ where: { id: locationId, userId: ownerUserId } });
    if (location) {
      const agencyId = resolveAgencyId(ownerUserId, u.role || "");
      await prisma.aIAgent.createMany({
        data: DEFAULT_AGENT_TEMPLATES.map((t) => ({
          userId: ownerUserId,
          locationId,
          agencyId,
          ...t,
        })),
      });
      agents = await prisma.aIAgent.findMany({
        where: { userId: ownerUserId, locationId },
        orderBy: { order: "asc" },
        include: { _count: { select: { assignedLeads: true, messageLogs: true } } },
      });
    }
  }

  return NextResponse.json({ agents });
}

// POST /api/agents — create or update
export async function POST(req: NextRequest) {
  const u = await getSession();
  if (!u?.id || u.role === "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const { id, locationId, ...rest } = data;
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const loc = await prisma.location.findFirst({ where: { id: locationId, userId: u.id } });
  if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const agencyId = resolveAgencyId(u.id, u.role || "");
  const isAgency = u.role === "agency";

  let agent;

  if (id) {
    // Update — verify ownership
    const existing = await prisma.aIAgent.findFirst({ where: { id, userId: u.id } });
    if (!existing) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    agent = await prisma.aIAgent.update({
      where: { id },
      data: {
        name: rest.name,
        role: rest.role,
        avatar: rest.avatar,
        systemPrompt: rest.systemPrompt,
        tone: rest.tone,
        isActive: rest.isActive ?? true,
        order: rest.order ?? 0,
        triggerIntents: rest.triggerIntents || [],
        triggerStages: rest.triggerStages || [],
        triggerKeywords: rest.triggerKeywords || [],
      },
    });

    // Notify clients of this agency that an agent was updated
    if (isAgency) {
      await notifyClientsByAgency(u.id, {
        type: "agent_updated",
        title: `🤖 AI Agent Updated`,
        message: `Your agency updated the "${agent.name}" agent on your sales team.`,
        data: { agentId: agent.id, agentName: agent.name, locationId },
      });
    }
  } else {
    // Create — enforce 6-agent cap for agency accounts
    const count = await prisma.aIAgent.count({ where: { userId: u.id, locationId } });

    if (isAgency && count >= MAX_AGENTS_AGENCY) {
      return NextResponse.json(
        { error: `Agency accounts can have a maximum of ${MAX_AGENTS_AGENCY} agents per location.` },
        { status: 400 }
      );
    }

    agent = await prisma.aIAgent.create({
      data: {
        userId: u.id,
        locationId,
        agencyId,
        name: rest.name || "New Agent",
        role: rest.role || "CUSTOM",
        avatar: rest.avatar || "🤖",
        systemPrompt: rest.systemPrompt || "",
        tone: rest.tone || "friendly",
        order: count,
        triggerIntents: rest.triggerIntents || [],
        triggerStages: rest.triggerStages || [],
        triggerKeywords: rest.triggerKeywords || [],
      },
    });

    if (isAgency) {
      await notifyClientsByAgency(u.id, {
        type: "agent_added",
        title: `✨ New AI Agent Added`,
        message: `Your agency added "${agent.name}" to your AI sales team.`,
        data: { agentId: agent.id, agentName: agent.name, locationId },
      });
    }
  }

  return NextResponse.json({ success: true, agent });
}

// DELETE /api/agents
export async function DELETE(req: NextRequest) {
  const u = await getSession();
  if (!u?.id || u.role === "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId } = await req.json();
  const agent = await prisma.aIAgent.findFirst({ where: { id: agentId, userId: u.id } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.aIAgent.delete({ where: { id: agentId } });

  if (u.role === "agency") {
    await notifyClientsByAgency(u.id, {
      type: "agent_removed",
      title: `🗑️ AI Agent Removed`,
      message: `Your agency removed the "${agent.name}" agent from your sales team.`,
      data: { agentName: agent.name },
    });
  }

  return NextResponse.json({ success: true });
}
