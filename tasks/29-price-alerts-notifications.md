# Task 29: Price Alert Notifications Page

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/alerts` page where users can set up notifications for specific callers or tickers. "Alert me when @frankdegods makes a new call" or "Alert me when anyone calls $SOL." For v1, this stores alert preferences — actual delivery (email/telegram/webhook) comes later.

## Steps

### 1. Database table
Add to `src/lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_handle TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'caller', 'ticker', 'consensus'
  target TEXT NOT NULL,      -- handle or ticker symbol
  threshold_pnl REAL,       -- optional: only alert if P&L > X%
  channel TEXT DEFAULT 'web', -- web, email, telegram, webhook
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2. API routes
Create `src/app/api/alerts/route.ts`:
- `GET /api/alerts?user={handle}` — list user's alerts
- `POST /api/alerts` — create new alert
- `DELETE /api/alerts/{id}` — remove alert

### 3. Build the page
Create `src/app/alerts/page.tsx` (client component):

Layout:
- "Set up alerts" headline
- Three alert type cards:
  1. **Caller Alert**: "Follow a caller" — search + select handle
  2. **Ticker Alert**: "Watch a ticker" — type ticker symbol
  3. **Consensus Alert**: "When X+ callers agree" — set threshold
- Each card has: target input, optional P&L threshold, channel selector
- "Your Alerts" section below showing active alerts with toggle/delete
- Coming soon badges for email/telegram channels

### 4. Alert feed (web channel)
Create `src/app/api/alerts/feed/route.ts`:
- `GET /api/alerts/feed?user={handle}` — returns recent triggered alerts
- Checks trades table against user's alert rules
- Returns matching trades with "triggered because: you follow @handle"

### 5. Design
- Cards with icons for each alert type
- Active alerts: green dot indicator
- Inactive: dimmed
- Channel icons: web (globe), email (envelope), telegram (paper plane)
- "Coming Soon" badge: amber (#f39c12) outline badge
