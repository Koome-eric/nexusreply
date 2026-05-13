/**
 * app/api/ghl/fetch-emails/route.ts
 *
 * Tests the EXACT pipeline used to fetch inbound email replies from GHL.
 * Diagnoses every possible failure point and returns what was found.
 *
 * GET ?locationId=xxx  — scan all recent conversations for inbound emails
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveLocationAccess }     from "@/lib/client-access";
import { prisma }                    from "@/lib/db";
import { getValidTokenForLocation }  from "@/lib/token-manager";

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
}

async function ghlFetch(path: string, token: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: "application/json" },
  });
  const text = await res.text();
  let json: Record<string,unknown> = {};
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = await prisma.location.findFirst({
    where:   { id: locationId, userId: access.ownerId },
    include: { ghlConnection: true, automationConfig: true },
  });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tokenData = await getValidTokenForLocation(location.ghlLocationId);
  if (!tokenData) return NextResponse.json({ error: "No GHL token" }, { status: 400 });
  const token = tokenData.token;

  const report: {
    step: string;
    status: "ok" | "fail" | "warn" | "info";
    detail: string;
    data?: unknown;
  }[] = [];

  // ── STEP 1: Fetch conversations ──────────────────────────────────
  const convR = await ghlFetch(
    `/conversations/search?locationId=${location.ghlLocationId}&limit=20&sortBy=lastMessageDate&sortOrder=desc`,
    token
  );

  if (!convR.ok) {
    report.push({ step: "1. Fetch conversations", status: "fail",
      detail: `GHL returned HTTP ${convR.status}. ${convR.status === 401 ? "Token is invalid." : convR.text.slice(0,150)}` });
    return NextResponse.json({ report });
  }

  const conversations = (convR.json.conversations as unknown[] || []) as Record<string,unknown>[];
  report.push({ step: "1. Fetch conversations", status: "ok",
    detail: `Found ${conversations.length} recent conversation(s)`, data: { count: conversations.length } });

  if (conversations.length === 0) {
    report.push({ step: "2. Inbound emails", status: "warn",
      detail: "No conversations found. Send an email to a lead first." });
    return NextResponse.json({ report });
  }

  // ── STEP 2: Scan each conversation for inbound emails ────────────
  const emailsFound: {
    convId: string; contactId: string; msgId: string;
    bodyFromList: string; bodyFromEndpoint: string;
    endpointStatus: number; fetchWorked: boolean;
    direction: string; dateAdded: string;
  }[] = [];

  let convScanned = 0;
  let emptyBodyCount = 0;
  let fetchWorkedCount = 0;
  let fetchFailedCount = 0;

  for (const conv of conversations.slice(0, 10)) {
    const convId    = String(conv.id    || "");
    const contactId = String(conv.contactId || "");
    if (!convId) continue;
    convScanned++;

    // Fetch messages for this conversation
    const msgR = await ghlFetch(`/conversations/${convId}/messages?limit=10`, token);
    if (!msgR.ok) continue;

    const msgs = (
      (msgR.json?.messages as {messages?: unknown[]})?.messages ??
      (msgR.json?.messages as unknown[]) ??
      []
    ) as Record<string,unknown>[];

    for (const msg of msgs) {
      const direction = String(msg.direction || "").toLowerCase();
      if (direction !== "inbound") continue;

      const rawType   = String(msg.messageType || msg.type || "").toUpperCase();
      const isEmail   = rawType === "EMAIL" || rawType === "TYPE_EMAIL";
      if (!isEmail) continue;

      const msgId       = String(msg.id || "");
      const bodyFromList = String(msg.body || "").trim();
      const dateAdded    = String(msg.dateAdded || "");

      let bodyFromEndpoint = "";
      let endpointStatus   = 0;
      let fetchWorked      = false;

      if (bodyFromList) {
        // Body already in list — rare but possible
        bodyFromEndpoint = bodyFromList;
        fetchWorked      = true;
        endpointStatus   = 200;
      } else {
        emptyBodyCount++;
        // Must fetch via email endpoint
        if (msgId) {
          const emailR = await ghlFetch(`/conversations/messages/email/${msgId}`, token);
          endpointStatus = emailR.status;
          if (emailR.ok) {
            const raw = String(emailR.json.body || "").trim();
            bodyFromEndpoint = raw.startsWith("<") ? htmlToText(raw) : raw;
            fetchWorked      = !!bodyFromEndpoint;
            if (fetchWorked) fetchWorkedCount++;
            else             fetchFailedCount++;
          } else {
            fetchFailedCount++;
          }
        }
      }

      emailsFound.push({ convId, contactId, msgId, bodyFromList, bodyFromEndpoint,
        endpointStatus, fetchWorked, direction, dateAdded });
    }
  }

  // ── STEP 3: Summarise findings ───────────────────────────────────
  if (emailsFound.length === 0) {
    report.push({ step: "2. Inbound emails in conversations", status: "warn",
      detail: `Scanned ${convScanned} conversation(s) — no inbound emails found. Have a lead reply to an email, then re-run.`,
      data: { convScanned } });
  } else {
    report.push({ step: "2. Inbound emails in conversations", status: "ok",
      detail: `Found ${emailsFound.length} inbound email message(s) across ${convScanned} conversation(s).`,
      data: { emailsFound: emailsFound.length, convScanned } });
  }

  if (emptyBodyCount > 0) {
    report.push({ step: "3. Body in messages list", status: "warn",
      detail: `${emptyBodyCount}/${emailsFound.length} inbound emails had empty body in the messages list — this is expected GHL behaviour. The fix is to call GET /conversations/messages/email/:id.`,
      data: { emptyBodyCount, totalEmails: emailsFound.length } });
  } else if (emailsFound.length > 0) {
    report.push({ step: "3. Body in messages list", status: "ok",
      detail: "All inbound email bodies were present in the messages list (unusual — usually empty)." });
  }

  if (fetchWorkedCount > 0) {
    report.push({ step: "4. Email body fetch via endpoint", status: "ok",
      detail: `✅ ${fetchWorkedCount}/${emptyBodyCount || 1} email bodies successfully fetched via GET /conversations/messages/email/:id. The fetch pipeline WORKS.` });
  } else if (fetchFailedCount > 0) {
    report.push({ step: "4. Email body fetch via endpoint", status: "fail",
      detail: `❌ Email body fetch FAILED for all ${fetchFailedCount} attempt(s). This is why replies are not reaching the AI. Check that your GHL token has the conversations.readonly scope.`,
      data: { fetchFailedCount } });
  }

  // ── STEP 4: Check webhook registration ──────────────────────────
  const webhookReg = await prisma.webhookRegistration.findUnique({ where: { locationId } });
  if (!webhookReg?.isActive) {
    report.push({ step: "5. Webhook registration", status: "fail",
      detail: "❌ No active webhook registered. GHL cannot push messages to your app. Go to Settings → Webhook to register it." });
  } else {
    report.push({ step: "5. Webhook registration", status: "ok",
      detail: `Webhook registered (ID: ${webhookReg.ghlWebhookId || "unknown"}). GHL will push InboundMessage events to your app.`,
      data: { url: webhookReg.url, events: webhookReg.events } });
  }

  // ── STEP 5: Check sync config ────────────────────────────────────
  const cfg = location.automationConfig;
  if (!cfg) {
    report.push({ step: "6. Automation config", status: "warn",
      detail: "No automation config found. The cron sync will skip this location. Go to Settings and save your config, or run Bootstrap." });
  } else if (!cfg.enabled) {
    report.push({ step: "6. Automation config", status: "fail",
      detail: "Automation is disabled in your Settings. Enable it so the AI can process inbound messages." });
  } else {
    report.push({ step: "6. Automation config", status: "ok",
      detail: `Automation enabled — SMS: ${cfg.smsEnabled}, Email: ${cfg.emailEnabled}` });
  }

  // ── STEP 6: Show the actual emails found ─────────────────────────
  const richEmails = emailsFound.slice(0, 5).map(e => ({
    conversationId: e.convId,
    contactId:      e.contactId,
    messageId:      e.msgId,
    dateAdded:      e.dateAdded,
    bodyInList:     e.bodyFromList  ? e.bodyFromList.slice(0, 100)  : "(empty — expected)",
    bodyFetched:    e.bodyFromEndpoint ? e.bodyFromEndpoint.slice(0, 200) : "(empty — PROBLEM)",
    fetchWorked:    e.fetchWorked,
    endpointStatus: e.endpointStatus,
  }));

  report.push({ step: "7. Email sample (latest 5)", status: "info",
    detail: emailsFound.length > 0
      ? `Showing ${richEmails.length} inbound email(s)`
      : "No inbound emails found yet",
    data: richEmails });

  // ── VERDICT ──────────────────────────────────────────────────────
  const hasFail = report.some(r => r.status === "fail");
  const verdict = hasFail
    ? "❌ Email fetch pipeline has failures — see steps above for what to fix."
    : emailsFound.length === 0
      ? "⚠️ No inbound emails found yet — have a lead reply to an email, then re-run this test."
      : fetchWorkedCount > 0
        ? "✅ Email fetch pipeline is working correctly. Emails from leads are being fetched."
        : "⚠️ Emails found but body could not be fetched — check GHL token scopes.";

  return NextResponse.json({ report, verdict, summary: { convScanned, emailsFound: emailsFound.length, fetchWorked: fetchWorkedCount, fetchFailed: fetchFailedCount } });
}
