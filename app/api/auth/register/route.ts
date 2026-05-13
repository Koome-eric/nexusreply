import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password || password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    const trialEndsAt = new Date(Date.now() + PLANS.trial.trialDays * 24 * 60 * 60 * 1000);

    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name:  name?.trim() || null,
        password: hashed,
        role: "user",                    // always start as "user" — onboarding sets real role
        subscription: {
          create: {
            plan: "trial",
            status: "trialing",
            trialEndsAt,
            trialMessagesLimit: PLANS.trial.trialMessages,
            locationLimit: PLANS.trial.locationLimit,
            monthlyMessageLimit: PLANS.trial.monthlyMessages,
            periodResetsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
