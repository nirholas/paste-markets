# Task: Bulk Profile Backtest — "Jim Cramer Test" for Any Twitter Account

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard already has a `/scan` page and scan API that fetches tweets and detects trade calls. The paste.trade backend can process historic tweets and record the price at the original tweet's `source_date`.

Community request (from @anandymous17): "You should be able to apply this to anyone's past tweets to see how they perform historically (I'm thinking of Jim Cramer). It would probably help finance-tweeting be a more merit based game."

Frank confirmed: "yes, this works now for any historic tweet — it will get price from time original tweet & compare to present day for anything on hyperliquid or robinhood. I don't have a bulk profile method yet."

Also from @leveredup_: anti-cherry-pick — "I made a similar tool but it doesn't let the user cherry pick." The backtest scans ALL tweets, no selective display.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

A `/backtest/[handle]` page that runs a **full, non-selective scan** of a Twitter account's history and generates a comprehensive performance report. Unlike the existing `/scan`, this is deeper: it fetches maximum history, grades every call, and produces a "would you have made money following this person?" report.

### Key Difference from `/scan`

The existing `/scan` is a quick scan (200 tweets, real-time progress). This backtest is:
- **Exhaustive**: fetches as many tweets as possible (up to 1000+)
- **Non-selective**: every detected call is included, no cherry-picking
- **Comparative**: shows "follow" vs "fade" performance
- **Shareable**: generates a report card with OG image

### New API endpoints

```
POST /api/backtest              — start a backtest job
GET  /api/backtest/[jobId]      — poll status + results
GET  /api/backtest/report/[handle] — get cached report for a handle
```

**`POST /api/backtest`:**
```ts
// Request
{ handle: string, maxTweets?: number }

// Response
{ jobId: string, status: "queued", estimatedMinutes: 2 }
```

**`GET /api/backtest/[jobId]`:**
```ts
{
  jobId: string,
  handle: string,
  status: "queued" | "scanning" | "analyzing" | "complete" | "failed",
  progress: {
    phase: "fetching_tweets" | "detecting_calls" | "pricing" | "aggregating",
    tweetsScanned: number,
    totalTweets: number,
    callsFound: number
  },
  result: BacktestReport | null
}

type BacktestReport = {
  handle: string,
  displayName: string,
  avatarUrl: string,
  scanDate: string,
  tweetsCovered: number,
  dateRange: { from: string, to: string },

  // Follow performance — if you copied every call
  follow: {
    totalCalls: number,
    winRate: number,
    avgPnlPercent: number,
    cumulativePnl: number,
    bestCall: BacktestCall,
    worstCall: BacktestCall,
    sharpeApprox: number,       // rough sharpe: avg / stddev
    maxDrawdown: number,        // worst peak-to-trough
    winStreak: number,          // longest win streak
    lossStreak: number
  },

  // Fade performance — if you took the opposite of every call
  fade: {
    winRate: number,
    avgPnlPercent: number,
    cumulativePnl: number
  },

  // Grade
  grade: "S" | "A" | "B" | "C" | "D" | "F",
  gradeLabel: string,           // "Elite Caller" / "Solid" / "Coin Flip" / "Fade Material"
  jimCramerScore: boolean,      // true if fading beats following

  // Breakdown
  byAsset: Array<{
    ticker: string,
    calls: number,
    winRate: number,
    avgPnl: number
  }>,
  byPlatform: Array<{
    platform: string,
    calls: number,
    winRate: number
  }>,
  byMonth: Array<{
    month: string,              // "2026-01"
    calls: number,
    pnl: number
  }>,

  // All calls (for transparency / anti-cherry-pick)
  calls: BacktestCall[]
}

type BacktestCall = {
  tweetId: string,
  tweetUrl: string,
  tweetText: string,
  tweetDate: string,
  ticker: string,
  direction: "long" | "short",
  platform: string,
  confidence: number,
  priceAtTweet: number,
  currentPrice: number,
  pnlPercent: number,
  holdDays: number
}
```

### Grading Logic

```
S: winRate >= 70% AND avgPnl >= 15% AND totalCalls >= 15
A: winRate >= 60% AND avgPnl >= 8% AND totalCalls >= 10
B: winRate >= 55% AND avgPnl >= 3%
C: winRate >= 45%
D: winRate >= 35%
F: winRate < 35%
```

If `fade.cumulativePnl > follow.cumulativePnl` → `jimCramerScore = true`, gradeLabel appended with " (Fade Material)"

### Frontend: `/backtest/[handle]` page

**Input state** (if no handle in URL or no cached report):
- Large input: "Backtest any Twitter account"
- Subtext: "Full history scan — every call tracked, no cherry-picking"
- CTA: "Run Backtest"

**Loading state:**
- Phase indicator: "Fetching tweets..." → "Detecting calls..." → "Pricing..." → "Generating report..."
- Progress bar with tweet count
- Calls appear as they're found (live feed)

**Report state:**

Hero section:
```
@ZssBecker — Grade: A (Solid Caller)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
47 calls found across 823 tweets (Jan 2025 — Mar 2026)
```

Two-column comparison:
```
FOLLOW                          FADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Win Rate:    68%                 32%
Avg PnL:     +14.2%             -14.2%
Cumulative:  +340%              -180%
Verdict:   ✅ FOLLOW           ❌ DON'T FADE
```

If Jim Cramer Score is true, show special banner:
```
🔄 JIM CRAMER ALERT — Fading this account beats following!
   Fade win rate: 72% | Fade cumulative: +280%
```

Monthly performance chart:
- Bar chart, green/red bars per month
- x = month, y = cumulative PnL that month

Asset breakdown table:
- Ticker | Calls | Win Rate | Avg PnL
- Sorted by call count

Full call history table (anti-cherry-pick — ALL calls shown):
- Tweet text (truncated), Date, Ticker, Direction, PnL %, Confidence
- Sortable by any column
- Cannot be filtered or hidden — transparency is the point

Share CTAs:
- "Share Report" → pre-filled tweet with grade and stats
- "Compare with..." → link to `/vs/[handle]/[other]`

### OG Image: `/api/og/backtest/[handle]`

Generate a PNG report card:
```
┌──────────────────────────────────┐
│  @ZssBecker — GRADE: A          │
│  Solid Caller                    │
│                                  │
│  68% Win Rate | 47 Calls         │
│  +14.2% Avg PnL | +340% Total   │
│                                  │
│  paste.markets/backtest/ZssBecker│
└──────────────────────────────────┘
```

### Caching
- Cache completed reports in SQLite for 24 hours per handle
- If a cached report exists and is < 24h old, return immediately
- Show "Last scanned: 3 hours ago" with option to re-run

---

## Files to Read First
- `paste-dashboard/src/app/api/scan/route.ts` — existing scan logic to extend
- `paste-dashboard/src/lib/scan-processor.ts` — tweet processing pipeline
- `paste-dashboard/src/lib/twitter-fetch.ts` — tweet fetching
- `paste-dashboard/src/lib/metrics.ts` — PnL calculations
- `paste-dashboard/src/lib/alpha.ts` — existing scoring/grading
- `paste-dashboard/src/lib/db.ts` — SQLite schema

## Deliverable
1. `POST /api/backtest` and `GET /api/backtest/[jobId]` endpoints
2. `GET /api/backtest/report/[handle]` for cached reports
3. Backtest worker that processes full tweet history
4. Grading algorithm with Jim Cramer detection
5. `/backtest/[handle]` page with input → loading → report states
6. `/api/og/backtest/[handle]` OG image generation
7. SQLite table for caching backtest reports
8. Follow vs Fade comparison display
9. Full call history table (anti-cherry-pick)
