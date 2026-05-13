import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      locationId,
      contactId,
      contactName,
      phone,
      email,
      message,
      meta,
    } = await req.json();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            userId,
            locationId,
            contactId,
            channels: {
              sms: !!phone,
              email: !!email,
            },
            message: message || {
              sms: "Hey 👋 Just reaching out—how can I help?",
              email: {
                subject: "Quick question",
                body: `Hey ${contactName || ""},\n\nJust wanted to reach out and see how I can help.\n\nLet me know 👍`,
              },
            },
            meta: meta || {
              trigger: "ai_enabled_tag",
              source: "webhook",
            },
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("[AI START ERROR]", res.status, text);
        return NextResponse.json({ error: "AI start failed" }, { status: 500 });
      }

      console.log("[AI START SUCCESS]", contactId);

      return NextResponse.json({ success: true });
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.error("[AI START TIMEOUT]", contactId);
        return NextResponse.json({ error: "Timeout" }, { status: 504 });
      }

      console.error("[AI START FAILED]", err);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("Invalid request:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}