# Feature: Leaderboards

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun runtime, Cloudflare Workers backend, JSONL file storage locally, relational DB + JSON blobs on the backend API. Frontend is Next.js-style pages served from Cloudflare. The existing search API is `GET /api/search`. Key scripts live in `/scripts/`, types in `/types.ts`, shared P&L logic in `/shared/pnl.ts`.

The existing `/api/search` endpoint supports filtering by ticker, author, direction, platform, and `top_performers`. Trades have: `ticker`, `author_handle`, `direction`, `platform`, `source_date`, `created_at_price`, `publish_price`, `since_published_move_pct`.

---

## What to Build
A leaderboard page that ranks callers by their tracked trade performance, with multiple timeframe and metric views.

### New API endpoint:
`GET /api/leaderboard?timeframe=alltime|week|today&metric=pnl|winrate|active`

This can be built on top of the existing `/api/search` by aggregating results grouped by `author_handle`. If search doesn't support aggregation server-side, the leaderboard worker should fetch all trades and aggregate.

**Response shape:**
```ts
{
  timeframe: "alltime" | "week" | "today",
  metric: "pnl" | "winrate" | "active",
  entries: [
    {
      rank: number,
      handle: string,
      displayName: string,
      avatarUrl: string,
      verified: boolean,
      totalCalls: number,
      winRate: number,          // % of calls where since_published_move_pct > 0 (for long), < 0 (for short)
      avgPnlPercent: number,
      totalPnlPercent: number,  // sum of all call PnLs (not compounded)
      bestCall: {
        ticker: string,
        pnlPercent: number,
        tradeUrl: string        // https://paste.trade/s/{trade_id}
      },
      callsThisPeriod: number
    }
  ]
}
```

### Leaderboard variants (tabs):
1. **All Time** — ranked by `totalPnlPercent` (sum of all call performance)
2. **This Week** — only calls where `source_date` is within last 7 days
3. **Today** — last 24 hours
4. **Win Rate** — ranked by `winRate`, min 5 calls to qualify (prevents 1-trade wonders)
5. **Most Active** — ranked by `totalCalls` in the timeframe

### Anti-gaming rules in the aggregation logic:
- Minimum 3 calls to appear on any leaderboard
- For Win Rate tab: minimum 5 calls
- Only count calls where `publish_price` exists (the call was made through paste.trade, not retroactively added)
- If `source_date` is more than 7 days before `created_at` (submit timestamp), mark as retroactive and exclude from leaderboard counts (they can still appear in profile but with a flag)

### Frontend page: `/leaderboard`

**Layout:**
- Page title: "Leaderboards"
- Timeframe tabs: All Time | This Week | Today | Win Rate | Most Active
- Ranked table with columns: Rank, Caller (avatar + handle), Calls, Win Rate, Avg PnL, Best Call, Total PnL
- Top 3 rows get gold/silver/bronze highlight or medal badge
- Each row: clicking the handle goes to `/[handle]` profile page
- Each "Best Call" links to `https://paste.trade/s/{trade_id}`
- Verified badge next to handle if `verified: true`
- Win rate shown in green if > 50%, red if < 50%
- Mobile responsive (collapse less important columns on small screens)

**Empty states:**
- "No calls in this period yet" for Today/Week if no data
- Loading skeleton while fetching

### Caching:
- Cache leaderboard results for 5 minutes (leaderboard doesn't need real-time)
- Use Cloudflare Cache API or KV for caching

### Files to read first:
- `/references/search-api.md` — understand existing search API params
- `/references/index/trade-index.md` — DB schema
- `/shared/pnl.ts` — P&L calculation logic to reuse for win/loss determination
- `/types.ts` — existing type definitions

## Deliverable:
1. `GET /api/leaderboard` Cloudflare Worker route with timeframe + metric query params
2. Aggregation logic: group trades by `author_handle`, compute stats
3. `/leaderboard` frontend page with tab navigation and ranked table
4. Caching layer
5. Mobile responsive styling matching existing paste.trade design
