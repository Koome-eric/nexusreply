/**
 * activateAIForContacts
 *
 * Correct execution order (fixes GHL 422):
 *   1. Load location + automation config
 *   2. For each contact:
 *      a. Find the SDR (first active agent) — BEFORE any GHL calls
 *      b. Fetch full contact details from GHL to get real email/phone
 *      c. Generate AI opening message for each enabled channel
 *      d. Validate message is non-empty
 *      e. Call initiateConversation (sends to GHL)
 *      f. Mark outboundStarted AFTER all channels succeed
 */

import { prisma } from "./db";
import { initiateConversation, generateOutboundMessage } from "./outbound";
import { findBestAgent } from "./handoff-engine";
import { notifyUser } from "./notify";
import { getValidTokenForLocation } from "./token-manager";

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

interface ContactToActivate {
  id:     string;
  name?:  string;
  email?: string;
  phone?: string;
}

interface ActivationResult {
  contactId: string;
  name:      string;
  sms:       "sent" | "skipped" | "failed" | "disabled";
  email:     "sent" | "skipped" | "failed" | "disabled";
  error?:    string;
}

export async function activateAIForContacts(
  userId:    string,
  locationId: string,
  contacts:  ContactToActivate[],
  agentId?:  string
): Promise<ActivationResult[]> {
  const results: ActivationResult[] = [];
  if (!contacts?.length) return results;

  // ── Load location ─────────────────────────────────────────────
  const location = await prisma.location.findFirst({
    where:  { id: locationId, userId },
    select: { ghlLocationId: true, automationEnabled: true, name: true },
  });

  if (!location?.automationEnabled) {
    return contacts.map(c => ({
      contactId: c.id, name: c.name || "Unknown",
      sms: "skipped", email: "skipped",
      error: "Automation not enabled for this location",
    }));
  }

  // ── Load automation config (which channels are ON) ────────────
  const config = await prisma.automationConfig.findUnique({
    where:  { locationId },
    select: { smsEnabled: true, emailEnabled: true, enabled: true },
  });

  if (!config?.enabled) {
    return contacts.map(c => ({
      contactId: c.id, name: c.name || "Unknown",
      sms: "skipped", email: "skipped",
      error: "Automation disabled in settings",
    }));
  }

  const smsOn   = config.smsEnabled;
  const emailOn = config.emailEnabled;

  if (!smsOn && !emailOn) {
    return contacts.map(c => ({
      contactId: c.id, name: c.name || "Unknown",
      sms: "disabled", email: "disabled",
      error: "No channels enabled — turn on SMS or Email in Settings",
    }));
  }

  // ── STEP 1: Get SDR agent ONCE upfront (before any GHL calls) ──
  let sdrAgent = agentId
    ? await prisma.aIAgent.findFirst({ where: { id: agentId, locationId, isActive: true } })
    : null;

  if (!sdrAgent) {
    // Find the SDR specifically — that's who sends first messages
    sdrAgent = await prisma.aIAgent.findFirst({
      where:   { locationId, isActive: true, role: "SDR" },
      orderBy: { order: "asc" },
    });
  }

  if (!sdrAgent) {
    // Fallback: any active agent
    sdrAgent = await findBestAgent(locationId, "NEW", "greeting");
  }

  if (!sdrAgent) {
    return contacts.map(c => ({
      contactId: c.id, name: c.name || "Unknown",
      sms: "failed", email: "failed",
      error: "No active AI agent configured for this location. Add agents in AI Sales Team settings.",
    }));
  }

  // ── STEP 2: Load business profile ONCE upfront ────────────────
  const businessProfile = await prisma.businessProfile.findUnique({
    where: { locationId },
  });

  const businessContext = businessProfile ? [
    `Business: ${businessProfile.businessName}`,
    `Industry: ${businessProfile.niche}`,
    `About: ${businessProfile.description || ""}`,
    `Products/Services: ${businessProfile.offers}`,
    businessProfile.faqs       ? `FAQs: ${businessProfile.faqs}`              : null,
    businessProfile.objections ? `Objection Handling: ${businessProfile.objections}` : null,
    businessProfile.customRules? `Special Rules: ${businessProfile.customRules}` : null,
    `ALWAYS reply in ${businessProfile.language || "English"}`,
  ].filter(Boolean).join("\n") : "";

  // ── STEP 3: Get GHL token ONCE upfront ───────────────────────
  const tokenData = await getValidTokenForLocation(location.ghlLocationId);
  if (!tokenData) {
    return contacts.map(c => ({
      contactId: c.id, name: c.name || "Unknown",
      sms: "failed", email: "failed",
      error: "No valid GHL connection — check your GHL OAuth in Locations settings",
    }));
  }

  // ── STEP 4: Process each contact ─────────────────────────────
  for (const contact of contacts) {
    const result: ActivationResult = {
      contactId: contact.id,
      name:      contact.name || "Unknown",
      sms:       smsOn   ? "skipped" : "disabled",
      email:     emailOn ? "skipped" : "disabled",
    };

    try {
      // Check if already activated
      const existingLead = await prisma.leadPipeline.findUnique({
        where:  { locationId_contactId: { locationId, contactId: contact.id } },
        select: { outboundStarted: true },
      });

      if (existingLead?.outboundStarted) {
        result.sms   = "skipped";
        result.email = "skipped";
        result.error = "Already activated";
        results.push(result);
        continue;
      }

      // Fetch fresh contact details from GHL to get real email/phone
      let contactName  = contact.name  || "there";
      let contactEmail = contact.email || "";
      let contactPhone = contact.phone || "";

      try {
        const ghlContactRes = await fetch(`${GHL_BASE}/contacts/${contact.id}`, {
          headers: { Authorization: `Bearer ${tokenData.token}`, Version: GHL_VERSION },
        });
        if (ghlContactRes.ok) {
          const ghlData = await ghlContactRes.json();
          const c = ghlData.contact || ghlData;
          contactName  = c.firstName ? `${c.firstName} ${c.lastName || ""}`.trim() : c.name || contactName;
          contactEmail = c.email || contactEmail;
          contactPhone = c.phone || contactPhone;
        }
      } catch (fetchErr) {
        console.warn(`[activation] Could not fetch GHL contact ${contact.id}:`, fetchErr);
        // Continue with what we have
      }

      result.name = contactName;

      // ── SMS channel ─────────────────────────────────────────
      if (smsOn) {
        if (!contactPhone) {
          result.sms   = "failed";
          result.error = "No phone number for SMS";
          console.warn(`[activation] SMS skipped for ${contactName} — no phone`);
        } else {
          // GENERATE MESSAGE FIRST, then send
          const smsMessage = await generateOutboundMessage(
            sdrAgent, contactName, businessContext, "SMS"
          );

          console.log(`[activation] SMS message for ${contactName}: "${smsMessage.slice(0, 80)}"`);

          const smsRes = await initiateConversation(
            userId, locationId, location.ghlLocationId,
            contact.id, "SMS",
            smsMessage,
            sdrAgent.id,
            contactEmail,
            contactPhone,
            false     // don't mark outboundStarted yet — do it after all channels
          );
          result.sms = smsRes.success ? "sent" : "failed";
          if (!smsRes.success) result.error = smsRes.error;
        }
      }

      // ── Email channel ────────────────────────────────────────
      if (emailOn) {
        if (!contactEmail) {
          result.email = "failed";
          if (!result.error) result.error = "No email address for Email channel";
          console.warn(`[activation] Email skipped for ${contactName} — no email`);
        } else {
          // GENERATE EMAIL MESSAGE FIRST, then send
          const emailMessage = await generateOutboundMessage(
            sdrAgent, contactName, businessContext, "Email"
          );

          console.log(`[activation] Email message for ${contactName}: "${emailMessage.slice(0, 80)}"`);

          const emailRes = await initiateConversation(
            userId, locationId, location.ghlLocationId,
            contact.id, "Email",
            emailMessage,
            sdrAgent.id,
            contactEmail,
            contactPhone,
            false     // don't mark outboundStarted yet
          );
          result.email = emailRes.success ? "sent" : "failed";
          if (!emailRes.success && !result.error) result.error = emailRes.error;
        }
      }

      // ── Mark outboundStarted AFTER all channels succeed ──────
      const anySent = result.sms === "sent" || result.email === "sent";
      if (anySent) {
        await prisma.leadPipeline.upsert({
          where:  { locationId_contactId: { locationId, contactId: contact.id } },
          update: { outboundStarted: true, lastMessageAt: new Date() },
          create: {
            userId, locationId, contactId: contact.id,
            contactName:     contactName,
            contactEmail:    contactEmail || null,
            contactPhone:    contactPhone || null,
            stage:           "ENGAGED",
            outboundStarted: true,
            outboundChannel: smsOn && emailOn ? "Both" : smsOn ? "SMS" : "Email",
            assignedAgentId: sdrAgent!.id,
            lastMessageAt:   new Date(),
            messageCount:    (smsOn && result.sms === "sent" ? 1 : 0) + (emailOn && result.email === "sent" ? 1 : 0),
          },
        });

        // Update ConversationCache with real contact name now we have it
        if (anySent && contactName) {
          const convIds = [
            smsOn   && result.sms   === "sent" ? `outbound_${contact.id}_SMS`   : null,
            emailOn && result.email === "sent" ? `outbound_${contact.id}_Email` : null,
          ].filter(Boolean) as string[];
          
          await Promise.allSettled(convIds.map(cid =>
            prisma.conversationCache.updateMany({
              where: { ghlConversationId: cid },
              data: { contactName, contactEmail: contactEmail || null, contactPhone: contactPhone || null },
            })
          ));
        }

        // Notify account owner
        const channelDesc = [
          result.sms   === "sent" ? "SMS"   : null,
          result.email === "sent" ? "Email" : null,
        ].filter(Boolean).join(" & ");

        await notifyUser(userId, {
          type:    "ai_activated",
          title:   `🤖 AI activated for ${contactName}`,
          message: `${sdrAgent!.name} (SDR) has started a ${channelDesc} conversation with ${contactName}.`,
          data:    { contactId: contact.id, contactName, locationId, channels: channelDesc, agentName: sdrAgent!.name },
        }).catch(e => console.error("[activation] Notify error:", e));
      }

    } catch (err) {
      console.error(`[activation] Unexpected error for contact ${contact.id}:`, err);
      result.sms   = result.sms   === "skipped" ? "failed" : result.sms;
      result.email = result.email === "skipped" ? "failed" : result.email;
      result.error = err instanceof Error ? err.message : "Unknown error";
    }

    results.push(result);

    // Rate limit protection between contacts
    if (contacts.length > 1) await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

export async function activateSingleContact(
  userId:    string,
  locationId: string,
  contact:   ContactToActivate
): Promise<ActivationResult> {
  const results = await activateAIForContacts(userId, locationId, [contact]);
  return results[0] || {
    contactId: contact.id, name: contact.name || "Unknown",
    sms: "failed", email: "failed", error: "Activation failed",
  };
}
