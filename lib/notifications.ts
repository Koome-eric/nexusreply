import { prisma } from "./db";
import { Prisma } from "@prisma/client";

export type NotificationType =
  | "pipeline_update"
  | "agent_handoff"
  | "new_message"
  | "trial_ending"
  | "plan_upgraded"
  | "new_lead"
  | "lead_won"
  | "ai_error"
  | "webhook_connected"
  | "outbound_complete";

// ✅ Use Prisma-compatible JSON type
type JsonData = Prisma.InputJsonValue;

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: JsonData
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ?? Prisma.JsonNull, // ✅ safe fallback
    },
  });
}

export async function notifyPipelineUpdate(
  userId: string,
  contactName: string,
  fromStage: string,
  toStage: string,
  agentName?: string
) {
  const stageEmoji: Record<string, string> = {
    NEW: "🆕",
    ENGAGED: "💬",
    QUALIFIED: "✅",
    BOOKING: "📅",
    CLOSING: "🔥",
    WON: "💰",
    LOST: "❌",
    NURTURE: "🌙",
  };

  return createNotification(
    userId,
    "pipeline_update",
    `Lead moved to ${toStage}`,
    `${contactName} moved from ${fromStage} → ${
      stageEmoji[toStage] || ""
    } ${toStage}${agentName ? ` (handled by ${agentName})` : ""}`,
    {
      fromStage,
      toStage,
      contactName,
      agentName: agentName ?? null,
    }
  );
}

export async function notifyAgentHandoff(
  userId: string,
  contactName: string,
  fromAgent: string,
  toAgent: string
) {
  return createNotification(
    userId,
    "agent_handoff",
    `Agent handoff: ${toAgent} took over`,
    `${contactName}'s conversation handed from ${fromAgent} to ${toAgent}`,
    {
      fromAgent,
      toAgent,
      contactName,
    }
  );
}

export async function notifyLeadWon(userId: string, contactName: string) {
  return createNotification(
    userId,
    "lead_won",
    "🎉 Lead converted!",
    `${contactName} has been marked as WON. Your AI closed the deal.`,
    {
      contactName,
    }
  );
}

export async function notifyNewLead(
  userId: string,
  contactName: string,
  channel: string
) {
  return createNotification(
    userId,
    "new_lead",
    `New lead via ${channel}`,
    `${contactName} just started a conversation. AI is handling it.`,
    {
      contactName,
      channel,
    }
  );
}

export async function notifyTrialEnding(userId: string, daysLeft: number) {
  return createNotification(
    userId,
    "trial_ending",
    `Trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    `Upgrade now to keep your AI running without interruption.`,
    {
      daysLeft,
    }
  );
}