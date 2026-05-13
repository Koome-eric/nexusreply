/**
 * GET /api/ghl/messages/:conversationId
 *
 * Fetches live messages for a conversation directly from GHL and
 * merges them with local AI logs so the UI always shows a complete
 * thread — even when lead replies arrive via email/SMS without a
 * webhook firing (e.g. forwarded threads, delayed delivery, etc).
 *
 * Query params:
 *   locationId  (required) — internal DB location ID
 *   limit       (optional, default 30)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth-options";
import { prisma }                    from "@/lib/db";
import { getValidTokenForLocation }  from "@/lib/token-manager";
import { getConversationMessages, normaliseGHLMessages } from "@/lib/ghl";

export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = params;
  const { searchParams }   = new URL(req.url);
  const locationId         = searchParams.get("locationId");
  const limit              = parseInt(searchParams.get("limit") || "30", 10);

  if (!locationId) {
    return NextResponse.json({ error: "locationId required" }, { status: 400 });
  }

  // ── 1. Verify the location belongs to this user ───────────────
  const location = await prisma.location.findFirst({
    where: { id: locationId, userId },
    select: { ghlLocationId: true },
  });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  // ── 2. Get a valid GHL token ───────────────────────────────────
  const tokenData = await getValidTokenForLocation(location.ghlLocationId);
  if (!tokenData) {
    return NextResponse.json({ error: "No GHL token available" }, { status: 502 });
  }

  // ── 3. Fetch live messages from GHL ───────────────────────────
  let ghlMessages: ReturnType<typeof normaliseGHLMessages> = [];
  let ghlError: string | null = null;

  try {
    const raw = await getConversationMessages(conversationId, tokenData.token, limit);
    ghlMessages = normaliseGHLMessages(raw);
  } catch (e) {
    ghlError = (e as Error).message;
    console.error("[GHL Messages] GHL fetch failed:", ghlError);
  }

  // ── 4. Fetch local AI message logs for this conversation ──────
  const dbLogs = await prisma.aIMessageLog.findMany({
    where:   { userId, conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, inputMessage: true, aiResponse: true,
      messageType: true, intent: true, agentAction: true,
      humanTookOver: true, createdAt: true, confidence: true,
      agent: { select: { name: true, avatar: true, role: true } },
    },
  });

  // ── 5. Build a merged, deduped timeline ───────────────────────
  type TimelineMsg = {
    source:      "ghl" | "db";
    direction:   "inbound" | "outbound";
    body:        string;
    messageType: string;
    createdAt:   string;
    intent?:     string;
    agent?:      { name: string; avatar?: string | null; role: string } | null;
    confidence?: number | null;
    humanTookOver?: boolean;
  };

  const timeline: TimelineMsg[] = [];

  // Add GHL messages (source of truth for the full thread)
  for (const m of ghlMessages) {
    timeline.push({
      source:      "ghl",
      direction:   m.direction,
      body:        m.body,
      messageType: m.messageType,
      createdAt:   m.createdAt,
    });
  }

  // Enrich with DB metadata (intent, agent, confidence) by fuzzy-matching
  // on body + approximate time (within 60s)
  for (const log of dbLogs) {
    const logTime = new Date(log.createdAt).getTime();

    // Try to find matching outbound GHL message
    const matchIdx = timeline.findIndex(m => {
      if (m.direction !== "outbound") return false;
      const tDiff = Math.abs(new Date(m.createdAt).getTime() - logTime);
      return tDiff < 60_000 && m.body.includes(log.aiResponse.slice(0, 40));
    });

    if (matchIdx >= 0) {
      // Enrich existing GHL message
      timeline[matchIdx] = {
        ...timeline[matchIdx],
        source:       "db",
        intent:       log.intent ?? undefined,
        agent:        log.agent,
        confidence:   log.confidence,
        humanTookOver: log.humanTookOver,
      };
    } else if (ghlMessages.length === 0) {
      // GHL fetch failed — fall back to DB-only messages
      timeline.push({
        source:      "db",
        direction:   "inbound",
        body:        log.inputMessage,
        messageType: log.messageType,
        createdAt:   log.createdAt.toISOString(),
        intent:      log.intent ?? undefined,
      });
      timeline.push({
        source:      "db",
        direction:   "outbound",
        body:        log.aiResponse,
        messageType: log.messageType,
        createdAt:   log.createdAt.toISOString(),
        agent:       log.agent,
        confidence:  log.confidence,
        humanTookOver: log.humanTookOver,
      });
    }
  }

  // Sort chronologically
  timeline.sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // ── 6. Pull contact memory for this conversation ──────────────
  const convCache = await prisma.conversationCache.findUnique({
    where: { ghlConversationId: conversationId },
    select: { contactId: true },
  });

  let memory = null;
  if (convCache?.contactId) {
    memory = await prisma.contactMemory.findUnique({
      where: { userId_contactId: { userId, contactId: convCache.contactId } },
      select: {
        stage: true, interests: true, objections: true,
        budget: true, notes: true, messageCount: true, lastIntent: true,
      },
    });
  }

  return NextResponse.json({
    conversationId,
    messages: timeline,
    memory,
    meta: {
      ghlCount:  ghlMessages.length,
      dbCount:   dbLogs.length,
      ghlError,
      fetchedAt: new Date().toISOString(),
    },
  });
}
