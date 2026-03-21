# Task: Copytrading Signals — Alert-Based Trade Following

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard has an existing alerts system (`src/lib/alerts` or `src/app/api/alerts/`) and Telegram bot integration (`src/lib/telegram-db.ts`). The real-time caller streaming (task 14) monitors tracked callers for new tweets.

Community request from @clawagencyagent: "paste-trade as in copytrading from wallets/alerts? if this actually routes cleanly, discord later today is gonna get flooded fast."

From @tonitrades_: "The wallets connecting to this are way bigger than they look. Once the smart money starts using live pnl as social proof, small traders will follow fast."

The idea: let users set up personalized alert rules — follow specific callers, tickers, or strategies — and get notified instantly when a matching trade signal appears. This is the "copytrading" layer.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Alert Rules Engine — `src/lib/alert-rules.ts`

A flexible rule system for defining what signals a user wants:

```ts
interface AlertRule {
  id: string
  userId: string                    // wallet address or session ID
  name: string                     // user-defined label
  enabled: boolean
  conditions: AlertCondition[]     // ALL must match (AND logic)
  channels: AlertChannel[]         // where to send notifications
  createdAt: string
}

interface AlertCondition {
  type: "caller" | "ticker" | "direction" | "platform" | "confidence" | "tier"
  operator: "eq" | "in" | "gte" | "lte"
  value: string | string[] | number
}

// Examples:
// Follow a specific caller:
//   { type: "caller", operator: "eq", value: "frankdegods" }
//
// Any S-tier caller goes long on BTC:
//   { type: "tier", operator: "in", value: ["S", "A"] },
//   { type: "ticker", operator: "eq", value: "BTC" },
//   { type: "direction", operator: "eq", value: "long" }
//
// High-confidence calls only:
//   { type: "confidence", operator: "gte", value: 0.8 }

type AlertChannel = {
  type: "browser" | "telegram" | "webhook"
  config: Record<string, string>   // telegramChatId, webhookUrl, etc.
}
```

### 2. Alert Matching — `src/lib/alert-matcher.ts`

When a new trade is detected (from the poller or manual submission), match it against all active alert rules:

```ts
export async function matchAlerts(trade: DetectedTrade): Promise<MatchedAlert[]> {
  // 1. Load all enabled alert rules from SQLite
  // 2. For each rule, check if ALL conditions match the trade
  // 3. Return list of matched alerts with their channels
}

export async function dispatchAlerts(matches: MatchedAlert[]): Promise<void> {
  // For each match, send notification via the appropriate channel
  // Browser: store in notifications table for polling
  // Telegram: send via bot API
  // Webhook: POST to user's URL
}
```

### 3. Data Model

```sql
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  conditions TEXT NOT NULL,          -- JSON array of AlertCondition
  channels TEXT NOT NULL,            -- JSON array of AlertChannel
  enabled INTEGER DEFAULT 1,
  match_count INTEGER DEFAULT 0,
  last_matched_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alert_notifications (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  trade_id TEXT,
  caller_handle TEXT,
  ticker TEXT,
  direction TEXT,
  message TEXT NOT NULL,
  channel TEXT NOT NULL,             -- 'browser' | 'telegram' | 'webhook'
  delivered INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
);

CREATE INDEX idx_alert_notifications_user ON alert_notifications(rule_id);
CREATE INDEX idx_alert_notifications_unread ON alert_notifications(delivered, read_at);
```

### 4. Alert API

```
GET    /api/alerts                     — list user's alert rules
POST   /api/alerts                     — create alert rule
PATCH  /api/alerts/[id]                — update rule
DELETE /api/alerts/[id]                — delete rule
GET    /api/alerts/notifications       — unread notifications
POST   /api/alerts/notifications/read  — mark as read
GET    /api/alerts/test/[id]           — test a rule against recent trades
```

**`POST /api/alerts` — create rule:**
```ts
// Request
{
  name: "Frank's BTC calls",
  conditions: [
    { type: "caller", operator: "eq", value: "frankdegods" },
    { type: "ticker", operator: "eq", value: "BTC" }
  ],
  channels: [
    { type: "browser", config: {} },
    { type: "telegram", config: { chatId: "12345" } }
  ]
}

// Response
{
  id: "uuid",
  name: "Frank's BTC calls",
  enabled: true,
  estimatedFrequency: "~2 alerts/week"
}
```

### 5. Frontend: `/alerts` page

**Alert dashboard:**
```
━━━ YOUR SIGNAL ALERTS ━━━

┌──────────────────────────────────────────────┐
│ 🔔 Frank's BTC calls                    [ON]│
│ When @frankdegods calls BTC                  │
│ Via: Browser, Telegram                       │
│ Matched 4 times · Last: 2 days ago           │
│ [Edit] [Test] [Delete]                       │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ 🔔 S-tier longs only                    [ON]│
│ When S or A tier caller goes LONG            │
│ With confidence >= 80%                       │
│ Via: Browser                                 │
│ Matched 12 times · Last: 6 hours ago         │
│ [Edit] [Test] [Delete]                       │
└──────────────────────────────────────────────┘

[+ Create New Alert]
```

**Create alert builder:**
```
┌──────────────────────────────────────────────┐
│ CREATE ALERT                                 │
│                                              │
│ Name: [________________________]             │
│                                              │
│ When:                                        │
│ ┌─ Condition 1 ────────────────────────────┐ │
│ │ [Caller ▼] [equals ▼] [@frankdegods   ] │ │
│ └──────────────────────────────────────────┘ │
│ AND                                          │
│ ┌─ Condition 2 ────────────────────────────┐ │
│ │ [Ticker ▼] [equals ▼] [BTC            ] │ │
│ └──────────────────────────────────────────┘ │
│ [+ Add Condition]                            │
│                                              │
│ Notify via:                                  │
│ ☑ Browser notifications                     │
│ ☑ Telegram (@paste_markets_bot)             │
│ ☐ Webhook URL: [_______________________]    │
│                                              │
│ [Test Against Recent Trades]  [Save Alert]   │
└──────────────────────────────────────────────┘
```

### 6. Browser notifications bell

Add a notification bell to the nav bar:

```
[🔔 3] — clicking opens notification dropdown:

┌──────────────────────────────────────────┐
│ 🔴 @frankdegods called BTC LONG         │
│    Confidence: 92% · 12 min ago          │
│    [View Trade]                          │
├──────────────────────────────────────────┤
│ 🔴 S-tier alert: @ZssBecker ETH LONG    │
│    Confidence: 85% · 1 hour ago          │
│    [View Trade]                          │
├──────────────────────────────────────────┤
│    @taikimaeda called SOL LONG           │
│    Confidence: 78% · 3 hours ago         │
│    [View Trade]                          │
├──────────────────────────────────────────┤
│ [View All Notifications]                 │
│ [Manage Alerts →]                        │
└──────────────────────────────────────────┘
```

### 7. Quick-follow from profile pages

On caller profile pages, add a "Follow" button that creates an alert rule:

```
@frankdegods                    [Follow Calls 🔔]
```

Clicking "Follow Calls" creates a simple alert rule:
```
{ conditions: [{ type: "caller", operator: "eq", value: "frankdegods" }],
  channels: [{ type: "browser", config: {} }] }
```

### 8. Preset alert templates

Offer one-click presets on the `/alerts` page:

```
━━━ POPULAR ALERT TEMPLATES ━━━

[S-Tier Callers Only]     — Any S/A tier caller makes a call
[BTC Signals]             — Any caller mentions BTC
[High Confidence]         — Calls with 85%+ confidence
[Polymarket Events]       — New prediction market calls
[New Caller Alert]        — When a newly discovered caller is added
```

---

## Files to Read First
- `paste-dashboard/src/app/api/alerts/route.ts` — existing alerts API
- `paste-dashboard/src/app/alert/page.tsx` — existing alert page (if any)
- `paste-dashboard/src/lib/telegram-db.ts` — Telegram integration
- `paste-dashboard/src/lib/telegram-format.ts` — message formatting
- `paste-dashboard/src/components/nav.tsx` — navigation bar to add bell
- `paste-dashboard/src/lib/db.ts` — SQLite schema

## Deliverable
1. `src/lib/alert-rules.ts` — rule engine with condition matching
2. `src/lib/alert-matcher.ts` — match trades against rules + dispatch
3. Alert CRUD API endpoints
4. `/alerts` page with rule builder, presets, and management
5. Notification bell in nav bar with dropdown
6. "Follow Calls" quick-button on profile pages
7. Browser notification support
8. Telegram dispatch for matched alerts
9. Webhook dispatch for power users
10. SQLite tables for rules and notifications
