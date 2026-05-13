import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function isAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  return u?.role === "admin";
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
  const { id } = params;
  
  if (!id) return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
  
  try {
    await prisma.globalAgentTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 400 });
  }
}
