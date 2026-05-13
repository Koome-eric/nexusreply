# ⚡ NexusReply — AI Sales Engine for GoHighLevel

> Multi-tenant SaaS that automatically closes leads with human-like AI, replying via SMS & Email 24/7.

---

## Quick Start (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```

Fill in your `.env` file:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | [neon.tech](https://neon.tech) — free PostgreSQL |
| `NEXTAUTH_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) or your domain (prod) |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| `GHL_CLIENT_ID` + `GHL_CLIENT_SECRET` | GHL Marketplace Developer Portal |
| `STRIPE_*` keys | [dashboard.stripe.com](https://dashboard.stripe.com) |

### 3. Push database schema
```bash
npx prisma db push
```

### 4. Run locally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel
```bash
npx vercel --prod
```
Add all `.env` variables in Vercel → Project Settings → Environment Variables.

---

## GoHighLevel Setup

### Create a GHL Marketplace App
1. Go to [marketplace.gohighlevel.com](https://marketplace.gohighlevel.com) → Developer
2. Create new app
3. Set Redirect URI: `https://yourdomain.com/api/ghl/oauth/callback`
4. Request OAuth scopes:
   - `conversations.readonly` `conversations.write`
   - `contacts.readonly` `contacts.write`
   - `locations.readonly`
5. Copy Client ID + Secret to `.env`

### Set Up Webhooks in GHL
In each sub-account → Settings → Webhooks:
- **URL:** `https://yourdomain.com/api/webhook/message`
- **Events:** `InboundMessage` / Customer Replied

Webhook payload NexusReply expects:
```json
{
  "contactId": "abc123",
  "conversationId": "conv456",
  "message": "Hi, I'm interested",
  "type": "SMS",
  "locationId": "loc789"
}
```

---

## Stripe Setup

### Create products in Stripe Dashboard
1. Go to [dashboard.stripe.com/products](https://dashboard.stripe.com/products)
2. Create 3 products with monthly recurring prices:
   - **Starter** — $97/month
   - **Pro** — $197/month
   - **Agency** — $397/month
3. Copy each `price_xxx` ID to your `.env`

### Set up Stripe Webhook
1. Go to Stripe → Webhooks → Add endpoint
2. URL: `https://yourdomain.com/api/billing/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## First Admin Account

After registering your first account, promote it to admin via your database:

**Option A — Prisma Studio:**
```bash
npx prisma studio
# Open User table → find your user → change role to "admin"
```

**Option B — Direct SQL:**
```sql
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Architecture

```
Lead → GHL (SMS/Email)
     → Webhook → /api/webhook/message
     → Auth check (subscription, trial limits)
     → /api/ai/process
         → Agent Decision Engine (intent + action)
         → Contact Memory (long-term context)
         → OpenAI GPT-4o (generates human reply)
         → GHL API (sends reply back)
         → Usage tracking + logging
```

## File Structure

```
app/
  login/           → Sign in page
  register/        → Sign up + free trial
  pricing/         → Public pricing page
  dashboard/
    page.tsx        → Main dashboard
    locations/      → GHL location management
    setup/          → AI training wizard
    conversations/  → Message history
    analytics/      → Stats + charts
    settings/       → Per-location AI config
    admin/          → Admin user management
  api/
    auth/           → NextAuth + registration
    webhook/        → Receives GHL messages
    ai/process/     → AI agent engine
    billing/        → Stripe checkout + webhooks
    locations/      → Location CRUD
    business/       → Business profile CRUD
    automation/     → Automation config CRUD
    analytics/      → Stats API
    admin/          → Admin API

lib/
  auth-options.ts   → NextAuth config (shared)
  agent.ts          → AI decision engine
  prompt.ts         → System + user prompts
  plans.ts          → Plan limits + pricing
  ghl.ts            → GHL API helpers
  token-manager.ts  → Auto-refresh GHL tokens

components/
  Sidebar.tsx       → Navigation + trial countdown
  Providers.tsx     → NextAuth SessionProvider

prisma/
  schema.prisma     → Full DB schema
```

---

## Pricing Plans

| Plan | Price | Locations | Messages/mo |
|------|-------|-----------|-------------|
| Trial | Free | 1 | 50 total |
| Starter | $97/mo | 1 | 2,000 |
| Pro | $197/mo | 5 | 8,000 |
| Agency | $397/mo | 15 | 25,000 |

---

## Troubleshooting

**Auth not working:** Make sure `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set in `.env`

**GHL OAuth failing:** Verify your redirect URI matches exactly in both GHL app settings and `.env`

**Webhook not triggering AI:** Check the location's `automationEnabled` is true and subscription is active

**Prisma errors:** Run `npx prisma generate` after any schema changes

---

## v10 Changes — Three-Panel Architecture

### Panels
| Panel | Route | Role | Who |
|---|---|---|---|
| Individual | `/dashboard` | `user` | Single account users (existing) |
| Agency | `/agency` | `agency` | Agencies managing multiple clients |
| Client | `/client` | `client` | Clients invited by agency |

### New Features
1. **Agency Panel** — Full `/agency/*` section. Includes: Overview, Locations, Clients & Invites, AI Sales Team, Analytics, AI Team Chat, Notifications, Agency Profile, Settings. Does NOT include: Pipeline, Active Contacts, Conversations, AI Setup.
2. **Agency Profile Page** (`/agency/profile`) — Set agency name, logo, colors, tagline, support email, website. This branding replaces NexusReply branding in all client portals.
3. **Invite Link Generator** (`/agency/clients`) — Generate shareable invite links per location. Clients click link → register → land in branded client portal showing only their location.
4. **Client Portal Branding** — Client sidebar and topbar pull agency's `AgencyProfile` and render agency logo/name/colors instead of NexusReply.
5. **Per-Agency AI Agents** — Agents are stamped with `agencyId`. Max 6 agents per location for agency accounts. Changes to agents auto-notify all clients of that agency.
6. **Notifications Push** — When agency adds/edits/removes an agent, all clients belonging to that agency receive a notification in their portal.
7. **Account Type Chooser** — Register page now shows Individual vs Agency chooser. Sets `role` on signup.

### DB Migration (run after pulling)
```bash
npx prisma db push
```

### New Models
- `AgencyProfile` — white-label identity per agency
- `User.agencyOwnerId` — links client users back to their agency
- `AIAgent.agencyId` — scopes agents per agency

### Promote existing user to Agency
```sql
UPDATE "User" SET role = 'agency' WHERE email = 'your@email.com';
```
