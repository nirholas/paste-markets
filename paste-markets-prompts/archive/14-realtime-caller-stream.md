# Task: Real-Time Caller Streaming — Live Tweet-to-Trade Pipeline

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard has a `/feed` page showing recent trades. The paste.trade backend supports WebSocket events for live trade updates. The `xactions` npm package (should be installed already from task 12) provides streaming capabilities via Socket.IO.

Community request from @clawagencyagent: "paste-trade as in copytrading from wallets/alerts? if this actually routes cleanly, discord later today is gonna get flooded fast."

From @ghostbladexyz: "turning tweets into order flow"

From @sirsamjenks: "this is the future — deleting the gap between 'thats a good trade' and executing on it"

The idea: continuously monitor tracked callers' new tweets in real-time, auto-detect trade calls, and surface them instantly on the feed — before anyone else sees the signal.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Caller Watch List — `src/lib/watchlist.ts`

A module that manages which Twitter handles are being actively monitored:

```ts
interface WatchedCaller {
  handle: string
  displayName: string
  tier: "S" | "A" | "B" | "C"    // from alpha scoring
  lastChecked: string              // ISO timestamp
  checkIntervalMs: number          // poll frequency based on tier
  enabled: boolean
}
```

Tier-based polling intervals:
- S-tier callers: check every 2 minutes
- A-tier: every 5 minutes
- B-tier: every 15 minutes
- C-tier: every 30 minutes

Store the watchlist in SQLite:
```sql
CREATE TABLE IF NOT EXISTS caller_watchlist (
  handle TEXT PRIMARY KEY,
  display_name TEXT,
  tier TEXT DEFAULT 'C',
  check_interval_ms INTEGER DEFAULT 1800000,
  last_checked_at TEXT,
  last_tweet_id TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2. Tweet Poller — `src/lib/tweet-poller.ts`

A background polling service that:

1. Loads all enabled callers from the watchlist
2. Groups them by check interval
3. For each caller, fetches their latest tweets since `last_tweet_id`
4. For each new tweet:
   a. Run through Claude Haiku to detect if it contains a trade call
   b. If trade detected (confidence > 0.65):
      - Submit to paste.trade backend via `POST /api/trades`
      - Store the new trade in local SQLite
      - Emit a `new_trade` event via Server-Sent Events
   c. Update `last_tweet_id` and `last_checked_at`

```ts
export async function pollCaller(handle: string): Promise<NewTradeEvent[]> {
  // 1. Get last_tweet_id from watchlist
  // 2. Fetch new tweets via fetchUserTweets (uses xactions)
  // 3. Filter to tweets newer than last_tweet_id
  // 4. For each new tweet, run trade detection
  // 5. Return array of detected trades
}

export async function startPollingLoop(): Promise<void> {
  // Runs continuously, respects per-caller intervals
  // Uses setTimeout, not setInterval (prevents overlap)
}
```

### 3. Server-Sent Events endpoint — `src/app/api/stream/route.ts`

SSE endpoint that streams new trades to connected clients:

```ts
// GET /api/stream
// Returns: text/event-stream

// Event format:
// event: new_trade
// data: { "handle": "frankdegods", "ticker": "BTC", "direction": "long", "pnlSince": "+2.3%", "confidence": 0.89, "tweetUrl": "...", "tradeUrl": "..." }

// event: caller_checked
// data: { "handle": "ZssBecker", "tweetsChecked": 3, "callsFound": 0 }

// event: heartbeat
// data: { "timestamp": "2026-03-21T10:00:00Z", "activeCallers": 24 }
```

### 4. Live Feed page upgrade — update `/feed` page

Add a "LIVE" mode toggle to the existing feed page:

**Live mode ON:**
- Green pulsing dot + "LIVE" badge in header
- New trades slide in from the top with animation
- Auto-scroll enabled (can be toggled off)
- Sound notification option (subtle ping)
- Shows: "Monitoring 24 callers | Last signal: 3m ago"

**Feed card for live trades:**
```
┌──────────────────────────────────────────────┐
│ 🔴 LIVE  @frankdegods · just now             │
│                                              │
│ "BTC looking strong here, 85k is the floor"  │
│                                              │
│ BTC LONG on Hyperliquid                      │
│ Entry: $84,200 | Confidence: 89%             │
│                                              │
│ [View Tweet]  [Track Trade]  [Back This Call] │
└──────────────────────────────────────────────┘
```

### 5. Watchlist management API

```
GET    /api/watchlist                — list all watched callers
POST   /api/watchlist                — add caller to watchlist
DELETE /api/watchlist/[handle]       — remove caller
PATCH  /api/watchlist/[handle]       — update tier/interval/enabled
GET    /api/watchlist/stats          — monitoring stats
```

**`GET /api/watchlist/stats`:**
```ts
{
  totalCallers: number,
  activeCallers: number,
  totalChecksToday: number,
  tradesFoundToday: number,
  avgLatencyMs: number,           // avg time from tweet to trade detection
  lastSignalAt: string
}
```

### 6. Auto-populate watchlist

On first run or when watchlist is empty, auto-populate from the leaderboard:
- Fetch top 50 callers from `/api/leaderboard`
- Assign tiers based on their alpha score
- Enable all by default

Add a button on the `/feed` page: "Add Caller to Watch" that lets users manually add handles.

### 7. Signals page — `src/app/signals/page.tsx`

A dedicated `/signals` page showing only high-confidence live detections:

- Filters: minimum confidence (default 0.75), platform, direction
- Shows detection latency: "Detected 12 seconds after tweet"
- Each signal card shows:
  - Caller avatar + handle + tier badge
  - Tweet text
  - Detected ticker + direction + platform
  - Confidence bar (visual)
  - "Track This" CTA
- Sorted by recency (newest first)

---

## Files to Read First
- `paste-dashboard/src/app/feed/page.tsx` — existing feed page
- `paste-dashboard/src/components/feed-card.tsx` — existing feed card component
- `paste-dashboard/src/lib/twitter-fetch.ts` — tweet fetching (with xactions)
- `paste-dashboard/src/lib/scan-processor.ts` — trade detection logic to reuse
- `paste-dashboard/src/lib/db.ts` — SQLite schema and helpers
- `paste-dashboard/src/lib/alpha.ts` — alpha scoring for tier assignment

## Deliverable
1. `src/lib/watchlist.ts` — watchlist CRUD + SQLite table
2. `src/lib/tweet-poller.ts` — background polling service
3. `src/app/api/stream/route.ts` — SSE endpoint
4. `src/app/api/watchlist/route.ts` — watchlist management API
5. Updated `/feed` page with LIVE mode
6. `/signals` page with high-confidence detections
7. Auto-populate watchlist from leaderboard
8. Feed card component for live trade signals
