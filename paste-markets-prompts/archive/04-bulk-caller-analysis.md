# Feature: Bulk Caller Analysis ("Scan Any Twitter Account")

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun runtime, Cloudflare Workers, JSONL storage. The existing `/trade` pipeline already does: URL extraction (`/scripts/extract.ts`), thesis detection + routing (`/scripts/route.ts`, `/scripts/discover.ts`), and publishing (`/scripts/post.ts`). It already handles historic tweets and records the price at the tweet's original `source_date`. The search API: `GET /api/search?author_handle=X`. Twitter fetching uses X API v2 with fxtwitter/vxtwitter fallbacks (see `/scripts/extract.ts`).

From Frank (the builder): "yes, this works now for any historic tweet — it will get price from time original tweet & compare to present day for anything on hyperliquid or robinhood"

---

## What to Build
A "scan any Twitter account" feature that fetches a user's recent tweets, runs each through the existing trade detection pipeline, and produces a full performance report on their calling history.

### User Flow:
1. User goes to `/scan`
2. Enters `@ZssBecker` (or any Twitter handle)
3. System queues an async scan job
4. Live progress updates stream to the page (tweet by tweet)
5. Full report shown when complete: win rate, avg PnL, best/worst calls, "Jim Cramer Score" if their inverse > 20%

### New API endpoints:
```
POST /api/scan               — start a scan job
GET  /api/scan/[jobId]       — poll status + results
GET  /api/scan/recent        — last 10 public scans (for social proof on /scan page)
```

**`POST /api/scan`:**
```ts
// Request
{ handle: "ZssBecker" }

// Response
{ jobId: "uuid-v4", status: "queued", estimatedSeconds: 45 }
```

**`GET /api/scan/[jobId]`:**
```ts
{
  jobId: string,
  handle: string,
  status: "queued" | "running" | "complete" | "failed",
  progress: {
    tweetsScanned: number,
    callsFound: number,
    totalTweets: number        // estimated (varies with Twitter API)
  },
  result: ScanResult | null    // null until complete
}

type ScanResult = {
  handle: string,
  displayName: string,
  avatarUrl: string,
  tweetsScanned: number,
  callsFound: number,
  stats: {
    winRate: number,
    avgPnlPercent: number,
    totalPnlIfFollowed: number,    // % if you copied every call at tweet time
    inversePerformance: number,    // % if you faded every call ("Jim Cramer score")
    bestCall: DetectedCall,
    worstCall: DetectedCall,
    confidenceAvg: number          // avg AI confidence in call detection
  },
  calls: DetectedCall[]
}

type DetectedCall = {
  tweetId: string,
  tweetUrl: string,
  tweetText: string,
  tweetDate: string,
  ticker: string,
  direction: "long" | "short",
  platform: "hyperliquid" | "robinhood" | "polymarket",
  confidence: number,            // 0-1, from thesis extraction
  priceAtTweet: number,
  currentPrice: number,
  pnlPercent: number,
  tradeCardUrl: string           // paste.trade/s/{trade_id} — auto-created
}
```

### Scan Pipeline (Bun worker):
1. Fetch up to 200 tweets from the handle using the existing Twitter extract logic in `/scripts/extract.ts`
2. For each tweet:
   a. Run through existing thesis extraction (same as `/trade` pipeline)
   b. If thesis detected with confidence > 0.65, proceed
   c. Look up price at `tweet.created_at` via Hyperliquid candles or Yahoo Finance
   d. Run the routing logic from `/scripts/route.ts` to get ticker + platform
   e. Save as a trade card via `/api/skill/post` (auto-creates a paste.trade/s/... card)
   f. Emit progress event via WebSocket/SSE
3. Aggregate all detected calls into stats
4. Store result under job ID (Cloudflare KV, 6 hour TTL)

**Streaming progress:**
Reuse the existing WebSocket/SSE event system from `/scripts/stream-log.ts`. Emit events:
- `{ type: "scan_progress", tweetsScanned: N, totalTweets: M, callsFound: K }`
- `{ type: "call_found", call: DetectedCall }`
- `{ type: "scan_complete", result: ScanResult }`

### Rate Limiting:
- Max 3 scans per IP per hour
- Cache scan results for 6 hours per handle (don't re-scan same handle within window)
- Max 200 tweets per scan (Twitter API limit + cost control)
- If cached result exists, return immediately with `status: "cached"`

### Frontend: `/scan` page

**Input state:**
- Large centered input: "Enter any Twitter handle"
- Subtext: "We'll scan their tweets and score every trade call"
- CTA: "Scan Calls"
- Below input: "Recently scanned:" — show last 10 public scans as handle chips (link to their reports)

**Loading state (streaming):**
- Progress bar
- Live counter: "Scanned 47 / 200 tweets"
- "Found 12 potential trade calls..."
- Detected calls appear as small cards as they're found (live feed)
- "Estimated time: ~30 seconds"

**Results state:**

Hero metric (big, centered):
- If winRate > 55%: "68% Win Rate — Strong Caller"
- If inversePerformance > 20%: "Jim Cramer Score: 82% — Fading them beats following" (special badge + explanation)

Stats grid:
```
Win Rate    Avg PnL    Total Calls    Best Call    Fade Score
  68%        +14.2%       47          +340%          +8.2%
```

Full calls table (same design as trade card list):
- Each detected call: ticker, direction, date, PnL %, confidence badge, "View Call" link
- Sortable by PnL / Date / Confidence

CTAs:
- "View Full Profile" → links to `/[handle]` profile page
- "Share Results" → pre-filled tweet: "I scanned @{handle}'s calls on paste.trade — {winRate}% win rate on {callCount} calls 👀 paste.trade/scan/{jobId}"
- "Scan Another Account" → back to input

### Files to read first:
- `/scripts/extract.ts` — existing Twitter fetch logic to reuse
- `/scripts/route.ts` — routing logic to run per tweet
- `/scripts/post.ts` — how to auto-create a trade card
- `/scripts/stream-log.ts` — streaming progress events
- `/references/events.md` — event types

## Deliverable:
1. `POST /api/scan` and `GET /api/scan/[jobId]` with async job queue (Cloudflare KV for state)
2. Bun worker that runs the per-tweet pipeline with the existing extract/route/post scripts
3. SSE/WebSocket progress streaming to the frontend
4. `/scan` page: input → loading (live) → results
5. Rate limiting + 6h cache per handle
6. "Jim Cramer Score" badge if inverse > 20%
7. Share tweet CTA with pre-filled text
