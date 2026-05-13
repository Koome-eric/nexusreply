import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function isAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  return user?.role === "admin" ? user.id! : null;
}

export async function GET(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        subscription: true,
        _count: { select: { locations: true, aiLogs: true } },
      },
    }),
    prisma.user.count(),
  ]);

  // Platform totals
  const [totalMessages, activeUsers, totalRevenue] = await Promise.all([
    prisma.aIMessageLog.count(),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.findMany({ where: { status: "active" }, select: { plan: true } }),
  ]);

  const revenueMap: Record<string, number> = { starter: 97, pro: 197, agency: 397 };
  const mrr = totalRevenue.reduce((sum, s) => sum + (revenueMap[s.plan] || 0), 0);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      plan: u.subscription?.plan || "none",
      status: u.subscription?.status || "none",
      locationCount: u._count.locations,
      messageCount: u._count.aiLogs,
      trialEndsAt: u.subscription?.trialEndsAt,
      createdAt: u.createdAt,
    })),
    total,
    page,
    stats: { totalMessages, activeUsers, mrr },
  });
}

export async function PATCH(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, action, plan } = await req.json();

  if (action === "make_admin") {
    await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });
  } else if (action === "remove_admin") {
    await prisma.user.update({ where: { id: userId }, data: { role: "user" } });
  } else if (action === "suspend") {
    await prisma.subscription.update({ where: { userId }, data: { status: "canceled" } });
  } else if (action === "set_plan" && plan) {
    const { PLANS } = await import("@/lib/plans");
    const p = PLANS[plan as keyof typeof PLANS];
    if (p) {
      await prisma.subscription.update({
        where: { userId },
        data: { plan, status: "active", locationLimit: p.locationLimit, monthlyMessageLimit: p.monthlyMessages },
      });
    }
  }

  return NextResponse.json({ success: true });
}
