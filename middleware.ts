import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Paths anyone can hit without being logged in
const PUBLIC_PATHS = [
  "/contact",
  "/login",
  "/register",
  "/pricing",
  "/docs",
  "/api/auth",
  "/api/webhook",
  "/api/billing/webhook",
  "/api/ghl/webhook",
  "/leadconnector",
  "/invite",
  "/api/invite",
  "/auth/redirect",
  "/onboarding",
  "/checkout",
  "/billing-success",
  "/api/billing/paystack-verify",
  "/api/billing/paystack-webhook",
  "/api/billing/paypal-webhook",
  "/",
];

// Where each role lives
const ROLE_HOME: Record<string, string> = {
  admin:  "/admin",
  agency: "/agency",
  client: "/client",
  user:   "/dashboard",
};

// Which path prefixes belong exclusively to which role
const ROLE_PREFIX: Record<string, string> = {
  admin:  "/admin",
  agency: "/agency",
  client: "/client",
  user:   "/dashboard",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // All API routes other than those listed above are allowed through —
  // they do their own auth checks via getServerSession
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Not logged in → send to login
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = (token.role as string) || "user";
  const home = ROLE_HOME[role] ?? "/dashboard";
  const ownPrefix = ROLE_PREFIX[role] ?? "/dashboard";

  // If user is already on their own panel, let them through
  if (pathname.startsWith(ownPrefix)) {
    return NextResponse.next();
  }

  // User is on someone else's panel — redirect to their own home
  const otherPrefixes = Object.values(ROLE_PREFIX).filter(p => p !== ownPrefix);
  const isOnWrongPanel = otherPrefixes.some(p => pathname.startsWith(p));
  if (isOnWrongPanel) {
    return NextResponse.redirect(new URL(home, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
