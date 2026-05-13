import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidTokenForLocation } from "@/lib/token-manager";
import { activateAIForContacts } from "@/lib/activation";
import { resolveLocationAccess } from "@/lib/client-access";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

async function fetchContactsWithTag(
  ghlLocationId: string, token: string, tag?: string, limit = 50
): Promise<{ contacts: GHLContact[]; total: number }> {
  if (tag) {
    const res = await fetch(`${GHL_BASE}/contacts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: ghlLocationId,
        filters: [{ field: "tags", operator: "contains", value: tag }],
        pageLimit: limit, page: 1,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { contacts: data.contacts || [], total: data.total || 0 };
    }
    // Fallback: GET all + filter
    return fetchContactsBasic(ghlLocationId, token, limit, 1, tag);
  }
  return fetchContactsBasic(ghlLocationId, token, limit, 1);
}

type GHLContact = {
  id: string; firstName?: string; lastName?: string; name?: string;
  email?: string; phone?: string; tags?: string[];
  // GHL sometimes nests contact data differently — normalised below
  contact?: { email?: string; phone?: string };
};

async function fetchContactsBasic(
  ghlLocationId: string, token: string, limit: number, page: number, filterTag?: string
): Promise<{ contacts: GHLContact[]; total: number }> {
  const res = await fetch(
    `${GHL_BASE}/contacts/?locationId=${ghlLocationId}&limit=${limit}&skip=${(page - 1) * limit}`,
    { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION } }
  );
  if (!res.ok) throw new Error(`GHL contacts fetch failed: ${await res.text()}`);
  const data = await res.json();
  let contacts: GHLContact[] = data.contacts || [];
  if (filterTag) contacts = contacts.filter(c => (c.tags || []).includes(filterTag));
  return { contacts, total: filterTag ? contacts.length : (data.total || contacts.length) };
}

// ── GET — fetch contacts (and auto-activate ai_enabled ones) ──────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const page = parseInt(searchParams.get("page") || "1");
  const tag = searchParams.get("tag") || undefined;
  const search = searchParams.get("search") || undefined;
  // Pass ?activate=false to skip auto-activation (e.g. read-only views)
  const shouldActivate = searchParams.get("activate") !== "false";

  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = await prisma.location.findFirst({ where: { id: locationId, userId: access.ownerId } });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const tokenData = await getValidTokenForLocation(location.ghlLocationId);
  if (!tokenData) return NextResponse.json({ error: "No GHL connection" }, { status: 400 });

  let contacts: GHLContact[] = [];
  let total = 0;

  if (search) {
    const res = await fetch(
      `${GHL_BASE}/contacts/search?locationId=${location.ghlLocationId}&query=${encodeURIComponent(search)}&limit=50`,
      { headers: { Authorization: `Bearer ${tokenData.token}`, Version: GHL_VERSION } }
    );
    const data = res.ok ? await res.json() : {};
    contacts = data.contacts || [];
    total = data.total || contacts.length;
  } else {
    const result = await fetchContactsWithTag(location.ghlLocationId, tokenData.token, tag, 50);
    contacts = result.contacts;
    total = result.total;
  }

  // ── Auto-activate ai_enabled contacts ────────────────────────────
  // Trigger when tag === "ai_enabled" OR contacts in the result have the tag
  const aiEnabledContacts = contacts.filter(c => (c.tags || []).includes("ai_enabled"));
  let activationResults: Record<string, { sms: string; email: string }> = {};

  if (shouldActivate && aiEnabledContacts.length > 0 && location.automationEnabled) {
    // Fire activation in background — don't block the response
    activateAIForContacts(
      access.ownerId,
      locationId,
      aiEnabledContacts.map(c => ({
        id: c.id,
        name: c.firstName ? `${c.firstName} ${c.lastName || ""}`.trim() : c.name,
        email: c.email,
        phone: c.phone,
      }))
    ).then(results => {
      // Results logged server-side, not blocking client
      const activated = results.filter(r => r.sms === "sent" || r.email === "sent").length;
      if (activated > 0) {
        console.log(`[AutoActivation] ${activated}/${aiEnabledContacts.length} contacts activated for location ${locationId}`);
      }
    }).catch(e => console.error("[AutoActivation] Error:", e));

    // Build a quick status map for the UI
    activationResults = Object.fromEntries(
      aiEnabledContacts.map(c => [c.id, { sms: "activating", email: "activating" }])
    );
  }

  // Enrich with pipeline data
  const existingLeads = await prisma.leadPipeline.findMany({
    where: { locationId, contactId: { in: contacts.map(c => c.id) } },
    select: {
      contactId: true, outboundStarted: true, stage: true,
      score: true, lastIntent: true, lastMessageAt: true,
      assignedAgent: { select: { name: true } },
    },
  });
  const leadMap = new Map(existingLeads.map(l => [l.contactId, l]));

  const enriched = contacts.map(c => {
    const lead = leadMap.get(c.id);
    const isAIEnabled = (c.tags || []).includes("ai_enabled");
    const activation = activationResults[c.id];
    // GHL sometimes nests email under c.contact.email — normalise
    const email = c.email || (c as Record<string,unknown> as {contact?:{email?:string}}).contact?.email || "";
    const phone = c.phone || (c as Record<string,unknown> as {contact?:{phone?:string}}).contact?.phone || "";
    return {
      id: c.id,
      name: c.firstName ? `${c.firstName} ${c.lastName || ""}`.trim() : c.name || "Unknown",
      email,
      phone,
      tags: c.tags || [],
      stage: lead?.stage || "NEW",
      assignedAgent: lead?.assignedAgent?.name || "—",
      score: lead?.score || 0,
      lastActivity: lead?.lastMessageAt?.toISOString() || null,
      outboundStarted: lead?.outboundStarted || false,
      isAIEnabled,
      // Show "activating" status in UI if we just triggered it
      aiStatus: isAIEnabled
        ? (lead?.outboundStarted ? "active" : activation ? "activating" : "pending")
        : "off",
    };
  });

  return NextResponse.json({
    contacts: enriched,
    total,
    page,
    aiEnabledCount: aiEnabledContacts.length,
    activating: Object.keys(activationResults).length,
  });
}

// ── POST — manually activate a single contact ─────────────────────
export async function POST(req: NextRequest) {
  const { locationId, contactId, contactName, contactEmail, contactPhone } = await req.json();
  if (!locationId || !contactId) return NextResponse.json({ error: "locationId and contactId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = await prisma.location.findFirst({ where: { id: locationId, userId: access.ownerId } });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const results = await activateAIForContacts(access.ownerId, locationId, [{
    id: contactId,
    name: contactName,
    email: contactEmail,
    phone: contactPhone,
  }]);

  const result = results[0];
  if (!result) return NextResponse.json({ error: "Activation failed" }, { status: 500 });

  const activated = result.sms === "sent" || result.email === "sent";
  return NextResponse.json({
    success: activated,
    sms: result.sms,
    email: result.email,
    error: result.error,
    message: activated
      ? `AI activated via ${[result.sms === "sent" ? "SMS" : null, result.email === "sent" ? "Email" : null].filter(Boolean).join(" & ")}`
      : result.error || "Already activated or not eligible",
  });
}
