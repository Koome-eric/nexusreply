import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { notifyAllUsers, notifyUsersWithRole } from "@/lib/notify";

async function isAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  return u?.role === "admin";
}

// ── GET — list all global agent templates ─────────────────────────
export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const agents = await prisma.globalAgentTemplate.findMany({ orderBy: { role: "asc" } });
  return NextResponse.json({ agents });
}

// ── POST — create or update global agent template ─────────────────
export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await req.json();
  const { id, ...rest } = data;

  if (id) {
    // ── UPDATE existing agent ──────────────────────────────────────
    const before = await prisma.globalAgentTemplate.findUnique({ where: { id } });
    const agent = await prisma.globalAgentTemplate.update({
      where: { id },
      data: { ...rest, version: { increment: 1 }, updatedAt: new Date() },
    });

    // Build the fields that changed to sync to user agents
    const syncFields: Record<string, unknown> = {};
    if (rest.systemPrompt !== undefined) syncFields.systemPrompt = rest.systemPrompt;
    if (rest.name !== undefined) syncFields.name = rest.name;
    if (rest.tone !== undefined) syncFields.tone = rest.tone;
    if (rest.avatar !== undefined) syncFields.avatar = rest.avatar;
    // Sync isActive: if admin deactivates global template → deactivate all user default agents of that role
    if (rest.isActive !== undefined) syncFields.isActive = rest.isActive;

    // Always sync to all users' default agents of this role
    if (Object.keys(syncFields).length > 0) {
      await prisma.aIAgent.updateMany({
        where: { role: agent.role, isDefault: true },
        data: syncFields,
      });
    }

    // Determine what changed for the notification message
    const changes: string[] = [];
    if (before?.name !== agent.name) changes.push(`renamed to ${agent.name}`);
    if (before?.systemPrompt !== agent.systemPrompt) changes.push("prompt updated");
    if (before?.tone !== agent.tone) changes.push(`tone changed to ${agent.tone}`);
    if (before?.isActive !== agent.isActive) changes.push(agent.isActive ? "reactivated" : "deactivated");
    const changeDesc = changes.length > 0 ? changes.join(", ") : "settings updated";

    // Notify all users about the change
    await notifyUsersWithRole(agent.role, {
      type: "agent_updated",
      title: `${agent.avatar || "🤖"} ${agent.name} has been updated`,
      message: `Your AI agent ${agent.name} (${agent.role}) was ${changeDesc} by the platform admin. ${!agent.isActive ? "This agent is now inactive." : "Changes are live."}`,
      data: { agentId: id, agentName: agent.name, agentRole: agent.role, changes },
    });

    return NextResponse.json({ success: true, agent });

  } else {
    // ── CREATE new agent template ──────────────────────────────────
    const agent = await prisma.globalAgentTemplate.create({ data: rest });

    // Notify ALL users that a new agent template is available
    await notifyAllUsers({
      type: "new_agent",
      title: `${rest.avatar || "🤖"} New AI Agent Available: ${rest.name}`,
      message: `A new agent "${rest.name}" (${rest.role}) has been added to the platform. Go to AI Sales Team to activate it for your locations.`,
      data: { agentName: rest.name, agentRole: rest.role },
    });

    return NextResponse.json({ success: true, agent });
  }
}

// ── DELETE — remove global agent template ─────────────────────────
export async function DELETE(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { agentId } = await req.json();
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

  const agent = await prisma.globalAgentTemplate.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Deactivate all user default agents of this role before deleting template
  await prisma.aIAgent.updateMany({
    where: { role: agent.role, isDefault: true },
    data: { isActive: false },
  });

  await prisma.globalAgentTemplate.delete({ where: { id: agentId } });

  // Notify all users that this agent has been removed
  await notifyAllUsers({
    type: "agent_removed",
    title: `${agent.avatar || "🤖"} ${agent.name} has been removed`,
    message: `The AI agent "${agent.name}" (${agent.role}) has been removed from the platform by the admin. Any locations using this agent as default have had it deactivated.`,
    data: { agentName: agent.name, agentRole: agent.role },
  });

  return NextResponse.json({ success: true });
}

// ── PATCH — push global agent to all user agents of same role ─────
export async function PATCH(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { agentId } = await req.json();

  const agent = await prisma.globalAgentTemplate.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Full sync — push ALL fields to user agents of same role
  const updated = await prisma.aIAgent.updateMany({
    where: { role: agent.role, isDefault: true },
    data: {
      systemPrompt: agent.systemPrompt,
      name: agent.name,
      tone: agent.tone,
      avatar: agent.avatar,
      isActive: agent.isActive,
    },
  });

  // Notify affected users
  await notifyUsersWithRole(agent.role, {
    type: "agent_synced",
    title: `${agent.avatar || "🤖"} ${agent.name} has been synced`,
    message: `The latest version of ${agent.name} (v${agent.version}) has been pushed to your account. Your AI sales team has been updated.`,
    data: { agentName: agent.name, agentRole: agent.role, version: agent.version },
  });

  return NextResponse.json({ success: true, usersUpdated: updated.count });
}
