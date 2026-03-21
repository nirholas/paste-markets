# Task: Alpha Discovery Pipeline — Auto-Find CT Accounts Worth Tracking

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard already has a `/discover` page for finding new callers and a `/scan` page for scanning individual accounts. The `xactions` npm package provides tweet search capabilities.

Community request from @feikuu: "scrape CT for alpha + clude remembers/learns who is alpha/tastemaker = profit"

From @Oncha1nd: "Just realized this is a perfect way to find good accounts and clean the slop from your feed."

From @anandymous17: "It would probably help finance-tweeting be a more merit based game."

The idea: instead of manually adding callers, automatically discover CT accounts that are making tradeable calls, scan them, score them, and surface the best ones.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Discovery Scanner — `src/lib/discovery-scanner.ts`

A module that searches Twitter for accounts making trade calls and evaluates them:

```ts
interface DiscoveryCandidate {
  handle: string
  displayName: string
  avatarUrl: string
  bio: string
  followers: number
  verified: boolean
  discoveredVia: "search" | "reply" | "mention" | "retweet"
  sampleTweets: string[]          // 3-5 trade-related tweets found
  estimatedCallFrequency: string  // "~5 calls/week"
  alreadyTracked: boolean
}
```

**Search strategies:**

1. **Keyword search** — search for tweets containing trade-related terms:
   ```
   "long $BTC" OR "short $ETH" OR "buying here" OR "entry at" OR "target" OR "stop loss"
   "bullish on" OR "bearish on" OR "going long" OR "shorting"
   ```
   Use `searchTweetsViaXactions(query)` from twitter-fetch.ts

2. **Network expansion** — look at who tracked callers interact with:
   - Accounts that top callers reply to or retweet
   - Accounts that reply to top callers with trade ideas

3. **Mention mining** — scan replies to paste.trade tweets for handles people suggest:
   - "you should track @XYZ" patterns
   - Nomination submissions from `/submit`

### 2. Candidate Scoring — `src/lib/discovery-score.ts`

Score each discovered account before adding to the tracker:

```ts
interface CandidateScore {
  handle: string
  signalScore: number        // 0-100: how trade-focused are their tweets?
  frequencyScore: number     // 0-100: how often do they post calls?
  audienceScore: number      // 0-100: follower count + engagement quality
  originalityScore: number   // 0-100: are they making their own calls vs retweeting?
  overallScore: number       // weighted composite
  recommendation: "track" | "review" | "skip"
}
```

Scoring weights:
```
signalScore:      40%  — most tweets should be trade-related, not memes
frequencyScore:   25%  — at least 2-3 calls per week to be trackable
audienceScore:    20%  — enough followers to matter, but not just engagement farming
originalityScore: 15%  — original analysis, not just retweeting others
```

Thresholds:
- `overallScore >= 70` → "track" (auto-add to watchlist)
- `overallScore >= 40` → "review" (show on discover page for human review)
- `overallScore < 40` → "skip"

### 3. Discovery cron — `src/app/api/cron/discover/route.ts`

A cron endpoint that runs the discovery pipeline:

```
GET /api/cron/discover          — run discovery scan
```

1. Run all search strategies
2. Deduplicate against already-tracked callers
3. Score each candidate
4. Store results in SQLite:

```sql
CREATE TABLE IF NOT EXISTS discovery_candidates (
  handle TEXT PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  followers INTEGER,
  verified INTEGER DEFAULT 0,
  discovered_via TEXT,
  signal_score INTEGER,
  frequency_score INTEGER,
  audience_score INTEGER,
  originality_score INTEGER,
  overall_score INTEGER,
  recommendation TEXT,
  sample_tweets TEXT,            -- JSON array
  discovered_at TEXT DEFAULT (datetime('now')),
  reviewed INTEGER DEFAULT 0,
  tracked INTEGER DEFAULT 0
);
```

### 4. Discovery API

```
GET  /api/discover                     — list candidates with filters
POST /api/discover/track/[handle]      — approve and start tracking a candidate
POST /api/discover/skip/[handle]       — mark as skipped
GET  /api/discover/stats               — discovery pipeline stats
```

**`GET /api/discover`:**
```ts
{
  candidates: DiscoveryCandidate[],
  total: number,
  filters: {
    recommendation: "track" | "review" | "skip" | "all",
    minScore: number,
    sort: "score" | "followers" | "newest"
  }
}
```

### 5. Frontend: Enhanced `/discover` page

Update the existing discover page with the auto-discovery results:

**Header:**
```
Discover New Alpha Sources
Pipeline last ran: 2 hours ago | 12 new candidates found
```

**Tabs:**
- "Recommended" — candidates with recommendation = "track" (auto-sorted by score)
- "Review" — candidates needing human approval
- "Recently Added" — candidates that were approved and are now being tracked
- "Skipped" — previously skipped (can un-skip)

**Candidate card:**
```
┌──────────────────────────────────────────────┐
│ [avatar] @CryptoTraderX · 14.2K followers    │
│ "Full-time perp trader. BTC, ETH, SOL."      │
│                                              │
│ Signal: ████████░░ 82                        │
│ Frequency: ██████░░░░ 65                     │
│ Audience: ███████░░░ 74                      │
│ Overall: 76 — RECOMMENDED                    │
│                                              │
│ Sample calls:                                │
│ • "Long BTC at 82k, target 90k" (Mar 15)    │
│ • "Short ETH/BTC ratio here" (Mar 12)       │
│                                              │
│ [Track This Caller]  [Skip]  [View on X]     │
└──────────────────────────────────────────────┘
```

**"Track This Caller" flow:**
1. Click track
2. Runs a quick scan (last 50 tweets) to get initial stats
3. Adds to leaderboard + watchlist
4. Shows confirmation: "Now tracking @CryptoTraderX — 8 calls found, 62% win rate"

### 6. Discovery insights widget on landing page

Add a small section to the landing page:

```
━━━ NEWLY DISCOVERED ━━━
3 new callers added this week
Top discovery: @NewTrader — 72% win rate across 12 calls
[View All Discoveries →]
```

---

## Files to Read First
- `paste-dashboard/src/app/discover/page.tsx` — existing discover page
- `paste-dashboard/src/lib/twitter-fetch.ts` — searchTweetsViaXactions function
- `paste-dashboard/src/lib/alpha.ts` — alpha scoring for reference
- `paste-dashboard/src/lib/scan-processor.ts` — trade detection logic
- `paste-dashboard/src/lib/db.ts` — SQLite schema

## Deliverable
1. `src/lib/discovery-scanner.ts` — search strategies for finding CT accounts
2. `src/lib/discovery-score.ts` — candidate scoring algorithm
3. `src/app/api/cron/discover/route.ts` — discovery cron job
4. `src/app/api/discover/route.ts` — discovery API with filters
5. `src/app/api/discover/track/[handle]/route.ts` — approve tracking
6. `src/app/api/discover/skip/[handle]/route.ts` — skip candidate
7. Updated `/discover` page with tabs, candidate cards, scoring bars
8. Discovery widget on landing page
9. SQLite table for discovery candidates
