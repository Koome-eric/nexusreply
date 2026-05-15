/**
 * app/api/ghl/diagnose/route.ts  (ENHANCED + FIXED TYPES)
 *
 * Runs a live diagnostic against GoHighLevel using stored credentials.
 *
 * Tests performed:
 *  1. Token validity
 *  2. Location fetch
 *  3. Conversations list
 *  4. Message fetch
 *  5. Email body fetch
 *  6. Webhook registration
 *  7. AI email flow
 *  8. Critical inbound email fetch test
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getValidTokenForLocation } from "@/lib/token-manager";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

type TestResult = {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  data?: Record<string, unknown>;
};

async function ghlGet(path: string, token: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_VERSION,
    },
    cache: "no-store",
  });

  const text = await res.text();

  let json: Record<string, unknown> = {};

  try {
    json = JSON.parse(text);
  } catch {
    // ignore invalid JSON
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    text,
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const locationId = body.locationId;

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId required" },
      { status: 400 }
    );
  }

  const userRole =
    (session?.user as { role?: string })?.role ?? "user";

  let location;

  if (userRole === "client") {
    const membership = await prisma.locationMember.findFirst({
      where: {
        userId,
        locationId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    location = await prisma.location.findFirst({
      where: {
        id: locationId,
      },
      include: {
        ghlConnection: true,
        webhookReg: true,
      },
    });
  } else {
    location = await prisma.location.findFirst({
      where: {
        id: locationId,
        userId,
      },
      include: {
        ghlConnection: true,
        webhookReg: true,
      },
    });
  }

  if (!location) {
    return NextResponse.json(
      { error: "Location not found" },
      { status: 404 }
    );
  }

  const results: TestResult[] = [];
  const ghlLocationId = location.ghlLocationId;

  // ─────────────────────────────────────────────
  // TEST 1 — TOKEN
  // ─────────────────────────────────────────────

  let token = "";

  try {
    const tokenData = await getValidTokenForLocation(
      ghlLocationId
    );

    if (!tokenData?.token) {
      throw new Error("No token returned");
    }

    token = tokenData.token;

    const expiry = location.ghlConnection?.tokenExpiresAt;

    const minutesLeft = expiry
      ? Math.round(
          (expiry.getTime() - Date.now()) / 60000
        )
      : null;

    results.push({
      name: "1. Token retrieval",
      status: "pass",
      message:
        minutesLeft !== null
          ? `Token valid. Expires in ${minutesLeft} min.`
          : "Token retrieved successfully.",
      data: {
        tokenLength: token.length,
        expiresAt:
          expiry?.toISOString() ?? "unknown",
        minutesLeft:
          minutesLeft ?? "unknown",
      },
    });
  } catch (err) {
    results.push({
      name: "1. Token retrieval",
      status: "fail",
      message: `Cannot retrieve token: ${String(err)}`,
    });

    return NextResponse.json({ results });
  }

  // ─────────────────────────────────────────────
  // TEST 2 — LOCATION
  // ─────────────────────────────────────────────

  try {
    const r = await ghlGet(
      `/locations/${ghlLocationId}`,
      token
    );

    if (r.ok) {
      const loc = (
        r.json.location ?? r.json
      ) as Record<string, unknown>;

      results.push({
        name: "2. Location fetch",
        status: "pass",
        message: `Location "${String(
          loc.name ?? ghlLocationId
        )}" verified.`,
        data: {
          id: loc.id,
          name: loc.name,
          email: loc.email,
        },
      });
    } else {
      results.push({
        name: "2. Location fetch",
        status:
          r.status === 401 ? "fail" : "warn",
        message: `GHL returned HTTP ${r.status}`,
        data: {
          status: r.status,
          body: r.text.slice(0, 200),
        },
      });
    }
  } catch (err) {
    results.push({
      name: "2. Location fetch",
      status: "fail",
      message: String(err),
    });
  }

  // ─────────────────────────────────────────────
  // TEST 3 — CONVERSATIONS
  // ─────────────────────────────────────────────

  let latestConvId = "";
  let latestContactId = "";
  let allConvIds: string[] = [];

  try {
    const r = await ghlGet(
      `/conversations/search?locationId=${ghlLocationId}&limit=20&sortBy=last_message_date&sortOrder=desc`,
      token
    );

    if (r.ok) {
      const convs =
        (r.json.conversations as unknown[]) ?? [];

      allConvIds = convs
        .map((c) =>
          String(
            (c as Record<string, unknown>).id ??
              ""
          )
        )
        .filter(Boolean);

      if (convs.length > 0) {
        const first =
          convs[0] as Record<string, unknown>;

        latestConvId = String(first.id ?? "");
        latestContactId = String(
          first.contactId ?? ""
        );
      }

      results.push({
        name: "3. Conversations list",
        status: "pass",
        message: `Found ${convs.length} conversations.`,
        data: {
          latestConvId,
          latestContactId,
          count: convs.length,
        },
      });
    } else {
      results.push({
        name: "3. Conversations list",
        status: "fail",
        message: `HTTP ${r.status}`,
      });
    }
  } catch (err) {
    results.push({
      name: "3. Conversations list",
      status: "fail",
      message: String(err),
    });
  }

  // ─────────────────────────────────────────────
  // TEST 4 — MESSAGE FETCH
  // ─────────────────────────────────────────────

  let latestEmailMsgId = "";
  let hasInboundEmail = false;

  if (!latestConvId) {
    results.push({
      name: "4. Message fetch",
      status: "skip",
      message: "No conversations found.",
    });
  } else {
    try {
      const r = await ghlGet(
        `/conversations/${latestConvId}/messages?limit=10`,
        token
      );

      if (r.ok) {
        const msgs =
          (
            (
              r.json?.messages as {
                messages?: unknown[];
              }
            )?.messages ??
            (r.json?.messages as unknown[]) ??
            []
          ) as Record<string, unknown>[];

        const inbound = msgs.filter(
          (m) => m.direction === "inbound"
        );

        const emails = inbound.filter(
          (m) =>
            String(
              m.messageType ?? ""
            ).toUpperCase() === "EMAIL" ||
            String(
              m.type ?? ""
            ).toUpperCase() === "EMAIL"
        );

        if (emails.length > 0) {
          const latest =
            emails[
              emails.length - 1
            ] as Record<string, unknown>;

          latestEmailMsgId = String(
            latest.id ?? ""
          );

          hasInboundEmail = true;
        }

        results.push({
          name: "4. Message fetch",
          status: "pass",
          message: `Found ${msgs.length} messages.`,
          data: {
            total: msgs.length,
            inbound: inbound.length,
            inboundEmails: emails.length,
            latestEmailMsgId,
          },
        });
      } else {
        results.push({
          name: "4. Message fetch",
          status: "fail",
          message: `HTTP ${r.status}`,
        });
      }
    } catch (err) {
      results.push({
        name: "4. Message fetch",
        status: "fail",
        message: String(err),
      });
    }
  }

  // ─────────────────────────────────────────────
  // TEST 5 — EMAIL BODY FETCH
  // ─────────────────────────────────────────────

  if (!hasInboundEmail || !latestEmailMsgId) {
    results.push({
      name: "5. Email body fetch",
      status: "skip",
      message:
        "No inbound email available to test.",
    });
  } else {
    try {
      const r = await ghlGet(
        `/conversations/messages/email/${latestEmailMsgId}`,
        token
      );

      if (r.ok) {
        const emailData =
          r.json as Record<string, unknown>;

        const body = String(
          emailData.body ?? ""
        ).trim();

        results.push({
          name: "5. Email body fetch",
          status: body ? "pass" : "warn",
          message: body
            ? "Email body fetched successfully."
            : "Email body empty.",
          data: {
            bodyLength: body.length,
            bodyPreview: body.slice(0, 200),
          },
        });
      } else {
        results.push({
          name: "5. Email body fetch",
          status: "fail",
          message: `HTTP ${r.status}`,
        });
      }
    } catch (err) {
      results.push({
        name: "5. Email body fetch",
        status: "fail",
        message: String(err),
      });
    }
  }

  // ─────────────────────────────────────────────
  // TEST 6 — WEBHOOK REGISTRATION
  // ─────────────────────────────────────────────

  try {
    const existingReg = location.webhookReg;

    results.push({
      name: "6. Webhook registration",
      status:
        existingReg?.isActive
          ? "pass"
          : "warn",
      message: existingReg?.isActive
        ? "Webhook registered and active."
        : "Webhook inactive or missing.",
      data: {
        webhookId:
          existingReg?.ghlWebhookId,
        url: existingReg?.url,
        events: existingReg?.events,
      },
    });
  } catch (err) {
    results.push({
      name: "6. Webhook registration",
      status: "warn",
      message: String(err),
    });
  }

  // ─────────────────────────────────────────────
  // TEST 7 — AI EMAIL FLOW
  // ─────────────────────────────────────────────

  try {
    const recentAILogs =
      await prisma.aIMessageLog.findMany({
        where: {
          locationId: location.id,
          messageType: {
            in: ["EMAIL", "Email", "email"],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      });

    results.push({
      name: "7. AI email flow",
      status:
        recentAILogs.length > 0
          ? "pass"
          : "warn",
      message:
        recentAILogs.length > 0
          ? `Found ${recentAILogs.length} AI email logs.`
          : "No AI email logs found.",
      data: {
        count: recentAILogs.length,
      },
    });
  } catch (err) {
    results.push({
      name: "7. AI email flow",
      status: "warn",
      message: String(err),
    });
  }

  // ─────────────────────────────────────────────
  // TEST 8 — CRITICAL EMAIL FETCH TEST
  // ─────────────────────────────────────────────

  try {
    let emailConvId = "";
    let emailMsgId = "";
    let totalInboundEmails = 0;

    for (const convId of allConvIds.slice(0, 10)) {
      const msgR = await ghlGet(
        `/conversations/${convId}/messages?limit=20`,
        token
      );

      const msgs =
        (
          (
            msgR.json?.messages as {
              messages?: unknown[];
            }
          )?.messages ??
          (msgR.json?.messages as unknown[]) ??
          []
        ) as Record<string, unknown>[];

      const inboundEmails = msgs.filter(
        (m) =>
          m.direction === "inbound" &&
          (
            String(
              m.messageType ?? ""
            ).toUpperCase() === "EMAIL" ||
            String(
              m.type ?? ""
            ).toUpperCase() === "EMAIL"
          )
      );

      totalInboundEmails +=
        inboundEmails.length;

      if (
        inboundEmails.length > 0 &&
        !emailConvId
      ) {
        const latest =
          inboundEmails[
            inboundEmails.length - 1
          ] as Record<string, unknown>;

        emailConvId = convId;
        emailMsgId = String(
          latest.id ?? ""
        );
      }
    }

    if (!emailConvId || !emailMsgId) {
      results.push({
        name: "8. Critical email fetch",
        status: "skip",
        message:
          "No inbound email conversations found.",
      });
    } else {
      const emailR = await ghlGet(
        `/conversations/messages/email/${emailMsgId}`,
        token
      );

      if (!emailR.ok) {
        results.push({
          name: "8. Critical email fetch",
          status: "fail",
          message: `HTTP ${emailR.status}`,
          data: {
            emailConvId,
            emailMsgId,
          },
        });
      } else {
        const body = String(
          emailR.json.body ?? ""
        )
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        results.push({
          name: "8. Critical email fetch",
          status: body ? "pass" : "warn",
          message: body
            ? "Inbound email body resolved successfully."
            : "Email body empty.",
          data: {
            emailConvId,
            emailMsgId,
            bodyLength: body.length,
            bodyPreview: body.slice(0, 300),
            totalInboundEmails,
          },
        });
      }
    }
  } catch (err) {
    results.push({
      name: "8. Critical email fetch",
      status: "fail",
      message: String(err),
    });
  }

  // ─────────────────────────────────────────────
  // TEST 9 — AUTOMATION STATUS
  // ─────────────────────────────────────────────

  try {
    const automationCfg = await prisma.automationConfig.findUnique({
      where: { locationId: location.id },
    });

    const automationOn =
      location.automationEnabled !== false &&
      (!automationCfg || automationCfg.enabled !== false);

    results.push({
      name: "9. Automation status",
      status: automationOn ? "pass" : "warn",
      message: automationOn
        ? "Automation is ENABLED — AI will reply to incoming messages."
        : "Automation is DISABLED. Go to Settings → toggle Automation ON to activate AI replies.",
      data: {
        locationAutomationEnabled: location.automationEnabled,
        configEnabled: automationCfg?.enabled ?? "no config (defaults to enabled)",
        emailEnabled:  automationCfg?.emailEnabled ?? true,
        smsEnabled:    automationCfg?.smsEnabled ?? true,
      },
    });
  } catch (err) {
    results.push({ name: "9. Automation status", status: "warn", message: String(err) });
  }

  // ─────────────────────────────────────────────
  // TEST 10 — RECENT WEBHOOK EVENTS
  // ─────────────────────────────────────────────

  try {
    const recentEvents = await prisma.webhookEvent.findMany({
      where: { locationId: location.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const last24h = recentEvents.filter(
      e => e.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    results.push({
      name: "10. Recent webhook events",
      status: last24h.length > 0 ? "pass" : "warn",
      message: last24h.length > 0
        ? `${last24h.length} webhook event(s) received in the last 24 hours.`
        : "No webhook events in last 24 hours. Check your GHL Workflow is published and the webhook URL is correct.",
      data: {
        totalEvents: recentEvents.length,
        last24hEvents: last24h.length,
        latest: recentEvents[0]
          ? {
              source: recentEvents[0].source,
              messageType: recentEvents[0].messageType,
              processed: recentEvents[0].processed,
              error: recentEvents[0].error,
              createdAt: recentEvents[0].createdAt.toISOString(),
              messagePreview: recentEvents[0].messageBody.slice(0, 100),
            }
          : null,
      },
    });
  } catch (err) {
    results.push({ name: "10. Recent webhook events", status: "fail", message: String(err) });
  }

  // ─────────────────────────────────────────────
  // TEST 11 — CONVERSATION CACHE
  // ─────────────────────────────────────────────

  try {
    const cachedConvs = await prisma.conversationCache.findMany({
      where: { locationId: location.id },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
    });

    results.push({
      name: "11. Conversation cache",
      status: cachedConvs.length > 0 ? "pass" : "warn",
      message: cachedConvs.length > 0
        ? `${cachedConvs.length} conversations cached. These appear on the Conversations page.`
        : "No conversations in cache. After a lead emails, it should appear here within seconds.",
      data: {
        count: cachedConvs.length,
        latest: cachedConvs[0]
          ? {
              contactName: cachedConvs[0].contactName,
              contactEmail: cachedConvs[0].contactEmail,
              lastMessageAt: cachedConvs[0].lastMessageAt.toISOString(),
              status: cachedConvs[0].status,
            }
          : null,
      },
    });
  } catch (err) {
    results.push({ name: "11. Conversation cache", status: "fail", message: String(err) });
  }

  // ─────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────

  const passed = results.filter(
    (r) => r.status === "pass"
  ).length;

  const failed = results.filter(
    (r) => r.status === "fail"
  ).length;

  const warned = results.filter(
    (r) => r.status === "warn"
  ).length;

  return NextResponse.json({
    results,
    summary: {
      passed,
      failed,
      warned,
      total: results.length,
    },
    location: {
      name: location.name,
      ghlLocationId,
    },
  });
}