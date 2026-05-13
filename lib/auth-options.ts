import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import bcrypt from "bcryptjs";

async function getOrCreateGoogleUser(email: string, name: string | null | undefined) {
  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { subscription: true },
  });

  if (!user) {
    const trialEndsAt = new Date(Date.now() + PLANS.trial.trialDays * 24 * 60 * 60 * 1000);
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        password: null,
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
      include: { subscription: true },
    });
  }
  return user;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { prompt: "select_account" } },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
            include: { subscription: true },
          });
          if (!user) return null;
          if (!user.password) return null;
          const valid = await bcrypt.compare(credentials.password, user.password);
          if (!valid) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? "",
            role: user.role,
            plan: user.subscription?.plan ?? "trial",
            subStatus: user.subscription?.status ?? "trialing",
          } as { id: string; email: string; name: string; role: string; plan: string; subStatus: string };
        } catch (err) {
          console.error("Auth authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          await getOrCreateGoogleUser(user.email!, user.name);
          return true;
        } catch (err) {
          console.error("Google signIn error:", err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // Always refresh from DB on initial sign in OR when session is updated
      if (user || account || trigger === "update") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email! },
            include: { subscription: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;          // always read from DB — role changes take effect immediately
            token.plan = dbUser.subscription?.plan ?? "trial";
            token.subStatus = dbUser.subscription?.status ?? "trialing";
            if (dbUser.role === "client") {
              const membership = await prisma.locationMember.findFirst({
                where: { userId: dbUser.id },
                select: { locationId: true, ownerId: true },
              });
              token.locationId = membership?.locationId ?? null;
              token.ownerId    = membership?.ownerId    ?? null;
            }
          }
        } catch { /* fall through */ }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, string>).id = token.id as string;
        (session.user as Record<string, string>).role = token.role as string;
        (session.user as Record<string, string>).plan = token.plan as string;
        (session.user as Record<string, string>).subStatus = token.subStatus as string;
        if (token.locationId) (session.user as Record<string, string>).locationId = token.locationId as string;
        if (token.ownerId) (session.user as Record<string, string>).ownerId = token.ownerId as string;
      }
      return session;
    },
  },
};
