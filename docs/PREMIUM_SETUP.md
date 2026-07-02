# Premium reflection layer — walkthrough & setup guide

Everything on the `premium-reflection` branch is **env‑gated**: it builds and runs
with all external services off. This guide covers (1) walking through it **right now**
on the local dev server, and (2) exactly what I need from you to **fully test / ship**
each feature.

---

## 1. Walk through it now — local dev (http://localhost:3100)

The dev server runs with `ECODHARMA_BOT_TEST=1`, which lets you exercise the bot /
cron / MCP routes without a live Telegram/Stripe/Resend account (the routes return
their computed reply instead of calling out).

**Steps:**

1. **Sign up** at http://localhost:3100/signup (any email). Complete onboarding →
   you get a reading. Readings use Claude if configured (~90s); to make them instant
   while you poke around, go to **/curate → Reading engine → Switch to hardcoded**.
2. You are an **admin** locally (`ECODHARMA_ADMIN_EMAILS` is unset), so open
   **/curate → Premium** and **Grant premium** to your own email.
3. Open **/settings** — you'll now see the whole premium surface:
   - **Membership** — plan badge = Premium.
   - **Reflect via Telegram** — generates a one‑time connect code.
   - **Reflect via your own AI tool (MCP)** — endpoint + a bearer token.
   - **Weekly dharma nudge** — on/off toggle + your latest nudge.
4. **Constellation join links:** create a constellation, then in it use **Create join
   link** (set max‑uses). Open the link in an incognito window as a second signed‑up
   user to join.
5. **Social share cards** (already on `main`): /profile → **Create a share card**.

**Exercise the bot / nudges / MCP from a terminal** (test seam returns the reply):

```bash
# 1) Generate a connect code in the UI (/settings → Connect Telegram), then link it:
curl -s localhost:3100/api/bot/telegram -H 'content-type: application/json' \
  -d '{"message":{"from":{"id":42},"chat":{"id":42},"text":"/start <YOUR_CODE>"}}'

# 2) Send a real message → a grounded reflection (Claude if configured, else fixture):
curl -s localhost:3100/api/bot/telegram -H 'content-type: application/json' \
  -d '{"message":{"from":{"id":42},"chat":{"id":42},"text":"I feel scattered about my work."}}'

# 3) Trigger the weekly nudge job, then reload /settings to see "your latest nudge":
curl -s localhost:3100/api/cron/nudges

# 4) Use the hosted MCP with the token from /settings:
TOKEN=eco_...    # from the MCP panel
curl -s localhost:3100/api/mcp -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"reflect","arguments":{"message":"Where should I focus this week?"}}}'
```

> The Slack route is identical: `POST /api/bot/slack` with a Slack‑shaped event.

---

## 2. What I need from you to FULLY test / go live

Each block is independent — set up only what you want to test. Anything with a
`NEXT_PUBLIC_` prefix must be present at **build** time.

### A. Stripe — premium billing
1. Create a Stripe account (start in **test mode**).
2. **Product + recurring Price** (e.g. EcoDharma Premium, $15/mo) → copy the **Price ID** (`price_…`).
3. Copy the **secret key** (`sk_test_…`).
4. **Webhook** → endpoint `https://<site>/api/stripe/webhook`, events:
   `checkout.session.completed`, `customer.subscription.created`, `…updated`, `…deleted`
   → copy the **signing secret** (`whsec_…`).
5. Env: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
6. Local webhook testing (optional): `stripe listen --forward-to localhost:3100/api/stripe/webhook`
   (the Stripe CLI prints a local `whsec_…`).
- **Decision I need:** the **price** (monthly amount) and whether to launch in test or live mode.

### B. Telegram — reflection bot
1. Message **@BotFather** → `/newbot` → get the **bot token** and **@username**.
2. Env: `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (handle without `@`),
   and optionally `TELEGRAM_WEBHOOK_SECRET` (any random string).
3. Register the webhook (needs a public URL — deploy, or a tunnel like `cloudflared`/`ngrok`):
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<site>/api/bot/telegram&secret_token=<SECRET>"
   ```
4. Then: premium user → /settings → **Connect Telegram** → tap the link / send `/start <code>` → chat.

### C. Slack — DM + group perspective bot
1. Create a Slack app (api.slack.com/apps → from scratch).
2. **Bot token scopes:** `chat:write`, `im:history`, `im:read`, `im:write`, `app_mentions:read`.
   Install to the workspace → **Bot User OAuth Token** (`xoxb-…`).
3. Copy the **Signing Secret** (Basic Information).
4. **Event Subscriptions** → Request URL `https://<site>/api/bot/slack` (our route answers
   Slack's verification challenge automatically) → subscribe to bot events `message.im`, `app_mention`.
5. Env: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`. (Needs a public URL.)

### D. Resend — nudge + invite emails
1. Resend account → **API key** (`re_…`).
2. Verify a sending domain (or, for a quick test, send to your own address from `onboarding@resend.dev`).
3. Env: `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `EcoDharma <hello@yourdomain>`).
- Without this, invites still work (owner gets a shareable link instead of an email) and nudges
  are recorded in‑app but not emailed.

### E. Weekly cron
- Set **`CRON_SECRET`** (any random string) in Vercel env. Vercel injects it as
  `Authorization: Bearer …` on the scheduled call; the route refuses to run in prod without it.
- Schedule is already declared in `apps/web/vercel.json` (`0 15 * * 1`, Mondays).

### F. Database (Neon)
- Apply migrations **0013–0017** to Neon before the branch is deployed (otherwise
  `/settings` and `/profile` 500 on the new columns). I can run these via the Neon MCP on your go.

### G. Site URL
- `NEXT_PUBLIC_SITE_URL=https://ecodharma.vercel.app` — used for Stripe redirects, Telegram/MCP
  deep links, and email links.

### H. Ship
- Merge `premium-reflection` → `main` → push (Vercel deploys), **after** F + the env you want live.

---

## Full env var reference

```bash
# --- Premium (Stripe) ---
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# --- Telegram bot ---
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_WEBHOOK_SECRET=<random>            # optional but recommended
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=EcoDharmaBot

# --- Slack bot ---
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# --- Email (Resend) ---
RESEND_API_KEY=re_...
EMAIL_FROM=EcoDharma <hello@yourdomain>

# --- Cron + misc ---
CRON_SECRET=<random>
NEXT_PUBLIC_SITE_URL=https://ecodharma.vercel.app

# --- Optional: chat model for the bot/nudges (default claude-sonnet-4-6) ---
ECODHARMA_BOT_MODEL=claude-sonnet-4-6
```

## What is / isn't verified
- **Tested end‑to‑end (offline):** premium gating, identity linking, the JSON‑RPC MCP,
  invite links + limits, cron cohort selection, webhook parsing, Slack signature/challenge,
  and the deterministic reflection/nudge paths.
- **Needs your credentials to verify live:** Claude‑quality reflections/nudges (works locally if
  your `ANTHROPIC_API_KEY` + Claude mode are on), and the real Stripe / Telegram / Slack / Resend
  round‑trips.
