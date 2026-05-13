import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role } = await req.json();
  const validRoles = ["agency", "user"];
  if (!validRoles.includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  await prisma.user.update({
    where: { id: u.id },
    data:  { role },
  });

  // If choosing agency, seed an empty AgencyProfile so their panel works immediately
  if (role === "agency") {
    await prisma.agencyProfile.upsert({
      where:  { userId: u.id },
      update: {},
      create: {
        userId:    u.id,
        agencyName: "My Agency",
        primaryColor:   "#14b8a6",
        secondaryColor: "#0f172a",
        accentColor:    "#8b5cf6",
      },
    });
  }

  const dest: Record<string, string> = { agency: "/agency", user: "/dashboard" };
  return NextResponse.json({ success: true, redirect: dest[role] });
}
