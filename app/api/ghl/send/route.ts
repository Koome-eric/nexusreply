import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { sendMessage } from "@/lib/ghl";
import { getValidTokenByUserId } from "@/lib/token-manager";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { contactId, message, type, subject } = await req.json();
  const token = await getValidTokenByUserId(userId);
  if (!token) return NextResponse.json({ error: "No GHL connection" }, { status: 400 });
  const result = await sendMessage(contactId, message, type || "SMS", token, subject);
  await prisma.aIMessageLog.create({
    data: { userId, contactId, conversationId: "manual", messageType: type || "SMS", inputMessage: "(manual)", aiResponse: message, wasOverridden: true, status: "sent" },
  });
  return NextResponse.json({ success: true, result });
}
