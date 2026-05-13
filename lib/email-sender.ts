/**
 * lib/email-sender.ts
 *
 * Sends email via Resend (REST API) or SMTP (native Node net/tls — no nodemailer).
 * Zero external dependencies beyond what Next.js already ships with.
 */

import * as net    from "net";
import * as tls    from "tls";
import * as crypto from "crypto";

export interface EmailProviderConfig {
  provider:     string;
  fromName:     string;
  fromEmail:    string;
  replyTo?:     string | null;
  resendApiKey?: string | null;
  smtpHost?:    string | null;
  smtpPort?:    number | null;
  smtpUser?:    string | null;
  smtpPass?:    string | null;
  smtpSecure?:  boolean;
}

export interface SendEmailOptions {
  to:       string;
  subject:  string;
  html:     string;
  text?:    string;
  replyTo?: string;
}

// ─────────────────────────────────────────────────────────────────
// RESEND  (REST API — simplest, most reliable)
// ─────────────────────────────────────────────────────────────────

async function sendViaResend(
  config: EmailProviderConfig,
  opts:   SendEmailOptions
): Promise<void> {
  if (!config.resendApiKey?.trim()) {
    throw new Error("Resend API key is missing. Paste it in the API Key field and save.");
  }
  if (!config.fromEmail?.trim()) {
    throw new Error("Sender email is required.");
  }

  const fromAddr = config.fromName?.trim()
    ? `${config.fromName.trim()} <${config.fromEmail.trim()}>`
    : config.fromEmail.trim();

  const payload = {
    from:    fromAddr,
    to:      [opts.to],
    subject: opts.subject,
    html:    opts.html,
    ...(opts.text                                ? { text:     opts.text }                               : {}),
    ...(opts.replyTo || config.replyTo?.trim()   ? { reply_to: opts.replyTo || config.replyTo }         : {}),
  };

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${config.resendApiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    // Resend returns { name, message, statusCode } on error
    const detail = body.message || body.error || JSON.stringify(body);

    // Make common errors human-readable
    if (res.status === 401) throw new Error(`Invalid Resend API key. Check it at resend.com/api-keys.`);
    if (res.status === 403) {
      if (String(detail).includes("domain")) {
        throw new Error(
          `Domain not verified in Resend. You must add and verify your domain at resend.com/domains ` +
          `before sending from ${config.fromEmail}. ` +
          `(Free accounts can send to any address from onboarding@resend.dev for testing.)`
        );
      }
      throw new Error(`Resend rejected the request (403): ${detail}`);
    }
    if (res.status === 422) throw new Error(`Invalid email address or payload: ${detail}`);
    throw new Error(`Resend error ${res.status}: ${detail}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// SMTP  (native Node net/tls — no nodemailer dependency)
// ─────────────────────────────────────────────────────────────────

/**
 * Minimal SMTP client that supports:
 *  - Plain connection with STARTTLS upgrade (port 587)
 *  - Direct TLS (port 465 / smtpSecure=true)
 *  - AUTH LOGIN (most SMTP servers including Gmail App Passwords)
 *  - AUTH PLAIN (fallback)
 *  - HTML + plain text multipart emails
 */
function smtpCommand(sock: net.Socket | tls.TLSSocket, cmd: string): void {
  sock.write(cmd + "\r\n");
}

function waitFor(
  sock: net.Socket | tls.TLSSocket,
  expectedCode: number,
  timeoutMs = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => {
      reject(new Error(`SMTP timeout waiting for ${expectedCode}`));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      // SMTP responses end with \r\n, multi-line end with "CODE " (space, not dash)
      const lines = buf.split("\r\n");
      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.slice(0, 3), 10);
        const isFinal = line[3] === " "; // dash = continuation, space = final
        if (isFinal && code === expectedCode) {
          clearTimeout(timer);
          sock.removeListener("data", onData);
          resolve(buf);
          return;
        }
        if (isFinal && code >= 400) {
          clearTimeout(timer);
          sock.removeListener("data", onData);
          reject(new Error(`SMTP ${code}: ${line.slice(4)}`));
          return;
        }
      }
    };

    sock.on("data", onData);
    sock.once("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

function buildMime(
  config:    EmailProviderConfig,
  opts:      SendEmailOptions,
  messageId: string
): string {
  const boundary = `boundary_${crypto.randomBytes(12).toString("hex")}`;
  const fromAddr = config.fromName?.trim()
    ? `"${config.fromName.trim()}" <${config.fromEmail.trim()}>`
    : config.fromEmail.trim();

  const replyTo = opts.replyTo || config.replyTo?.trim() || "";

  const b64html = Buffer.from(opts.html,       "utf8").toString("base64");
  const b64text = Buffer.from(opts.text || "", "utf8").toString("base64");

  const lines = [
    `From: ${fromAddr}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Message-ID: <${messageId}>`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64text || b64html,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64html,
    ``,
    `--${boundary}--`,
  ];

  return lines.join("\r\n");
}

async function sendViaSMTP(
  config: EmailProviderConfig,
  opts:   SendEmailOptions
): Promise<void> {
  const host    = config.smtpHost?.trim();
  const port    = config.smtpPort  || 587;
  const user    = config.smtpUser?.trim();
  const pass    = config.smtpPass?.trim();
  const secure  = config.smtpSecure || false;

  if (!host) throw new Error("SMTP host is required.");
  if (!user) throw new Error("SMTP username is required.");
  if (!pass) throw new Error("SMTP password is required.");
  if (!config.fromEmail?.trim()) throw new Error("Sender email is required.");

  const messageId = `${Date.now()}.${crypto.randomBytes(8).toString("hex")}@nexusreply`;
  const mime      = buildMime(config, opts, messageId);

  await new Promise<void>((resolve, reject) => {
    const done = (err?: Error) => { err ? reject(err) : resolve(); };

    // ── Connect ──────────────────────────────────────────────────
    let sock: net.Socket | tls.TLSSocket;

    const afterConnect = async (s: net.Socket | tls.TLSSocket) => {
      try {
        await waitFor(s, 220);
        smtpCommand(s, `EHLO nexusreply`);
        const ehlo = await waitFor(s, 250);

        // ── STARTTLS if not already TLS ───────────────────────────
        if (!secure && ehlo.includes("STARTTLS")) {
          smtpCommand(s, "STARTTLS");
          await waitFor(s, 220);

          // Upgrade socket to TLS
          const tlsSock = tls.connect({
            socket:             s as net.Socket,
            host,
            rejectUnauthorized: false,
          });
          await new Promise<void>((res, rej) => {
            tlsSock.once("secureConnect", res);
            tlsSock.once("error", rej);
          });
          smtpCommand(tlsSock, `EHLO nexusreply`);
          await waitFor(tlsSock, 250);
          return afterAuth(tlsSock);
        }

        return afterAuth(s);
      } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)));
      }
    };

    const afterAuth = async (s: net.Socket | tls.TLSSocket) => {
      try {
        // ── AUTH LOGIN ────────────────────────────────────────────
        smtpCommand(s, "AUTH LOGIN");
        await waitFor(s, 334);
        smtpCommand(s, Buffer.from(user!).toString("base64"));
        await waitFor(s, 334);
        smtpCommand(s, Buffer.from(pass!).toString("base64"));
        await waitFor(s, 235);

        // ── Send message ──────────────────────────────────────────
        smtpCommand(s, `MAIL FROM:<${config.fromEmail!.trim()}>`);
        await waitFor(s, 250);

        smtpCommand(s, `RCPT TO:<${opts.to}>`);
        await waitFor(s, 250);

        smtpCommand(s, "DATA");
        await waitFor(s, 354);

        s.write(mime + "\r\n.\r\n");
        await waitFor(s, 250);

        smtpCommand(s, "QUIT");
        s.destroy();
        done();
      } catch (err) {
        s.destroy();
        const msg = err instanceof Error ? err.message : String(err);
        // Translate common SMTP codes
        if (msg.includes("535") || msg.includes("534")) {
          done(new Error(
            `Authentication failed (535). ` +
            (host?.includes("gmail")
              ? `Gmail requires an App Password, not your Google account password. ` +
                `Generate one at myaccount.google.com/apppasswords.`
              : `Check your username and password.`)
          ));
        } else if (msg.includes("550")) {
          done(new Error(`Rejected by SMTP server (550): sender address or recipient not allowed.`));
        } else if (msg.includes("553")) {
          done(new Error(`Sender address rejected (553). Make sure the From Email matches your SMTP account.`));
        } else {
          done(new Error(msg));
        }
      }
    };

    if (secure) {
      // Direct TLS (port 465)
      sock = tls.connect({ host, port, rejectUnauthorized: false }, () => afterConnect(sock));
    } else {
      // Plain + STARTTLS (port 587)
      sock = net.connect({ host, port }, () => afterConnect(sock));
    }

    sock.once("error", (err: Error) => {
      const msg = err.message || String(err);
      if (msg.includes("ECONNREFUSED")) {
        done(new Error(`Cannot connect to ${host}:${port}. Check the host and port.`));
      } else if (msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND")) {
        done(new Error(`Cannot reach ${host}. Check the SMTP host address.`));
      } else {
        done(new Error(`SMTP connection error: ${msg}`));
      }
    });

    sock.setTimeout(15000, () => {
      sock.destroy();
      done(new Error(`SMTP connection to ${host}:${port} timed out after 15s.`));
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────

export async function sendEmailViaProvider(
  config: EmailProviderConfig,
  opts:   SendEmailOptions
): Promise<void> {
  if (!config.fromEmail?.trim()) {
    throw new Error("No sender email configured. Fill in the From Email field and save.");
  }

  if (config.provider === "smtp") {
    return sendViaSMTP(config, opts);
  }

  // Default: Resend
  return sendViaResend(config, opts);
}

/** Fetch the EmailProvider config for a location from DB */
export async function getEmailProviderForLocation(locationId: string) {
  const { prisma } = await import("@/lib/db");
  return prisma.emailProvider.findUnique({ where: { locationId } });
}

/** Convert plain-text AI reply → clean HTML email */
export function plainTextToHtml(text: string, fromName?: string): string {
  const paragraphs = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `<p style="margin:0 0 14px;line-height:1.7;color:#1f2937;font-size:15px;">${l}</p>`)
    .join("");

  return `<!DOCTYPE html><html><body>
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 0;">
      ${fromName ? `<p style="font-size:13px;color:#9ca3af;margin:0 0 24px;">${fromName}</p>` : ""}
      ${paragraphs}
      <hr style="margin:32px 0;border:none;border-top:1px solid #f3f4f6;" />
      <p style="font-size:11px;color:#d1d5db;margin:0;">Sent via NexusReply AI</p>
    </div>
  </body></html>`;
}
