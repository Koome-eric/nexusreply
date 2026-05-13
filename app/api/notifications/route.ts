import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function getUserId(req: NextRequest) {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string })?.id || null;
}

// GET - fetch notifications
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const notifications = await prisma.notification.findMany({
    where: { userId, ...(unreadOnly && { read: false }) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { userId, read: false } });
  return NextResponse.json({ notifications, unreadCount });
}

// POST - mark as read
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { notificationId, markAllRead } = await req.json();
  if (markAllRead) {
    await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true, readAt: new Date() } });
  } else if (notificationId) {
    await prisma.notification.update({ where: { id: notificationId }, data: { read: true, readAt: new Date() } });
  }
  return NextResponse.json({ success: true });
}
