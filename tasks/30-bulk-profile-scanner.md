# Task: Bulk Profile Scanner — Upgrade Tweet Fetching with XActions + Promote Scans to Full Profiles

> **IMPORTANT: Only work inside `/workspaces/agent-payments-sdk/paste-dashboard/`. Do NOT touch any files outside this folder. The parent repo `agent-payments-sdk` is private and `paste-dashboard` pushes to the public `nirholas/paste-markets` remote.**

## Context

The scan feature already works end-to-end (POST handle → Claude Haiku detects trades → submits to paste.trade → gets PnL → stores results). But it has two major gaps:

1. **Tweet fetching is fragile** — current 3-tier fallback (Twitter API v2 → Nitter RSS → Playwright) is unreliable. We own `nirholas/xactions` which has a battle-tested Twitter GraphQL scraper that works without API keys.

2. **Scan results are dead-ends** — results live in a `result_json` blob in `scan_jobs` table. They don't flow into the `authors` + `trades` tables, so scanned callers never appear in leaderboards or get proper profile pages.

---

## Part 1: Replace Tweet Fetching with XActions

### Current code: `src/lib/twitter-fetch.ts`
Currently exports `fetchUserTweets(handle, maxTweets)` with 3 fallback strategies.

### What xactions provides: `github.com/nirholas/xactions`
- `src/scrapers/twitter/http/tweets.js` → `scrapeTweets(client, username, { limit })`
- `src/scrapers/twitter/http/client.js` → `TwitterHttpClient` (GraphQL-based, no API key needed)
- `src/scrapers/twitter/http/profile.js` → user profile data
- Uses Twitter's internal GraphQL API directly — no bearer token, no Nitter, no Playwright
- Returns normalized tweet objects with `id`, `text`, `created_at`, `url`, `author`

### Plan
1. Install xactions as a dependency: `npm install nirholas/xactions` (or copy the relevant scraper files into `src/lib/xactions/`)
2. Rewrite `twitter-fetch.ts` to use xactions as primary strategy:
   ```
   Primary:  xactions TwitterHttpClient → scrapeTweets()
   Fallback: existing Twitter API v2 (if TWITTER_BEARER_TOKEN set)
   ```
3. Drop Nitter RSS (unreliable) and Playwright (heavy) fallbacks
4. The `Tweet` interface stays the same: `{ id, text, created_at, url }`
5. Map xactions tweet format → existing Tweet interface

### Key files in xactions to reference
```
xactions/src/scrapers/twitter/http/client.js   — TwitterHttpClient class
xactions/src/scrapers/twitter/http/tweets.js   — scrapeTweets(client, username, opts)
xactions/src/scrapers/twitter/http/profile.js  — scrapeProfile(client, username)
xactions/src/scrapers/twitter/http/auth.js     — cookie/session auth helpers
xactions/src/scrapers/twitter/http/endpoints.js — GraphQL endpoint definitions
xactions/src/scrapers/twitter/http/errors.js   — error types
```

---

## Part 2: Promote Scan Results to Full Profiles

### Problem
When a scan completes, the results sit in `scan_jobs.result_json`. The caller doesn't appear in:
- The `authors` table (no profile page at `/[handle]`)
- The `trades` table (no individual trade records)
- The `rankings` table (no leaderboard entry)
- Reputation scoring (never computed)

### Plan
After `processScanJob()` completes successfully in `src/lib/scan-processor.ts`:

1. **Upsert into `authors` table** — create/update the author record with computed metrics:
   - `handle`, `display_name`, `total_trades`, `win_count`, `loss_count`
   - `win_rate`, `avg_pnl`, `best_pnl`, `worst_pnl`, `best_ticker`, `worst_ticker`

2. **Insert into `trades` table** — for each detected call with PnL:
   - `author_handle`, `ticker`, `direction`, `pnl_pct`, `platform`
   - `entry_date` (tweet timestamp), `source_url` (tweet URL)
   - `integrity` = classify using existing `classifyIntegrity()` from `src/lib/integrity.ts`
   - `tweet_id`, `tweet_created_at`, `submitted_at`

3. **Compute reputation** — run `computeReputation()` from `src/lib/reputation.ts` on the new trades

4. **Update rankings** — insert into `rankings` table so they appear on leaderboard

### Key existing functions to use
```typescript
// src/lib/db.ts
upsertAuthor(author)        // create/update author record
upsertTrades(trades)        // bulk insert trades
updateAuthorMetrics(handle)  // recompute aggregated stats

// src/lib/integrity.ts
classifyIntegrity(tweetCreatedAt, submittedAt)

// src/lib/reputation.ts
computeReputation(trades)

// src/lib/metrics.ts
computeMetrics(trades)       // full metrics object
```

### Modified flow in scan-processor.ts
```
processScanJob(jobId, handle)
  ├── setJobRunning(id)
  ├── fetchUserTweets(handle, 200)        ← NOW USES XACTIONS
  ├── for each tweet:
  │     detectTrade() via Claude Haiku
  │     if confidence >= 0.7 → submit to paste.trade
  ├── computeStats()
  ├── completeJob(id, result)
  │
  └── NEW: promoteToProfile(handle, result)
        ├── upsertAuthor(handle, metrics)
        ├── upsertTrades(detectedCalls)
        ├── computeReputation(trades)
        └── updateRankings(handle)
```

---

## Part 3: UI Improvements to Scanner Page

### Current: `src/app/scan/page.tsx` + `src/components/scanner-client.tsx`

### Enhancements
1. After scan completes, show a **"View Full Profile"** button linking to `/[handle]`
2. Show reputation score + tier badge in results
3. Add **"Compare"** button to go to `/vs/[scanned]/[other]`
4. Show integrity breakdown (what % of calls were live vs late vs historical)
5. Recent scans section should link to the now-real profile pages

---

## Existing Files to Modify

| File | Change |
|------|--------|
| `src/lib/twitter-fetch.ts` | Replace with xactions-based fetching |
| `src/lib/scan-processor.ts` | Add `promoteToProfile()` step after completion |
| `src/lib/scan-db.ts` | No changes needed |
| `src/lib/db.ts` | May need to ensure `upsertAuthor`/`upsertTrades` handle scan-sourced data |
| `src/components/scanner-client.tsx` | Add profile link, reputation badge, integrity breakdown |
| `src/app/scan/page.tsx` | Minor updates to pass new data |
| `package.json` | Add xactions dependency if installing as package |

## Acceptance Criteria
- [ ] Tweet fetching uses xactions GraphQL scraper as primary method
- [ ] Scan results create real author + trade records in SQLite
- [ ] Scanned callers appear on leaderboard after scan completes
- [ ] Scanned callers have working profile pages at `/[handle]`
- [ ] Reputation score is computed and displayed for scanned callers
- [ ] "View Full Profile" button appears after scan completion
- [ ] Integrity classification applied to all scanned trades
- [ ] Fallback to Twitter API v2 if xactions fails
