# Task: Social Wager-In — Double Down on Someone's Trade Idea

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard already has a wager system (see `src/lib/wager-db.ts` and `src/components/wager-widget.tsx`) with basic "back a caller's trade" functionality.

Community request from @rgvrmdya (1 retweet): "Should be able to like a comment and wager in — I like your idea so I wager by doubling down on your strategy and pay you."

This extends the existing wager system with a **social layer** — users can wager on trades directly from the feed, see who else is backing a call, and callers earn tips from profitable wagers.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Quick-Wager from Feed — "Double Down" Button

Add a "Double Down" interaction to every trade card in the feed, leaderboard, and profile pages:

**Trade card addition:**
```
┌──────────────────────────────────────────────┐
│ @frankdegods · BTC LONG · +4.2%              │
│ "BTC looking strong here, 85k is the floor"  │
│                                              │
│ ⬆ 12 backed · 340 USDC wagered              │
│                                              │
│ [Double Down]  [View Trade]  [Share]          │
└──────────────────────────────────────────────┘
```

The "Double Down" button:
- Shows a quick-action popover (not a full modal) with amount presets: 5, 10, 25, 50, 100 USDC
- One-tap wager for logged-in users with connected wallets
- Shows live count of backers + total wagered
- Animates when a new wager comes in (number ticks up)

### 2. Backer Social Proof — `src/components/backer-strip.tsx`

A component showing who has backed a trade:

```
┌──────────────────────────────────────────┐
│ Backed by: [av][av][av] +9 others        │
│ 340 USDC wagered · 12 backers            │
│ Top backer: @whale_trader (100 USDC)     │
└──────────────────────────────────────────┘
```

- Show first 3 backer avatars (if they have linked Twitter handles)
- "+N others" for the rest
- Top backer highlighted
- Clicking opens full backer list

### 3. Wager Feed — `src/app/wagers/page.tsx`

A dedicated `/wagers` page showing all active and settled wagers:

**Tabs:**
- "Active" — trades with open wager windows
- "Settled" — completed wagers with results
- "My Wagers" — user's own wagers (requires wallet connection)

**Active wager card:**
```
┌──────────────────────────────────────────────┐
│ @ZssBecker · ETH LONG                       │
│ Currently: +8.2%                             │
│                                              │
│ 780 USDC wagered by 24 backers               │
│ Wager window closes in 6h                    │
│ Settles: Mar 28, 2026                        │
│                                              │
│ If settled now: backers earn +6.4% after tip │
│                                              │
│ [Double Down]                                │
└──────────────────────────────────────────────┘
```

**Settled wager card:**
```
┌──────────────────────────────────────────────┐
│ @frankdegods · BTC LONG · SETTLED ✅         │
│ Final PnL: +18.2%                            │
│                                              │
│ 1,200 USDC wagered by 31 backers             │
│ Backers earned: +16.4% (after 10% tip)       │
│ Caller earned: $21.84 in tips                │
│                                              │
│ [View Full Results]                          │
└──────────────────────────────────────────────┘
```

### 4. Caller Earnings Leaderboard

Add a `/wagers/leaderboard` page showing top callers by wager earnings:

```
━━━ TOP EARNERS — CALLER TIPS ━━━

#1  @frankdegods    $1,240  from 42 backed trades
#2  @ZssBecker      $890   from 28 backed trades
#3  @taikimaeda     $456   from 15 backed trades
```

This incentivizes callers to use paste.trade — they earn real money when their calls are profitable and people back them.

### 5. Wager Notifications

Add wager-related events to the existing feed/notification system:

Events:
- "New wager: @user backed @caller's BTC LONG with 50 USDC"
- "Wager settled: @caller's ETH LONG settled at +18% — 24 backers earned +16.4%"
- "Caller earned: @frankdegods earned $21.84 in tips from BTC LONG"

### 6. Data Model Updates

Extend existing wager tables:

```sql
-- Add to existing wager table or create if not exists
ALTER TABLE wagers ADD COLUMN display_on_feed INTEGER DEFAULT 1;
ALTER TABLE wagers ADD COLUMN backer_handle TEXT;
ALTER TABLE wagers ADD COLUMN backer_avatar_url TEXT;

-- New: wager_events table for the feed
CREATE TABLE IF NOT EXISTS wager_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- 'new_wager' | 'settled' | 'tip_earned'
  trade_id TEXT NOT NULL,
  caller_handle TEXT NOT NULL,
  backer_handle TEXT,
  amount REAL,
  pnl_percent REAL,
  tip_amount REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 7. API Updates

```
GET  /api/wagers                    — all active wagers feed
GET  /api/wagers/leaderboard        — top callers by earnings
GET  /api/wagers/[tradeId]/backers  — full backer list for a trade
POST /api/wagers/quick              — quick wager (preset amount)
```

**`POST /api/wagers/quick`:**
```ts
// Request
{
  tradeId: string,
  amount: 5 | 10 | 25 | 50 | 100,
  walletAddress: string,
  handle?: string
}

// Response
{
  wagerId: string,
  status: "active",
  totalWagered: number,
  backerCount: number
}
```

---

## Files to Read First
- `paste-dashboard/src/lib/wager-db.ts` — existing wager database logic
- `paste-dashboard/src/components/wager-widget.tsx` — existing wager UI
- `paste-dashboard/src/components/trade-card.tsx` — trade card to extend
- `paste-dashboard/src/components/feed-card.tsx` — feed card to extend
- `paste-dashboard/src/lib/db.ts` — SQLite schema

## Deliverable
1. "Double Down" button on all trade/feed cards with quick-action popover
2. `src/components/backer-strip.tsx` — social proof component
3. `/wagers` page with Active/Settled/My Wagers tabs
4. `/wagers/leaderboard` — caller earnings leaderboard
5. Wager events feed
6. Quick-wager API endpoint
7. Backer list API endpoint
8. SQLite schema updates for wager events
