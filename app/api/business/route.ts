import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveLocationAccess } from "@/lib/client-access";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.businessProfile.findUnique({ where: { locationId } });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { locationId, ...rest } = data;
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.businessProfile.upsert({
    where: { locationId },
    update: { ...rest },
    create: {
      userId: access.ownerId,
      locationId,
      businessName: rest.businessName || "",
      niche: rest.niche || "",
      description: rest.description || "",
      offers: rest.offers || "",
      faqs: rest.faqs || "",
      objections: rest.objections || "",
      tone: rest.tone || "friendly",
      closingStyle: rest.closingStyle || "consultative",
      language: rest.language || "English",
      customRules: rest.customRules || null,
    },
  });

  return NextResponse.json({ success: true, profile });
}
