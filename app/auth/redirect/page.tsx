/**
 * /auth/redirect  — server component
 * Landing point for Google OAuth.
 * • New users (role = "user" with no locations, first login) → /onboarding
 * • Returning users → their role's home panel
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

const ROLE_HOME: Record<string, string> = {
  admin:  "/admin",
  agency: "/agency",
  client: "/client",
  user:   "/dashboard",
};

export default async function AuthRedirectPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;

  if (!u?.id) redirect("/login");

  const role = u.role ?? "user";

  // If role is "user", check if they've ever connected a location
  // (proxy for having completed onboarding). New Google sign-ups won't have any.
  if (role === "user") {
    const locationCount = await prisma.location.count({ where: { userId: u.id } });
    const isNewUser     = locationCount === 0;

    // Also check createdAt — only show onboarding if account is very new (< 5 min)
    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { createdAt: true } });
    const ageMs = user ? Date.now() - user.createdAt.getTime() : Infinity;
    const isVeryNew = ageMs < 5 * 60 * 1000;  // 5 minutes

    if (isNewUser && isVeryNew) redirect("/onboarding");
  }

  redirect(ROLE_HOME[role] ?? "/dashboard");
}
