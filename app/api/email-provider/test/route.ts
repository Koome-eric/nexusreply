/**
 * app/api/email-provider/test/route.ts
 *
 * Accepts the full provider config + a testEmail address.
 * Saves the config first (so the user doesn't have to click Save separately),
 * then sends a real test email.
 * Returns a clear, human-readable error if anything fails.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/db";
import { resolveLocationAccess }    from "@/lib/client-access";
import { sendEmailViaProvider }     from "@/lib/email-sender";
import type { EmailProviderConfig } from "@/lib/email-sender";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    locationId, testEmail,
    // Full config sent alongside so save + test happen atomically
    provider, fromName, fromEmail, replyTo,
    resendApiKey, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure,
  } = body;

  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });
  if (!testEmail)  return NextResponse.json({ error: "testEmail required" },  { status: 400 });

  const access = await resolveLocationAccess(req, locationId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 1. Always save the latest config before testing ─────────────
  const saveData = {
    provider:     provider     || "resend",
    fromName:     fromName     || "",
    fromEmail:    fromEmail    || "",
    replyTo:      replyTo      || null,
    resendApiKey: resendApiKey || null,
    smtpHost:     smtpHost     || null,
    smtpPort:     smtpPort     ? Number(smtpPort) : 587,
    smtpUser:     smtpUser     || null,
    smtpPass:     smtpPass     || null,
    smtpSecure:   Boolean(smtpSecure),
    verified:     false,
    lastError:    null,
  };

  await prisma.emailProvider.upsert({
    where:  { locationId },
    update: saveData,
    create: { locationId, ...saveData },
  });

  // ── 2. Build config object for sending ──────────────────────────
  const config: EmailProviderConfig = saveData;

  // ── 3. Basic validation before hitting the network ──────────────
  if (!config.fromEmail) {
    return NextResponse.json({ error: "From Email is required — fill it in and try again." }, { status: 400 });
  }
  if (config.provider === "resend" && !config.resendApiKey) {
    return NextResponse.json({ error: "Resend API key is required — paste it in the API Key field." }, { status: 400 });
  }
  if (config.provider === "smtp") {
    if (!config.smtpHost) return NextResponse.json({ error: "SMTP Host is required." }, { status: 400 });
    if (!config.smtpUser) return NextResponse.json({ error: "SMTP Username is required." }, { status: 400 });
    if (!config.smtpPass) return NextResponse.json({ error: "SMTP Password is required." }, { status: 400 });
  }

  // ── 4. Send the test email ────────────────────────────────────── 
  try {
    await sendEmailViaProvider(config, {
      to:      testEmail,
      subject: "✅ Email Connected — NexusReply",
      html: `<!DOCTYPE html><html><body>
        <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;background:#f9fafb;border-radius:12px;">
          <h2 style="color:#14b8a6;margin:0 0 16px;">Email Connected 🎉</h2>
          <p style="color:#374151;line-height:1.7;margin:0 0 12px;">
            Your email provider is working correctly.
          </p>
          <p style="color:#374151;line-height:1.7;margin:0 0 24px;">
            NexusReply AI agents will now send emails from
            <strong>${fromName ? `${fromName} &lt;${fromEmail}&gt;` : fromEmail}</strong>.
          </p>
          <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated test from NexusReply.</p>
        </div>
      </body></html>`,
      text: `Email Connected! Your NexusReply provider is working. AI agents will send from ${fromEmail}.`,
    });

    // ── 5. Mark verified ──────────────────────────────────────────
    await prisma.emailProvider.update({
      where: { locationId },
      data:  { verified: true, lastTestedAt: new Date(), lastError: null },
    });

    return NextResponse.json({
      ok:      true,
      message: `Test email sent to ${testEmail}. Check your inbox.`,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // Save the exact error so it shows in the UI next load
    await prisma.emailProvider.update({
      where: { locationId },
      data:  { verified: false, lastError: msg.slice(0, 500) },
    }).catch(() => {});

    // Return the full error — the UI will show it verbatim
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
