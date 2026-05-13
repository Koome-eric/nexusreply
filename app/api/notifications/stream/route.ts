import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout;
  let lastChecked = new Date();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial ping
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

      // Poll for new notifications every 5 seconds
      interval = setInterval(async () => {
        try {
          const newNotifs = await prisma.notification.findMany({
            where: { userId, createdAt: { gt: lastChecked }, read: false },
            orderBy: { createdAt: "desc" },
            take: 5,
          });

          if (newNotifs.length > 0) {
            lastChecked = new Date();
            for (const n of newNotifs) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "notification", notification: n })}\n\n`));
            }
          }

          // Heartbeat
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`));
        } catch { clearInterval(interval); }
      }, 5000);
    },
    cancel() { clearInterval(interval); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
