# Feature: Caller Reputation Score

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun, Cloudflare Workers, JSONL + backend DB. Trades have: `ticker`, `author_handle`, `direction`, `platform`, `source_date`, `created_at_price`, `publish_price`, `since_published_move_pct`, and (after timestamp integrity feature): `integrity`, `delayMinutes`. P&L logic in `/shared/pnl.ts`.

Community quote: "scrape CT for alpha + clude remembers/learns who is alpha/tastemaker = profit" (@feikuu)

---

## What to Build

A composite **Reputation Score** (0-100) for every caller that captures not just win rate but call quality across multiple dimensions. This score powers the discovery feed, filters, and badges throughout the site.

### The Score Formula (0-100 points)

**Component 1 — Accuracy (40 pts max):**
- Win rate on `live` and `same_day` calls only (no cherry-picks)
- 40 pts = 80%+ win rate | 20 pts = 60% | 10 pts = 50% | 0 pts = <50%
- Weighted by call volume: a caller with 50 live calls is rated higher than 5

**Component 2 — Return Quality (25 pts max):**
- Median PnL per winning call (not average, to reduce outlier distortion)
- 25 pts = median win > +30% | 15 pts = +15% | 8 pts = +5% | 0 pts = flat
- Penalize: if losing calls avg > -30% (big losers drag score)

**Component 3 — Consistency (20 pts max):**
- Standard deviation of PnL across calls (lower = more consistent)
- 20 pts = std dev < 20% | 10 pts = 20-40% | 0 pts = > 40%
- A caller who consistently hits +15% beats one who sometimes hits +200% but often -50%

**Component 4 — Integrity (10 pts max):**
- % of calls submitted within 1h of tweet (`live` tier)
- 10 pts = 90%+ live | 6 pts = 70%+ | 3 pts = 50%+ | 0 pts = < 50%

**Component 5 — Breadth (5 pts max):**
- Variety of assets called (not just one-trick)
- 5 pts = 5+ unique tickers | 3 pts = 3-4 | 1 pt = 2 | 0 pts = 1 ticker only

**Minimum qualifying:**
- Need at least 5 `live` or `same_day` calls to get a score
- Callers with < 5 calls show "Not enough data" instead of a score

### Score tiers (shown as badges):

```
90-100: 🔮 "Oracle"
75-89:  ⚡ "Alpha"
60-74:  ✅ "Reliable"
45-59:  📊 "Developing"
30-44:  ⚠️  "Mixed"
< 30:   — (no badge shown)
< 5 calls: 🆕 "New"
```

### API changes:
Add `reputationScore` and `reputationTier` to all caller-related responses:
- `GET /api/caller/[handle]` — include full score breakdown
- `GET /api/callers` — include score for sorting
- `GET /api/leaderboard` — include score as an optional column

New endpoint:
```
GET /api/caller/[handle]/score

Response:
{
  handle: string,
  score: number,             // 0-100
  tier: "Oracle" | "Alpha" | "Reliable" | "Developing" | "Mixed" | "New" | "Unranked",
  breakdown: {
    accuracy: { score: number, maxScore: 40, detail: string },
    returnQuality: { score: number, maxScore: 25, detail: string },
    consistency: { score: number, maxScore: 20, detail: string },
    integrity: { score: number, maxScore: 10, detail: string },
    breadth: { score: number, maxScore: 5, detail: string }
  },
  qualifyingCalls: number,
  totalCalls: number,
  lastCalculatedAt: string
}
```

### Score computation:
- Compute lazily when a profile is requested
- Cache in Cloudflare KV: `score:{handle}` with 30-minute TTL
- Recompute when a new call is posted by that caller (invalidate cache)

### UI changes throughout the site:

**On caller profile pages:**
Big score display under the name:
```
⚡ Alpha · 82/100
[See score breakdown →]
```
Clicking "See score breakdown" expands a panel showing each component with a horizontal bar chart.

**On leaderboard:**
- Add "Reputation Score" as a column (optional, shown by default)
- Allow sorting by score (Surface the best all-around callers, not just highest PnL)

**On trade cards:**
- Small tier badge next to the caller's avatar/name
- e.g. "zacxbt [⚡ Alpha]"

**On callers discovery page:**
- Sort by: Reputation Score (default for new visitors)
- Filter by tier: [All] [Oracle] [Alpha] [Reliable]

**On the home/feed page:**
- "Top Callers" sidebar widget showing top 5 by reputation score
- Each with score badge, win rate, and total calls

### Score history (stretch):
- Store a daily snapshot of each caller's score
- Show a "Score over time" sparkline on their profile
- If score drops significantly (e.g. a bad streak), it reflects in real-time

### Files to read first:
- `/shared/pnl.ts` — P&L calculation, win/loss determination
- `/types.ts` — TrackedTrade type
- `/references/index/trade-index.md` — DB fields available
- The integrity feature (prompt 05) — `integrity` field needed for Component 4

## Deliverable:
1. `calculateReputationScore(handle, trades[])` function in `/shared/reputation.ts`
2. `GET /api/caller/[handle]/score` endpoint with breakdown
3. Score added to `/api/callers` list responses (for sorting)
4. Cloudflare KV caching with 30-min TTL + cache invalidation on new call
5. Score badge component (reusable) shown on: trade cards, profiles, leaderboard, discovery
6. Tier filter on callers discovery page
7. "Top Callers by Reputation" widget for the home page
