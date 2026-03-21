# Task 37: Telegram Bot Integration Page

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/telegram` landing page + API webhook endpoint for a Telegram bot that delivers paste.markets alerts and trade notifications. Many CT traders live in Telegram — meeting them where they are.

## Context
Multiple tweet replies asked for Telegram integration. CT groups on Telegram are massive. A bot that posts "🟢 @frankdegods just called LONG $NVDA" in real-time is extremely high value.

## Steps

### 1. Telegram landing page
Create `src/app/telegram/page.tsx`:
- Headline: "paste.markets on Telegram"
- Bot features list:
  - Real-time trade alerts
  - Caller lookup: `/caller @handle`
  - Ticker search: `/ticker $NVDA`
  - Daily recap
  - Leaderboard: `/top 7d`
- "Add to Telegram" button (links to t.me/paste_markets_bot — placeholder for now)
- Preview screenshots/mockups of bot messages

### 2. Webhook endpoint
Create `src/app/api/telegram/webhook/route.ts`:
- `POST /api/telegram/webhook` — receives Telegram webhook updates
- Parses commands:
  - `/start` — welcome message + instructions
  - `/caller {handle}` — returns caller stats
  - `/ticker {symbol}` — returns ticker stats
  - `/top {timeframe}` — returns leaderboard
  - `/subscribe {handle}` — subscribe to caller alerts
  - `/help` — list commands
- Formats responses in Telegram markdown
- Requires `TELEGRAM_BOT_TOKEN` env var

### 3. Bot message formatter
Create `src/lib/telegram-format.ts`:
- Formats trade data for Telegram's markdown:
  ```
  🟢 NEW CALL
  @frankdegods → LONG $NVDA
  Entry: $142.50
  Platform: Robinhood

  Track it → paste.markets/frankdegods
  ```
- Formats leaderboard as compact table
- Formats caller stats as card

### 4. Subscription management
Add to database schema:
```sql
CREATE TABLE IF NOT EXISTS telegram_subs (
  chat_id TEXT NOT NULL,
  caller_handle TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (chat_id, caller_handle)
);
```

### 5. Design (landing page)
- Dark theme matching site
- Telegram brand blue (#0088cc) as accent
- Bot message previews styled like actual Telegram messages
- Phone mockup frame around preview (optional)
