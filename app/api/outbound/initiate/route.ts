import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { initiateConversation, generateOutboundMessage } from "@/lib/outbound";
import { findBestAgent } from "@/lib/handoff-engine";

async function getUserId(req: NextRequest) {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string })?.id || null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { locationId, contactIds, channel, agentId } = await req.json();

  if (!locationId || !contactIds?.length || !channel) {
    return NextResponse.json({ error: "locationId, contactIds, and channel are required" }, { status: 400 });
  }

  const location = await prisma.location.findFirst({ where: { id: locationId, userId } });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const results: { contactId: string; success: boolean; message?: string; error?: string }[] = [];

  // Process contacts one by one with a small delay to avoid rate limits
  for (const contactId of contactIds) {
    try {
      // Get the agent
      let agent: any = null;
      if (agentId) {
        agent = await prisma.aIAgent.findUnique({ where: { id: agentId } });
      }
      if (!agent) {
        agent = await findBestAgent(locationId, "NEW", "greeting");
      }
      if (!agent) {
        results.push({ contactId, success: false, error: "No AI agent configured" });
        continue;
      }

      // Get business context
      const businessProfile = await prisma.businessProfile.findUnique({
        where: { locationId },
      });
      const businessContext = businessProfile
        ? `Business: ${businessProfile.businessName} | Niche: ${businessProfile.niche} | Offers: ${businessProfile.offers.slice(0, 200)}`
        : "";

      // Get contact name
      const contact = await prisma.leadPipeline.findUnique({
        where: { locationId_contactId: { locationId, contactId } },
        select: { contactName: true },
      });
      const contactName = contact?.contactName || "there";

      // Generate opening message
      const message = await generateOutboundMessage(
        agent,
        contactName,
        businessContext,
        channel
      );

      const result = await initiateConversation(
        userId,
        locationId,
        location.ghlLocationId,
        contactId,
        channel,
        message,
        agent.id
      );
      results.push({ contactId, ...result });
    } catch (error) {
      results.push({ 
        contactId, 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }

    // Small delay between sends
    await new Promise((r) => setTimeout(r, 800));
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({ success: true, results, summary: { succeeded, failed, total: contactIds.length } });
}
