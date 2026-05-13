import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getValidTokenForLocation } from "@/lib/token-manager";

import {
  searchGHLConversations,
  getConversationMessages,
  getEmailById,
  getContact,
} from "@/lib/ghl";

// ─────────────────────────────────────────────────────────────
// Category Logic
// ─────────────────────────────────────────────────────────────

function categorise(conv: {
  lastLog: {
    humanTookOver: boolean;
    createdAt: string;
    inputMessage: string;
  } | null;
  leadStage: string | null;
  lastMessageAt: string;
  outboundStarted: boolean;
}): "active" | "waiting_reply" | "human_needed" | "won" | "lost" | "new" {
  if (conv.leadStage === "WON") return "won";
  if (conv.leadStage === "LOST") return "lost";

  if (conv.lastLog?.humanTookOver) {
    return "human_needed";
  }

  const lastActivity = new Date(conv.lastMessageAt).getTime();
  const hoursSince = (Date.now() - lastActivity) / 3600000;

  // AI sent outbound but no reply for >24h
  if (conv.outboundStarted && hoursSince > 24) {
    return "waiting_reply";
  }

  // AI has interacted recently
  if (conv.lastLog) {
    return "active";
  }

  return "new";
}

// ─────────────────────────────────────────────────────────────
// GET: Fetch conversation list
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);

  const locationId = searchParams.get("locationId") || undefined;
  const sync = searchParams.get("sync") === "true";

  // ───────────────────────────────────────────────────────────
  // STEP 1: Load cached conversations
  // ───────────────────────────────────────────────────────────

  const cached = await prisma.conversationCache.findMany({
    where: {
      userId,
      ...(locationId && { locationId }),
    },
    orderBy: {
      lastMessageAt: "desc",
    },
    take: 100,
  });

  // ───────────────────────────────────────────────────────────
  // STEP 2: Enrich with AI + Lead data
  // ───────────────────────────────────────────────────────────

  const enriched = await Promise.all(
    cached.map(async (conv) => {
      const [lead, logCount] = await Promise.all([
        prisma.leadPipeline.findFirst({
          where: {
            locationId: conv.locationId || locationId,
            contactId: conv.contactId,
          },
          select: {
            stage: true,
            score: true,
            outboundStarted: true,
            messageCount: true,
            lastReplyAt: true,
            outboundChannel: true,
            assignedAgent: {
              select: {
                name: true,
                avatar: true,
                role: true,
              },
            },
          },
        }),

        prisma.aIMessageLog.count({
          where: {
            userId,
            contactId: conv.contactId,
          },
        }),
      ]);

      let logs = await prisma.aIMessageLog.findMany({
        where: {
          userId,
          conversationId: conv.ghlConversationId,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          inputMessage: true,
          aiResponse: true,
          messageType: true,
          humanTookOver: true,
          createdAt: true,
          intent: true,
          agent: {
            select: {
              name: true,
              avatar: true,
              role: true,
            },
          },
        },
      });

      // fallback by contactId
      if (!logs.length) {
        logs = await prisma.aIMessageLog.findMany({
          where: {
            userId,
            contactId: conv.contactId,
          },
          orderBy: {
            createdAt: "asc",
          },
          select: {
            inputMessage: true,
            aiResponse: true,
            messageType: true,
            humanTookOver: true,
            createdAt: true,
            intent: true,
            agent: {
              select: {
                name: true,
                avatar: true,
                role: true,
              },
            },
          },
        });
      }

      const lastLog = logs.length
        ? logs[logs.length - 1]
        : null;

      const category = categorise({
        lastLog: lastLog
          ? {
              humanTookOver: lastLog.humanTookOver,
              createdAt: lastLog.createdAt.toISOString(),
              inputMessage: lastLog.inputMessage,
            }
          : null,

        leadStage: lead?.stage || null,

        lastMessageAt:
          conv.lastMessageAt.toISOString(),

        outboundStarted:
          lead?.outboundStarted || false,
      });

      return {
        id: conv.id,
        ghlConversationId: conv.ghlConversationId,
        contactId: conv.contactId,
        contactName: conv.contactName,
        contactEmail: conv.contactEmail,
        contactPhone: conv.contactPhone,
        lastMessageAt:
          conv.lastMessageAt.toISOString(),

        status: conv.status,
        category,

        lead: lead
          ? {
              stage: lead.stage,
              score: lead.score,
              outboundStarted:
                lead.outboundStarted,
              messageCount: lead.messageCount,
              outboundChannel:
                lead.outboundChannel,
              assignedAgent:
                lead.assignedAgent,
              lastReplyAt:
                lead.lastReplyAt?.toISOString() ||
                null,
            }
          : null,

        lastLog: lastLog
          ? {
              inputMessage:
                lastLog.inputMessage,
              aiResponse:
                lastLog.aiResponse,
              messageType:
                lastLog.messageType,
              humanTookOver:
                lastLog.humanTookOver,
              createdAt:
                lastLog.createdAt.toISOString(),
              intent: lastLog.intent,
              agent: lastLog.agent,
            }
          : null,

        logs: logs.map((log) => ({
          inputMessage: log.inputMessage,
          aiResponse: log.aiResponse,
          messageType: log.messageType,
          humanTookOver:
            log.humanTookOver,
          createdAt:
            log.createdAt.toISOString(),
          intent: log.intent,
          agent: log.agent,
        })),

        totalMessages: logCount,
      };
    })
  );

  // ───────────────────────────────────────────────────────────
  // STEP 3: Optional GHL Sync
  // ───────────────────────────────────────────────────────────

  if (sync) {
    const locations = locationId
      ? await prisma.location.findMany({
          where: {
            id: locationId,
            userId,
          },
          select: {
            id: true,
            ghlLocationId: true,
          },
        })
      : await prisma.location.findMany({
          where: { userId },
          select: {
            id: true,
            ghlLocationId: true,
          },
        });

    await Promise.allSettled(
      locations.map(async (loc) => {
        const td = await getValidTokenForLocation(
          loc.ghlLocationId
        );

        if (!td) return;

        try {
          const convos =
            await searchGHLConversations(
              loc.ghlLocationId,
              td.token,
              50
            );

          // Upsert conversations
          await Promise.allSettled(
            convos.map((c) =>
              prisma.conversationCache.upsert({
                where: {
                  ghlConversationId: c.id,
                },

                update: {
                  locationId: loc.id,
                  lastMessageAt:
                    c.lastMessageDate
                      ? new Date(
                          c.lastMessageDate
                        )
                      : new Date(),
                },

                create: {
                  userId,
                  locationId: loc.id,
                  ghlConversationId: c.id,
                  contactId: c.contactId,
                  lastMessageAt:
                    c.lastMessageDate
                      ? new Date(
                          c.lastMessageDate
                        )
                      : new Date(),
                  status: "active",
                },
              })
            )
          );

          // Find missing contact data
          const needsEnrichment =
            await prisma.conversationCache.findMany({
              where: {
                locationId: loc.id,
                ghlConversationId: {
                  in: convos.map((c) => c.id),
                },

                OR: [
                  { contactName: null },
                  { contactEmail: null },
                ],
              },

              select: {
                ghlConversationId: true,
                contactId: true,
              },
            });

          await Promise.allSettled(
            needsEnrichment.map(async (row) => {
              try {
                const contact =
                  await getContact(
                    row.contactId,
                    td.token
                  );

                if (!contact) return;

                const name =
                  contact.firstName
                    ? `${contact.firstName} ${
                        contact.lastName || ""
                      }`.trim()
                    : contact.name || null;

                await prisma.conversationCache.update(
                  {
                    where: {
                      ghlConversationId:
                        row.ghlConversationId,
                    },

                    data: {
                      ...(name && {
                        contactName: name,
                      }),

                      ...(contact.email && {
                        contactEmail:
                          contact.email,
                      }),

                      ...(contact.phone && {
                        contactPhone:
                          contact.phone,
                      }),
                    },
                  }
                );
              } catch {
                // non-fatal
              }
            })
          );
        } catch (e) {
          console.error(
            `[conversations API] GHL sync failed for ${loc.ghlLocationId}:`,
            e
          );
        }
      })
    );

    const freshCached =
      await prisma.conversationCache.findMany({
        where: {
          userId,
          ...(locationId && { locationId }),
        },

        orderBy: {
          lastMessageAt: "desc",
        },

        take: 100,
      });

    return NextResponse.json({
      conversations: freshCached.map((c) => ({
        id: c.id,
        ghlConversationId:
          c.ghlConversationId,
        contactId: c.contactId,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        lastMessageAt:
          c.lastMessageAt.toISOString(),
        status: c.status,
        synced: true,
      })),

      synced: true,
    });
  }

  // ───────────────────────────────────────────────────────────
  // STEP 4: Counts
  // ───────────────────────────────────────────────────────────

  const counts = {
    all: enriched.length,

    active: enriched.filter(
      (c) => c.category === "active"
    ).length,

    waiting_reply: enriched.filter(
      (c) => c.category === "waiting_reply"
    ).length,

    human_needed: enriched.filter(
      (c) => c.category === "human_needed"
    ).length,

    won: enriched.filter(
      (c) => c.category === "won"
    ).length,

    new: enriched.filter(
      (c) => c.category === "new"
    ).length,
  };

  return NextResponse.json({
    conversations: enriched,
    counts,
  });
}

// ─────────────────────────────────────────────────────────────
// POST: Fetch Full Thread
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const {
    ghlConversationId,
    locationId,
  } = await req.json();

  if (!ghlConversationId) {
    return NextResponse.json(
      { error: "ghlConversationId required" },
      { status: 400 }
    );
  }

  const cached =
    await prisma.conversationCache.findUnique({
      where: {
        ghlConversationId,
      },

      select: {
        locationId: true,
        contactId: true,
        contactEmail: true,
      },
    });

  let ghlMessages: Array<{
    id: string;
    body: string;
    direction: string;
    messageType: string;
    dateAdded: string;
    attachments?: string[];
  }> = [];

  const resolvedLocationId =
    locationId || cached?.locationId;

  // ───────────────────────────────────────────────────────────
  // Fetch messages from GHL
  // ───────────────────────────────────────────────────────────

  if (resolvedLocationId) {
    try {
      const loc =
        await prisma.location.findUnique({
          where: {
            id: resolvedLocationId,
          },

          select: {
            ghlLocationId: true,
          },
        });

      if (loc) {
        const tokenData =
          await getValidTokenForLocation(
            loc.ghlLocationId
          );

        if (tokenData) {
          const rawMsgs =
            await getConversationMessages(
              ghlConversationId,
              tokenData.token,
              100
            );

          ghlMessages = await Promise.all(
            rawMsgs.map(async (m) => {
              let body = (m.body || "").trim();

              // fetch email body
              if (
                !body &&
                (
                  m.messageType === "Email" ||
                  m.type === "Email" ||
                  m.messageType === "EMAIL"
                )
              ) {
                try {
                  const emailData =
                    await getEmailById(
                      m.id,
                      tokenData.token
                    );

                  if (emailData?.body) {
                    body = emailData.body
                      .replace(/<[^>]+>/g, " ")
                      .replace(/&nbsp;/g, " ")
                      .replace(/&amp;/g, "&")
                      .replace(/&lt;/g, "<")
                      .replace(/&gt;/g, ">")
                      .replace(/\s+/g, " ")
                      .trim();
                  }
                } catch {
                  //
                }
              }

              return {
                id: m.id,

                body:
                  body || "(no content)",

                direction: String(
                  m.direction || "outbound"
                ),

                messageType: String(
                  m.messageType ||
                    m.type ||
                    "SMS"
                ),

                dateAdded: m.dateAdded,

                attachments:
                  m.attachments || [],
              };
            })
          );

          ghlMessages = ghlMessages.filter(
            (m) =>
              m.body !== "(no content)" ||
              m.attachments?.length
          );
        }
      }
    } catch (err) {
      console.error(
        "[conversations/POST] GHL thread fetch error:",
        err
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // AI Logs
  // ───────────────────────────────────────────────────────────

  const aiLogs =
    await prisma.aIMessageLog.findMany({
      where: {
        userId,
        conversationId: ghlConversationId,
      },

      orderBy: {
        createdAt: "asc",
      },

      take: 200,

      select: {
        id: true,
        inputMessage: true,
        aiResponse: true,
        messageType: true,
        humanTookOver: true,
        intent: true,
        confidence: true,
        agentAction: true,
        createdAt: true,

        agent: {
          select: {
            name: true,
            role: true,
            avatar: true,
          },
        },
      },
    });

  // ───────────────────────────────────────────────────────────
  // Unified Thread Type
  // ───────────────────────────────────────────────────────────

  let thread: Array<{
    id: string;
    body: string;
    direction: string;
    messageType: string;
    dateAdded: string;
    attachments: string[];

    aiLog: {
      intent?: string | null;
      confidence?: number | null;
      humanTookOver?: boolean;

      agent?: {
        name: string;
        role: string;
        avatar: string;
      } | null;
    } | null;
  }>;

  // ───────────────────────────────────────────────────────────
  // Use GHL messages if available
  // ───────────────────────────────────────────────────────────

  if (ghlMessages.length > 0) {
    thread = ghlMessages.map((m) => {
      const mTime = new Date(
        m.dateAdded
      ).getTime();

      const matchedLog = aiLogs.find((l) => {
        const lTime = new Date(
          l.createdAt
        ).getTime();

        const diff = Math.abs(
          mTime - lTime
        );

        return (
          diff < 30000 &&
          (
            l.aiResponse === m.body ||
            l.inputMessage === m.body ||
            diff < 5000
          )
        );
      });

      return {
        id: m.id,
        body: m.body,
        direction: m.direction,
        messageType: m.messageType,
        dateAdded: m.dateAdded,
        attachments: m.attachments || [],

        aiLog: matchedLog
          ? {
              intent:
                matchedLog.intent,

              confidence:
                matchedLog.confidence,

              humanTookOver:
                matchedLog.humanTookOver,

              agent: matchedLog.agent
                ? {
                    name:
                      matchedLog.agent.name,

                    role:
                      matchedLog.agent.role,

                    avatar:
                      matchedLog.agent
                        .avatar ?? "",
                  }
                : null,
            }
          : null,
      };
    });
  }

  // ───────────────────────────────────────────────────────────
  // Fallback: rebuild from AI logs
  // ───────────────────────────────────────────────────────────

  else {
    thread = aiLogs.flatMap((l) => {
      const msgs = [];

      if (
        l.inputMessage &&
        l.inputMessage !==
          "(outbound initiated)"
      ) {
        msgs.push({
          id: `log-in-${l.id}`,

          body: l.inputMessage,

          direction: "inbound",

          messageType: l.messageType,

          dateAdded:
            l.createdAt.toISOString(),

          attachments: [],

          aiLog: {
            intent: l.intent,
            confidence: l.confidence,
            humanTookOver: false,
            agent: null,
          },
        });
      }

      if (l.aiResponse) {
        msgs.push({
          id: `log-out-${l.id}`,

          body: l.aiResponse,

          direction: "outbound",

          messageType: l.messageType,

          dateAdded: new Date(
            l.createdAt.getTime() + 1000
          ).toISOString(),

          attachments: [],

          aiLog: {
            intent: l.intent,

            confidence: l.confidence,

            humanTookOver:
              l.humanTookOver,

            agent: l.agent
              ? {
                  name: l.agent.name,
                  role: l.agent.role,
                  avatar:
                    l.agent.avatar ?? "",
                }
              : null,
          },
        });
      }

      return msgs;
    });
  }

  // ───────────────────────────────────────────────────────────
  // Sort thread chronologically
  // ───────────────────────────────────────────────────────────

  thread.sort(
    (a, b) =>
      new Date(a.dateAdded).getTime() -
      new Date(b.dateAdded).getTime()
  );

  return NextResponse.json({
    thread,
    aiLogs,
    source:
      ghlMessages.length > 0
        ? "ghl"
        : "local",
  });
}