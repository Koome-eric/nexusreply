const BASE_URL              = "https://services.leadconnectorhq.com";
const GHL_VERSION           = "2021-07-28";   // conversations, messages, tasks, notes
const GHL_VERSION_CONTACTS  = "2021-07-28";   // contacts API (same version, both supported)

// ─── Core request helper ──────────────────────────────────────────
export async function ghlRequest(
  endpoint: string,
  method:   "GET" | "POST" | "PUT" | "DELETE",
  token:    string,
  body?:    Record<string, unknown>,
  version?: string
) {
  const payload = body ? JSON.stringify(body) : undefined;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      Version:        version || GHL_VERSION,
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: payload,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GHL API Error [${res.status}]: ${error}`);
  }

  return res.json();
}

// ─── Contacts ─────────────────────────────────────────────────────

/**
 * getContact
 * Returns the full contact object including email, phone, tags, name.
 * GHL docs: GET /contacts/:contactId
 * The response wraps the contact: { contact: { id, email, phone, ... } }
 * We unwrap it here so callers always get the flat contact object directly.
 */
export async function getContact(contactId: string, token: string) {
  const data = await ghlRequest(`/contacts/${contactId}`, "GET", token, undefined, GHL_VERSION_CONTACTS);
  // GHL wraps response as { contact: { id, email, phone, ... } } — always unwrap
  return data?.contact ?? data;
}

/**
 * getContactEmail
 * Convenience: reliably fetch just the email address for a contact.
 * Falls back gracefully if the contact has no email.
 */
export async function getContactEmail(contactId: string, token: string): Promise<string> {
  try {
    const data    = await ghlRequest(`/contacts/${contactId}`, "GET", token, undefined, GHL_VERSION_CONTACTS);
    const contact = data?.contact || data;
    return (contact?.email || "").trim();
  } catch (err) {
    console.error("[getContactEmail] Error:", err);
    return "";
  }
}

export async function updateContactTags(contactId: string, tags: string[], token: string) {
  return ghlRequest(`/contacts/${contactId}`, "PUT", token, { tags });
}

// ─── Conversations ────────────────────────────────────────────────

/**
 * getOrCreateConversation
 * GHL requires a conversationId to send messages reliably (especially email).
 * Search for an existing conversation first; if not found create one.
 */
export async function getOrCreateConversation(
  contactId:  string,
  locationId: string,   // GHL locationId (ghlLocationId)
  token:      string
): Promise<string> {
  // 1. Search for existing conversation
  try {
    const searchRes = await fetch(
      `${BASE_URL}/conversations/search?locationId=${locationId}&contactId=${contactId}&limit=1`,
      { headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: "application/json" } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const conversations = searchData.conversations || [];
      if (conversations.length > 0) {
        return conversations[0].id as string;
      }
    }
  } catch (err) {
    console.warn("[getOrCreateConversation] Search failed:", err);
  }

  // 2. Create new conversation if not found
  const createRes = await fetch(`${BASE_URL}/conversations/`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      Version:        GHL_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contactId, locationId }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`[getOrCreateConversation] Create failed: ${err}`);
  }

  const createData = await createRes.json();
  return (createData.conversation?.id || createData.id) as string;
}

/**
 * getConversationMessages
 * Returns the full message list for a conversation.
 * GHL returns: { messages: { messages: [...], nextPage: bool } }
 *
 * IMPORTANT: For email-type messages, the `body` field in the messages list
 * is always empty. We auto-fetch the real body via getEmailById for each
 * email message. This is the correct GHL pattern per their API docs.
 */
export async function getConversationMessages(
  conversationId: string,
  token:          string,
  limit = 20,
  enrichEmails = true   // set false to skip email enrichment (faster, for non-AI use)
): Promise<Array<{
  id: string;
  type: string;
  messageType: string;
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  from?: string;
  to?: string[];
  dateAdded: string;
  attachments?: string[];
}>> {
  try {
    const data = await ghlRequest(
      `/conversations/${conversationId}/messages?limit=${limit}`,
      "GET",
      token
    );
    // GHL nests messages under data.messages.messages OR data.messages
    const msgs: Record<string, unknown>[] = data?.messages?.messages || data?.messages || [];
    if (!Array.isArray(msgs)) return [];

    if (!enrichEmails) return msgs as never;

    // Auto-enrich email messages: body is always blank in the list response.
    // Must call GET /conversations/messages/email/:id to get the real body.
    const enriched = await Promise.all(
      msgs.map(async (msg) => {
        const msgType = String(msg.messageType || msg.type || "").toUpperCase();
        const isEmail = msgType === "EMAIL" || msgType === "TYPE_EMAIL";
        const hasBody = String(msg.body || "").trim().length > 0;

        if (isEmail && !hasBody && msg.id) {
          try {
            const emailData = await getEmailById(String(msg.id), token);
            if (emailData?.body) {
              return { ...msg, body: emailData.body, subject: emailData.subject, from: emailData.from, to: emailData.to };
            }
          } catch { /* keep original on failure */ }
        }
        return msg;
      })
    );

    return enriched as never;
  } catch (err) {
    console.error("[getConversationMessages] Error:", err);
    return [];
  }
}

/**
 * getEmailById
 * Fetch a specific email message by its GHL message ID.
 *
 * CRITICAL: Pass the TOP-LEVEL `id` field from the webhook payload.
 * GHL docs: GET /conversations/messages/email/{id}
 * Do NOT use `messageId` or `threadId` — those are different fields.
 *
 * Returns null on any error so callers can fall back gracefully.
 */
export async function getEmailById(messageId: string, token: string): Promise<{
  id: string;
  body: string;
  subject?: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  threadId: string;
  conversationId: string;
  contactId: string;
  dateAdded: string;
  attachments?: string[];
} | null> {
  if (!messageId) {
    console.warn("[getEmailById] Called with empty messageId — skipping");
    return null;
  }
  try {
    const data = await ghlRequest(`/conversations/messages/email/${messageId}`, "GET", token);
    if (!data) return null;

    // GHL sometimes returns HTML body — strip tags so AI gets clean text
    const rawBody = String(data.body || "");
    const body = rawBody.startsWith("<")
      ? rawBody
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim()
      : rawBody.trim();

    return { ...data, body };
  } catch (err) {
    console.error("[getEmailById] Error fetching email:", err);
    return null;
  }
}

/**
 * sendMessage
 * Sends SMS or Email via GHL Conversations API.
 *
 * CRITICAL NOTES from GHL docs:
 * - SMS: { type: "SMS", contactId, conversationId, message }
 * - Email: { type: "Email", contactId, conversationId, html, subject, emailFrom, emailTo }
 * - conversationId is required for both to ensure proper threading
 * - Email needs html field (NOT message)
 * - Never pass empty message body → GHL returns 422
 */
export async function sendMessage(
  contactId:       string,
  message:         string,
  type:            "SMS" | "Email",
  token:           string,
  ghlLocationId:   string,      // needed to get/create conversationId
  emailSubject?:   string,
  contactEmail?:   string,
  conversationId?: string       // if already known, skip lookup
) {
  // Hard guard — never send empty content to GHL
  const trimmed = (message || "").trim();
  if (!trimmed) {
    throw new Error(`[sendMessage] Blocked: empty message for contact ${contactId} (${type})`);
  }

  // Get or create the conversation thread
  let convId = conversationId;
  if (!convId) {
    convId = await getOrCreateConversation(contactId, ghlLocationId, token);
  }

  let body: Record<string, unknown>;

  if (type === "SMS") {
    body = {
      type:           "SMS",
      contactId,
      conversationId: convId,
      message:        trimmed,
    };
  } else {
    // Convert plain text → minimal HTML paragraphs
    const htmlBody = trimmed
      .split("\n")
      .filter(l => l.trim())
      .map(l => `<p>${l.trim()}</p>`)
      .join("");

    body = {
      type:           "Email",
      contactId,
      conversationId: convId,
      html:           htmlBody,
      subject:        emailSubject?.trim() || "Following up",
      ...(contactEmail ? { to: [contactEmail] } : {}),
    };
  }

  console.log(`[sendMessage] ${type} → contact ${contactId}, conv ${convId}`, JSON.stringify(body));

  return ghlRequest("/conversations/messages", "POST", token, body);
}

// ─── Tasks / Notes ────────────────────────────────────────────────
export async function addContactNote(contactId: string, note: string, token: string) {
  return ghlRequest(`/contacts/${contactId}/notes`, "POST", token, { body: note });
}

export async function createTask(contactId: string, title: string, dueDate: string, token: string) {
  return ghlRequest(`/contacts/${contactId}/tasks`, "POST", token, { title, dueDate, completed: false });
}

// ─── Token refresh ────────────────────────────────────────────────
export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://services.leadconnectorhq.com/oauth/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      client_id:     process.env.GHL_CLIENT_ID!,
      client_secret: process.env.GHL_CLIENT_SECRET!,
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

// ─── Conversation search (for sync) ──────────────────────────────
export async function searchGHLConversations(
  ghlLocationId: string,
  token:         string,
  limit = 50
): Promise<Array<{
  id: string; contactId: string; lastMessageDate?: string;
  type?: string; unreadCount?: number;
  contact?: { id: string; name?: string; firstName?: string; lastName?: string; email?: string; phone?: string };
}>> {
  try {
    const data = await ghlRequest(
      `/conversations/search?locationId=${ghlLocationId}&limit=${limit}&sortBy=last_message_date&sortOrder=desc`,
      "GET",
      token
    );
    return data?.conversations || [];
  } catch (err) {
    console.error("[searchGHLConversations] Error:", err);
    return [];
  }
}

// ─── normaliseGHLMessages ─────────────────────────────────────────
/**
 * normaliseGHLMessages
 * Converts raw GHL message objects (from getConversationMessages) into a
 * consistent shape for the UI. Required because GHL returns slightly different
 * field names depending on message type and API version.
 */
export function normaliseGHLMessages(
  raw: Array<{
    id: string;
    type?: string;
    messageType?: string;
    direction?: string;
    body?: string;
    subject?: string;
    from?: string;
    to?: string[];
    dateAdded?: string;
    attachments?: string[];
  }>
): Array<{
  id: string;
  messageType: string;
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  from?: string;
  to?: string[];
  createdAt: string;
  attachments: string[];
}> {
  return raw.map(m => ({
    id:          m.id,
    messageType: String(m.messageType || m.type || "SMS"),
    direction:   (m.direction === "inbound" ? "inbound" : "outbound") as "inbound" | "outbound",
    body:        String(m.body || ""),
    subject:     m.subject,
    from:        m.from,
    to:          m.to,
    createdAt:   m.dateAdded || new Date().toISOString(),
    attachments: m.attachments || [],
  }));
}