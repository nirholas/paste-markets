# Task: Anti-Cherry-Pick Mode — Full History Audit Trail

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard already tracks call integrity (live vs late vs retroactive) via `src/lib/integrity.ts` and shows integrity badges on trade cards.

Community request from @leveredup_: "I made a similar tool but it doesn't let the user cherry pick lol. Kinda for the opposite audience, the trailer, to know who's leading them to slaughter lol."

The problem: callers can submit only their winning trades and hide losses. The current integrity system flags late/retroactive calls, but doesn't enforce completeness. This task adds a **completeness audit** — proving a caller's public record includes ALL their calls, not just the good ones.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Completeness Score — `src/lib/completeness.ts`

A module that measures how complete a caller's tracked history is:

```ts
interface CompletenessAudit {
  handle: string
  auditDate: string

  // What we found on Twitter
  tweetsSampled: number
  tradeRelatedTweets: number         // tweets that look like trade calls

  // What's tracked on paste.markets
  trackedCalls: number

  // Comparison
  matchedCalls: number               // tweets that match a tracked trade
  unmatchedTweets: number            // trade-like tweets NOT in the system
  unmatchedTrades: number            // tracked trades with no matching tweet

  // Score
  completenessPercent: number        // matched / tradeRelatedTweets * 100
  grade: "VERIFIED" | "MOSTLY_COMPLETE" | "PARTIAL" | "CHERRY_PICKED" | "UNKNOWN"

  // Evidence
  missingCalls: Array<{
    tweetId: string
    tweetUrl: string
    tweetText: string
    tweetDate: string
    detectedTicker: string
    detectedDirection: string
    confidence: number
  }>
}
```

**Grading:**
```
VERIFIED:         completeness >= 90% AND trackedCalls >= 10
MOSTLY_COMPLETE:  completeness >= 70%
PARTIAL:          completeness >= 40%
CHERRY_PICKED:    completeness < 40% AND unmatchedTweets >= 5
UNKNOWN:          not enough data to audit
```

### 2. Audit Pipeline

```ts
export async function auditCaller(handle: string): Promise<CompletenessAudit> {
  // 1. Fetch last 200 tweets via fetchUserTweets
  // 2. Run each through trade detection (Claude Haiku, confidence >= 0.6)
  // 3. For each detected trade tweet:
  //    a. Check if a matching trade exists in the database
  //    b. Match on: handle + ticker + direction + date (within 24h window)
  // 4. Calculate completeness score
  // 5. Return audit with evidence of missing calls
}
```

### 3. Audit Badge — `src/components/audit-badge.tsx`

A visual badge shown on profile pages and leaderboard:

```
VERIFIED ✓     — green badge, caller tracks all their calls
MOSTLY COMPLETE — blue badge, some calls may be missing
PARTIAL        — yellow badge, selective tracking
CHERRY PICKED  — red badge, significant calls missing
UNKNOWN        — gray badge, not enough data
```

Badge shows on hover/click:
```
┌──────────────────────────────────────────────┐
│ AUDIT: VERIFIED ✓                            │
│                                              │
│ Last audited: Mar 20, 2026                   │
│ Tweets sampled: 200                          │
│ Trade-related found: 52                      │
│ Matched to tracked calls: 49 (94%)           │
│ Missing calls: 3                             │
│                                              │
│ [View Full Audit Report]                     │
└──────────────────────────────────────────────┘
```

### 4. Audit Report Page — `src/app/audit/[handle]/page.tsx`

A dedicated transparency page for each caller:

**Header:**
```
━━━ AUDIT REPORT: @frankdegods ━━━
Grade: VERIFIED ✓ (94% completeness)
Last audited: Mar 20, 2026 · 200 tweets sampled
```

**Completeness breakdown:**
```
Trade-related tweets found on X:     52
Matched to tracked calls:            49 (94%)
Missing from paste.markets:           3 (6%)
```

**Missing calls section (the key transparency feature):**
```
━━━ UNTRACKED CALLS (3) ━━━

These tweets appear to contain trade calls but are NOT tracked:

1. "SOL looking weak, might short here" — Mar 15
   Detected: SOL SHORT · Confidence: 72%
   [View Tweet]

2. "DOGE to $1 easy" — Feb 28
   Detected: DOGE LONG · Confidence: 68%
   [View Tweet]

3. "Fading this ETH pump" — Feb 14
   Detected: ETH SHORT · Confidence: 65%
   [View Tweet]
```

**Tracked calls section:**
```
━━━ ALL TRACKED CALLS (49) ━━━

Full list, unfiltered, newest first.
Every tracked call visible — nothing hidden.

[Standard trade history table]
```

**Note for callers:**
```
┌──────────────────────────────────────────────┐
│ Are you @frankdegods?                        │
│                                              │
│ Your audit shows 3 untracked calls.          │
│ Add them to improve your completeness score: │
│ [Add Missing Calls]                          │
│                                              │
│ A VERIFIED badge builds trust with followers.│
└──────────────────────────────────────────────┘
```

### 5. Leaderboard Integration

Add completeness badge to the leaderboard table:

```
#  Handle          Win%   Avg PnL   Audit
1  @frankdegods    68%    +14.2%    VERIFIED ✓
2  @ZssBecker      65%    +11.8%    MOSTLY ◐
3  @CryptoTrader   82%    +22.1%    CHERRY 🍒
```

Callers with CHERRY_PICKED grade get a visual warning — their stats may be inflated.

Optional: allow filtering leaderboard by audit grade. "Show only VERIFIED callers" toggle.

### 6. Auto-Audit Cron — `src/app/api/cron/audit/route.ts`

Run audits automatically:
- Audit top 50 callers weekly
- Audit any caller when they're viewed for the first time
- Re-audit when a caller submits new trades (check if they're being selective)

```
GET /api/cron/audit               — run batch audit
GET /api/audit/[handle]           — get audit report
POST /api/audit/[handle]/refresh  — trigger re-audit
```

### 7. Data Model

```sql
CREATE TABLE IF NOT EXISTS caller_audits (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  audit_date TEXT NOT NULL,
  tweets_sampled INTEGER,
  trade_related_tweets INTEGER,
  tracked_calls INTEGER,
  matched_calls INTEGER,
  unmatched_tweets INTEGER,
  completeness_percent REAL,
  grade TEXT,
  missing_calls TEXT,              -- JSON array
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_caller_audits_handle ON caller_audits(handle);
CREATE INDEX idx_caller_audits_date ON caller_audits(audit_date);
```

### 8. OG Image — `/api/og/audit/[handle]`

Shareable audit card:
```
┌──────────────────────────────────────────────┐
│ AUDIT: @frankdegods                          │
│ Grade: VERIFIED ✓                            │
│ 94% completeness · 49/52 calls tracked       │
│                                              │
│ paste.markets/audit/frankdegods              │
└──────────────────────────────────────────────┘
```

---

## Files to Read First
- `paste-dashboard/src/lib/integrity.ts` — existing integrity classification
- `paste-dashboard/src/components/integrity-badge.tsx` — existing badge component
- `paste-dashboard/src/lib/scan-processor.ts` — trade detection logic
- `paste-dashboard/src/lib/twitter-fetch.ts` — tweet fetching
- `paste-dashboard/src/lib/db.ts` — SQLite schema
- `paste-dashboard/src/app/leaderboard/page.tsx` — leaderboard to enhance

## Deliverable
1. `src/lib/completeness.ts` — audit pipeline and scoring
2. `src/components/audit-badge.tsx` — visual badge component
3. `/audit/[handle]` page with full transparency report
4. Missing calls section with evidence
5. Leaderboard integration with audit grades
6. Auto-audit cron endpoint
7. Audit API endpoints
8. SQLite table for audit results
9. `/api/og/audit/[handle]` OG image
10. "Add Missing Calls" CTA for callers to improve their score
