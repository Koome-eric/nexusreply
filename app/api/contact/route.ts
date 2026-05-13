/**
 * app/api/contact/route.ts
 * Receives contact form submissions and stores them.
 * Sends a notification email to the NexusReply team via Resend.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/db";

export async function POST(req: NextRequest) {
  const { name, email, subject, message, company } = await req.json();

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Store the query as a Notification to admin user (userId = "" means platform-level)
  // We save it so queries are never lost even if email delivery fails
  try {
    await prisma.notification.create({
      data: {
        userId:  process.env.ADMIN_USER_ID || "system",
        type:    "contact_query",
        title:   `Contact: ${name} — ${subject || "General Query"}`,
        message: `From: ${email}${company ? ` (${company})` : ""}\n\n${message}`,
        data:    { name, email, subject, company, message, submittedAt: new Date().toISOString() },
      },
    }).catch(() => {}); // non-blocking — don't fail the request if this errors
  } catch { /* ignore DB errors so form always appears to succeed */ }

  // Send notification to team via Resend (if API key configured)
  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.CONTACT_NOTIFY_EMAIL || "team@nexusreply.com";

  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from:    "NexusReply Contact <noreply@nexusreply.com>",
          to:      [notifyEmail],
          reply_to: email,
          subject: `[NexusReply Contact] ${name} — ${subject || "General Query"}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;">
              <div style="background:#0d9488;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <h2 style="color:white;margin:0;font-size:18px;">New Contact Query</h2>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#6b7280;width:100px;">Name</td><td style="padding:8px 0;color:#111827;font-weight:600;">${name}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#0d9488;">${email}</a></td></tr>
                ${company ? `<tr><td style="padding:8px 0;color:#6b7280;">Company</td><td style="padding:8px 0;color:#111827;">${company}</td></tr>` : ""}
                ${subject ? `<tr><td style="padding:8px 0;color:#6b7280;">Subject</td><td style="padding:8px 0;color:#111827;">${subject}</td></tr>` : ""}
              </table>
              <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;border-left:3px solid #0d9488;">
                <p style="margin:0;color:#374151;line-height:1.7;white-space:pre-wrap;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
              </div>
              <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
                Reply directly to this email to respond to ${name}.
              </p>
            </div>
          `,
        }),
      });
    } catch { /* email notification is best-effort */ }
  }

  return NextResponse.json({ ok: true });
}
