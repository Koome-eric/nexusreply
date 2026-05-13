"use client";

import { useState } from "react";
import Link from "next/link";

const SECTIONS = [
  {
    id: "getting-started",
    icon: "🚀",
    title: "Getting Started",
    items: [
      {
        id: "create-account",
        title: "Create Your Account",
        content: `**Step 1 — Sign Up**
Go to the register page and create your account with email/password or Google. Your 3-day free trial starts immediately — no credit card needed.

**Step 2 — Connect GoHighLevel**
Navigate to Dashboard → Locations → Click "Direct API Key" (recommended) or use OAuth.

**Direct API Key Method (fastest):**
1. Open GoHighLevel → go into the sub-account you want to connect
2. Settings → Private Integrations → + Add Key
3. Name it "NexusReply", enable all scopes → copy the key
4. Find your Location ID in the URL: \`app.gohighlevel.com/location/YOUR_ID/dashboard\`
5. Paste both into NexusReply → Connect

When you connect, NexusReply automatically:
- Registers a webhook in GHL to receive messages
- Creates an "AI Sales System" pipeline in GHL
- Sets up your 4 default AI agents

**Step 3 — Train Your AI**
Go to Dashboard → AI Setup → select your location → fill in your business details, offers, FAQs, and objection responses.

**Step 4 — Enable Automation**
Go to Dashboard → Locations → toggle your location ON. Your AI is now live.`,
      },
      {
        id: "quick-test",
        title: "Test Your AI in 2 Minutes",
        content: `After connecting GHL and enabling automation:

1. Open GoHighLevel → go to any contact
2. Send yourself an SMS or email from that contact's record
3. Within 3 seconds, your AI agent will reply

**What you should see:**
- The reply appears in GHL conversations
- The lead moves in your "AI Sales System" pipeline
- A notification appears in NexusReply dashboard

**If no reply arrives:**
- Check that automation is toggled ON in Locations page
- Verify the webhook was registered (green status on location card)
- Ensure the contact is not DND or tagged "AI_DISABLED"`,
      },
    ],
  },
  {
    id: "ai-agents",
    icon: "👥",
    title: "AI Sales Team",
    items: [
      {
        id: "how-agents-work",
        title: "How AI Agents Work",
        content: `NexusReply gives you a complete AI sales team, not just a chatbot. Each agent has a specific role and automatically takes over at the right moment.

**Your 4 Default Agents:**

🤝 **Alex — Lead Qualifier (SDR)**
Handles new and early-stage leads. Asks qualifying questions, builds rapport, never discusses pricing. Activates when stage is NEW or ENGAGED.

📅 **Sarah — Appointment Setter**
Takes over qualified leads and pushes toward booking a call. Handles light objections. Activates when lead shows interest or mentions scheduling.

🔥 **Marcus — Sales Closer**
Handles hot leads asking about pricing, ready to buy. Answers pricing questions, handles final objections, drives the purchase decision. Activates on price_inquiry or buying_signal intents.

🌙 **Luna — Follow-Up Specialist**
Re-engages cold leads that have gone silent. Sends value-driven check-ins. Activates after 24+ hours of no response.

**Automatic Handoffs:**
When a lead says "how much does it cost?" — Marcus automatically takes over from whoever was handling the conversation. This happens in real-time, mid-conversation, with full context passed between agents.`,
      },
      {
        id: "create-agents",
        title: "Creating Custom Agents",
        content: `Go to Dashboard → AI Sales Team → click "+ New Agent"

**Required fields:**
- **Name** — Give your agent a human name (e.g., "Jordan", "Priya")
- **Role** — Choose from SDR, Setter, Closer, Follow-Up, or Custom
- **Avatar** — Pick an emoji that represents their personality
- **Instructions** — This is the agent's brain. Be detailed.

**Writing great agent instructions:**
\`\`\`
You are [Name], a [role] for [Business Name].

YOUR MISSION: [specific goal]

RULES:
- Never reveal you are AI
- Keep messages short and conversational
- [specific behavioral rules]

WHAT TO SAY WHEN:
- If they ask about price: [exact approach]
- If they object: [exact response style]
\`\`\`

**Trigger Configuration:**
- **Trigger Intents** — Which detected intents activate this agent
- **Trigger Stages** — Which pipeline stages this agent handles
- **Trigger Keywords** — Specific words that hand off to this agent

**Pro tip:** Use the "Auto-fill template" button to get a strong starting prompt, then customize it for your specific business.`,
      },
      {
        id: "pipeline-stages",
        title: "Pipeline Stages Explained",
        content: `NexusReply uses 8 stages that sync live with your GHL "AI Sales System" pipeline:

| Stage | Meaning | Default Agent |
|-------|---------|---------------|
| NEW | Just entered the pipeline | Alex (SDR) |
| ENGAGED | Replied, conversation started | Alex (SDR) |
| QUALIFIED | Shown genuine interest | Sarah (Setter) |
| BOOKING | Scheduling a call | Sarah (Setter) |
| CLOSING | Asking about price/ready to buy | Marcus (Closer) |
| WON | Deal closed | — |
| LOST | Not interested / unsubscribed | — |
| NURTURE | Cold, re-engagement needed | Luna (Follow-up) |

**Stage movement happens automatically based on:**
- What the lead says (intent detection)
- Lead score (accumulates with each positive interaction)
- Time since last response (triggers nurture after 24h)

**Manual movement:** In Dashboard → Pipeline, you can drag any lead to any stage and the GHL pipeline updates instantly.`,
      },
    ],
  },
  {
    id: "contacts",
    icon: "📱",
    title: "Contacts & Messaging",
    items: [
      {
        id: "inbound-messages",
        title: "Handling Inbound Messages",
        content: `When a contact sends an SMS or Email to your GHL location:

1. GHL receives the message
2. GHL fires a webhook to NexusReply
3. NexusReply checks: is this contact AI-enabled?
4. If yes → AI agent detects intent → generates reply
5. Reply sent back via GHL API within 1-3 seconds

**AI_ENABLED Control:**
By default, NexusReply responds to all inbound messages. To restrict to opt-in only, contacts need the "AI_ENABLED" tag in GHL.

To disable AI for a specific contact, add the tag: **AI_DISABLED**

**Contacts that are NEVER replied to:**
- Contacts with DND (Do Not Disturb) enabled
- Contacts tagged "AI_DISABLED"
- Outbound messages (prevents reply loops)
- Phone calls and voicemails (text only)`,
      },
      {
        id: "outbound-conversations",
        title: "Starting Outbound Conversations",
        content: `NexusReply can initiate the first message to your GHL contacts.

**Go to:** Dashboard → Pipeline → click any stage → select contacts → "Start Outbound"

Or use the Outbound page (coming in a future update).

**How it works:**
1. Select contacts from your GHL location
2. Choose SMS or Email
3. Choose which agent sends the opening message
4. NexusReply generates a human-like opening and sends it
5. Any replies are handled automatically by your AI pipeline

**Best practices:**
- Start with your SDR agent for cold outreach
- Use Email for professional/B2B leads
- Use SMS for faster response rates
- Don't blast more than 50 contacts at once — space it out

**GHL rate limits:** NexusReply adds a 0.8-second delay between messages to avoid spam flags.`,
      },
      {
        id: "channel-setup",
        title: "SMS & Email Setup in GHL",
        content: `NexusReply sends messages through your GHL account's connected channels.

**SMS (Twilio):**
- Must have Twilio connected in GHL Settings → Phone Numbers
- Your GHL location must have a purchased phone number
- Do NOT change the Twilio inbound webhook URL — GHL handles this automatically

**Email:**
- Must have email/SMTP connected in GHL Settings → Email Services
- Recommended: Mailgun or SendGrid connected in GHL
- NexusReply sends email replies through GHL's email API

**Testing your channels:**
1. Go to GHL → a contact → manually send yourself a test SMS from their record
2. Reply from your personal phone
3. NexusReply should auto-reply within 3 seconds

If no reply: Check automation is ON in NexusReply Locations page.`,
      },
    ],
  },
  {
    id: "pipeline",
    icon: "📊",
    title: "Pipeline & GHL Sync",
    items: [
      {
        id: "ghl-pipeline",
        title: "GHL Pipeline Sync",
        content: `When you connect a location, NexusReply automatically creates a pipeline called **"AI Sales System"** in your GHL account.

**What syncs:**
- Every time a lead's stage changes in NexusReply → their GHL opportunity moves to the matching stage
- This happens in real-time, within seconds of the stage change

**Viewing in GHL:**
Go to GHL → Opportunities → AI Sales System pipeline. You'll see your leads moving automatically as the AI works.

**If the pipeline wasn't created automatically:**
1. Go to Dashboard → Locations
2. Click "Configure" on your location
3. The pipeline creation retries on next webhook event

**Customizing pipeline stages:**
The 8 stages (New Lead → Engaged → Qualified → Booking → Closing → Won → Lost → Nurture) are fixed in the current version. Custom stages are coming in a future update.`,
      },
    ],
  },
  {
    id: "notifications",
    icon: "🔔",
    title: "Notifications",
    items: [
      {
        id: "notification-types",
        title: "Notification Types",
        content: `NexusReply sends you real-time notifications for important events. Click the 🔔 bell in your dashboard top bar.

**You'll be notified when:**
- 💬 A new lead sends their first message
- 🔄 An agent hands off to another agent
- 📊 A lead moves to a new pipeline stage
- 💰 A lead is marked as WON
- ⏳ Your trial is ending (3 days, 1 day, final day)
- 🔗 A new location is successfully connected
- ✅ An outbound campaign completes

**How notifications work:**
Notifications use Server-Sent Events (SSE) for real-time delivery. Your browser maintains a live connection and receives updates instantly — no page refresh needed.

**Mark as read:** Click any notification to mark it read. Click "Mark all read" to clear all.`,
      },
    ],
  },
  {
    id: "admin",
    icon: "🛡",
    title: "Admin Panel",
    items: [
      {
        id: "accessing-admin",
        title: "Accessing the Admin Panel",
        content: `The admin panel is only accessible to accounts with the "admin" role.

**To promote yourself to admin:**

Option 1 — Prisma Studio:
\`\`\`bash
npx prisma studio
# Open User table → find your account → set role to "admin" → Save
\`\`\`

Option 2 — SQL:
\`\`\`sql
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
\`\`\`

**Access the admin panel:** Go to \`/admin\` or click the 🛡 Admin link that appears in your sidebar after promotion.

**Admin capabilities:**
- See all users, their plans, and usage
- Set any user's plan (upgrade/downgrade)
- Suspend users
- Train global AI agent templates
- View platform-wide analytics (MRR, message volume, etc.)`,
      },
      {
        id: "agent-training",
        title: "Training AI Agents (Admin)",
        content: `As an admin, you control the quality of AI agents across your entire platform.

**Go to:** Admin → Agent Training

**What you can do:**
- Edit any global agent's system prompt
- Update tone, personality, and behavioral rules
- Add new objection handling scripts
- Load pre-built high-performance templates
- Track performance score per agent
- Add training notes for version history

**Best practices for training the Closer agent:**
1. Include specific objection responses with exact language
2. Define when to drop price vs. hold firm
3. Give 3-5 example scenarios with ideal responses
4. Set clear rules on what NOT to say
5. Test by sending a test message from a GHL contact

**Version control:** Every save increments the version number. Use Training Notes to document what changed and why.

**Global updates:** Saving an agent template updates it for all users on their default agents. Custom agents users have created are not affected.`,
      },
    ],
  },
  {
    id: "troubleshooting",
    icon: "🔧",
    title: "Troubleshooting",
    items: [
      {
        id: "ai-not-replying",
        title: "AI Not Replying to Messages",
        content: `**Check these in order:**

1. **Automation is OFF**
   Dashboard → Locations → is the toggle GREEN? If grey, enable it.

2. **No business profile**
   Dashboard → AI Setup → have you completed setup for this location? Look for the yellow "⚠ Needs AI setup" badge.

3. **Webhook not registered**
   Go to Dashboard → Locations → check if your location shows a webhook status. If it failed, try reconnecting the location.

4. **Trial exhausted**
   Check your trial usage in the sidebar. If at limit, upgrade your plan.

5. **Contact is DND**
   In GHL, check the contact's profile — if DND is enabled, NexusReply skips them.

6. **Checking logs**
   Dashboard → Analytics → Recent Activity shows all AI events including skipped messages and errors.`,
      },
      {
        id: "webhook-failed",
        title: "Webhook Registration Failed",
        content: `If your GHL location connected but webhook registration failed:

**Manual webhook setup in GHL:**
1. Go to GHL → Settings → Integrations → Webhooks
2. Click "+ Add Webhook"
3. URL: \`https://nexusreply.vercel.app/api/ghl/webhook\`
4. Select these events:
   - ✅ Inbound Message
   - ✅ Contact Created
   - ✅ Contact Updated  
   - ✅ Conversation Created
5. Save

**For Direct API Key connections:**
Some GHL private integration tiers don't allow webhook creation via API. Manual setup is required.

**Testing your webhook:**
Send a message to any contact in GHL. Check Dashboard → Analytics — if the message appears in Recent Activity, the webhook is working.`,
      },
      {
        id: "ghl-connection-issues",
        title: "GHL Connection Issues",
        content: `**"Invalid API key" error:**
- Make sure you're copying the full key from GHL Private Integrations
- The key should start with a long string (not "Bearer" or similar)
- Re-create the key in GHL and try again

**"Location not found" error:**
- Copy the Location ID directly from your GHL URL
- URL format: \`app.gohighlevel.com/location/LOCATION_ID/dashboard\`
- The ID is typically 20+ alphanumeric characters

**OAuth connection issues:**
- Make sure your redirect URI exactly matches what's set in GHL Marketplace app settings: \`https://nexusreply.vercel.app/leadconnector/oauth\`
- You must be logged into NexusReply before starting the OAuth flow
- Check Vercel function logs for detailed error messages

**Pipeline not created in GHL:**
- Your API key must have Opportunities read/write scope
- Try disconnecting and reconnecting the location`,
      },
    ],
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [activeItem, setActiveItem] = useState("create-account");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentSection = SECTIONS.find(s => s.id === activeSection);
  const currentItem = currentSection?.items.find(i => i.id === activeItem);

  const formatContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**") && !line.slice(2, -2).includes("**")) {
        return <h3 key={i} style={{ fontSize: "15px", fontWeight: 700, color: "#e2eaf4", marginTop: i > 0 ? "20px" : 0, marginBottom: "6px" }}>{line.slice(2, -2)}</h3>;
      }
      if (line.startsWith("| ") && line.endsWith(" |")) {
        return null; // handled below
      }
      if (line.startsWith("```")) {
        return null;
      }
      // Bold inline
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((p, j) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={j} style={{ color: "#e2eaf4", fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
        }
        return p;
      });

      if (line.startsWith("- ")) {
        return <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "6px", paddingLeft: "4px" }}>
          <span style={{ color: "#14b8a6", flexShrink: 0 }}>•</span>
          <span style={{ fontSize: "14px", color: "#7c9ab8", lineHeight: 1.65 }}>{rendered.slice(1)}</span>
        </div>;
      }
      if (line.startsWith("✅ ") || line.startsWith("❌ ")) {
        const icon = line[0] === "✅" ? "✅" : "❌";
        return <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "6px" }}>
          <span style={{ flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: "14px", color: "#7c9ab8", lineHeight: 1.65 }}>{line.slice(3)}</span>
        </div>;
      }
      if (line.trim() === "") return <div key={i} style={{ height: "10px" }} />;

      // Code block detection (simple)
      if (line.startsWith("   ") || line.match(/^\s{3,}/)) {
        return <code key={i} style={{ display: "block", fontFamily: "monospace", fontSize: "12px", color: "#14b8a6", background: "rgba(20,184,166,0.06)", padding: "2px 8px", borderRadius: "4px", marginBottom: "2px" }}>{line.trim()}</code>;
      }

      return <p key={i} style={{ fontSize: "14px", color: "#7c9ab8", lineHeight: 1.7, marginBottom: "4px" }}>{rendered}</p>;
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060c14", color: "#e2eaf4", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{ padding: "0 clamp(16px,4vw,32px)", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(6,12,20,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 50 }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>⚡</div>
          <span style={{ fontSize: "15px", fontWeight: 800, color: "#e2eaf4" }}>NexusReply</span>
          <span style={{ fontSize: "12px", color: "#445566", marginLeft: "2px" }}>/ Docs</span>
        </Link>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/pricing" style={{ textDecoration: "none", fontSize: "13px", color: "#7c9ab8" }}>Pricing</Link>
          <Link href="/register"><button style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#0d9488,#14b8a6)", color: "white", fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>Try Free</button></Link>
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <aside style={{ width: "240px", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "24px 0", position: "sticky", top: "60px", height: "calc(100vh - 60px)", overflowY: "auto" }}>
          {SECTIONS.map(section => (
            <div key={section.id} style={{ marginBottom: "4px" }}>
              <button onClick={() => { setActiveSection(section.id); setActiveItem(section.items[0].id); }}
                style={{ width: "100%", padding: "8px 20px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", fontWeight: 600, color: activeSection === section.id ? "#14b8a6" : "#7c9ab8", transition: "color 0.15s" }}>
                <span>{section.icon}</span>{section.title}
              </button>
              {activeSection === section.id && section.items.map(item => (
                <button key={item.id} onClick={() => setActiveItem(item.id)}
                  style={{ width: "100%", padding: "6px 20px 6px 42px", background: activeItem === item.id ? "rgba(20,184,166,0.06)" : "transparent", border: "none", borderLeft: `2px solid ${activeItem === item.id ? "#14b8a6" : "transparent"}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: "12px", color: activeItem === item.id ? "#14b8a6" : "#445566", transition: "all 0.15s", lineHeight: 1.4 }}>
                  {item.title}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Content */}
        <main style={{ flex: 1, padding: "clamp(24px,4vw,48px) clamp(24px,5vw,64px)", maxWidth: "760px" }}>
          {currentItem && (
            <div>
              <div style={{ marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#14b8a6", fontWeight: 600 }}>{currentSection?.icon} {currentSection?.title}</span>
              </div>
              <h1 style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "28px", color: "#e2eaf4" }}>
                {currentItem.title}
              </h1>
              <div style={{ lineHeight: 1.7 }}>
                {formatContent(currentItem.content)}
              </div>

              {/* Navigation between items */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "48px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", gap: "16px" }}>
                {(() => {
                  const allItems = SECTIONS.flatMap(s => s.items.map(i => ({ ...i, sectionId: s.id })));
                  const currentIdx = allItems.findIndex(i => i.id === activeItem);
                  const prev = currentIdx > 0 ? allItems[currentIdx - 1] : null;
                  const next = currentIdx < allItems.length - 1 ? allItems[currentIdx + 1] : null;
                  return (
                    <>
                      {prev ? (
                        <button onClick={() => { const sec = SECTIONS.find(s => s.id === prev.sectionId); setActiveSection(prev.sectionId); setActiveItem(prev.id); }}
                          style={{ padding: "10px 18px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#7c9ab8", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                          ← {prev.title}
                        </button>
                      ) : <div />}
                      {next ? (
                        <button onClick={() => { setActiveSection(next.sectionId); setActiveItem(next.id); }}
                          style={{ padding: "10px 18px", borderRadius: "9px", border: "1px solid rgba(20,184,166,0.25)", background: "rgba(20,184,166,0.06)", color: "#14b8a6", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                          {next.title} →
                        </button>
                      ) : <div />}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
