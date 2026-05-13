/**
 * app/api/email-provider/route.ts
 * GET  → fetch current email provider config for a location
 * POST → save/update provider config
 * Supports both agency owners and client users via resolveLocationAccess
 */
import { NextRequest, NextResponse }  from "next/server";
import { prisma }                     from "@/lib/db";
import { resolveLocationAccess }      from "@/lib/client-access";

export async function GET(req: NextRequest) {
  const locationId = new URL(req.url).searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = await prisma.emailProvider.findUnique({ where: { locationId } });
  return NextResponse.json({ provider: provider ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { locationId, provider, fromName, fromEmail, replyTo,
          resendApiKey, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = body;

  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = {
    provider:    provider || "resend",
    fromName:    fromName  || "",
    fromEmail:   fromEmail || "",
    replyTo:     replyTo   || null,
    resendApiKey: resendApiKey || null,
    smtpHost:    smtpHost  || null,
    smtpPort:    smtpPort  ? Number(smtpPort) : 587,
    smtpUser:    smtpUser  || null,
    smtpPass:    smtpPass  || null,
    smtpSecure:  Boolean(smtpSecure),
    verified:    false,   // reset on each save until re-tested
    lastError:   null,
  };

  const result = await prisma.emailProvider.upsert({
    where:  { locationId },
    update: data,
    create: { locationId, ...data },
  });

  return NextResponse.json({ ok: true, provider: result });
}
