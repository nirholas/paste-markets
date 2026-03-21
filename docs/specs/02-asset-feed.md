# Feature: Asset-Based Trade Feed

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun runtime, Cloudflare Workers backend, JSONL local storage, relational DB + JSON blobs on the backend. Existing search: `GET /api/search?ticker=BTC&limit=100`. Trades have: `ticker`, `author_handle`, `direction` (long/short), `platform` (hyperliquid/robinhood/polymarket), `source_date`, `created_at_price`, `publish_price`, `since_published_move_pct`. Live trade cards at `https://paste.trade/s/{trade_id}`. The search API already supports filtering by `ticker`.

---

## What to Build
An asset-centric view: for any ticker, show every call ever tracked, aggregate stats, and who calls it best.

### New API endpoints:
```
GET /api/assets               — list all tickers with ≥1 tracked call
GET /api/assets/[ticker]      — all calls + stats for a specific ticker
```

**`/api/assets` response:**
```ts
{
  assets: [
    {
      ticker: string,
      callCount: number,
      winRate: number,
      avgPnlPercent: number,
      lastCallAt: string,    // ISO date
      platform: string[]     // which venues have been used for this ticker
    }
  ]
}
```

**`/api/assets/[ticker]` response:**
```ts
{
  ticker: string,
  currentPrice: number,
  totalCalls: number,
  winRate: number,
  avgPnlPercent: number,
  bullCount: number,         // long calls
  bearCount: number,         // short calls
  bestCall: {
    handle: string,
    pnlPercent: number,
    sourceDate: string,
    tradeUrl: string
  },
  topCallers: [
    {
      handle: string,
      callCount: number,     // calls on THIS asset specifically
      winRate: number        // win rate on THIS asset
    }
  ],
  trades: TradeCard[]        // same shape as existing search results, sorted by pnlPercent desc
}
```

### Frontend pages:

**`/assets` — Discovery grid:**
- Search bar: "Find an asset..." (filters the grid)
- Grid of asset cards, each showing:
  - Ticker symbol (large, bold)
  - # calls tracked
  - Avg PnL badge (green if positive, red if negative)
  - Bull/Bear call ratio (e.g. "68% bull")
  - Last call date
- Sort by: Most Calls | Best Avg PnL | Most Recent | Trending (most calls in last 7 days)
- Empty state: "No calls tracked for this asset yet — paste a tweet to add one"

**`/assets/[ticker]` — Asset detail page:**

Top section (stats bar):
```
BTC — Bitcoin
$85,420   |   47 calls   |   Win Rate: 68%   |   Avg PnL: +14.2%
Long: 31  |   Short: 16  |   Best call: +340% by @zacxbt
```

Tabs:
- **All Calls** — table of every call, sortable by PnL, Date, Platform
- **Top Callers** — ranked list of who calls this asset most accurately
- **Timeline** — chart of calls over time (scatter plot: x=date, y=PnL at settle)

Calls table columns:
- Caller (avatar + handle, links to profile)
- Direction (🟢 Long / 🔴 Short)
- Entry price (author's price)
- PnL % (color coded)
- Date called
- Platform badge (HL / RH / PM)
- Tweet link + Trade card link

"Top Callers" tab shows: rank, handle, calls on this asset, win rate on this asset, avg PnL on this asset.

### Live price on asset pages:
- Fetch current price from the same Hyperliquid/Yahoo Finance APIs already used in `/scripts/route.ts`
- Show "as of X minutes ago" freshness indicator
- Auto-refresh every 60 seconds

### Ticker search / navigation:
- Add ticker search to the main site header (autocomplete from `/api/assets`)
- Clicking a ticker anywhere on the site (trade card, leaderboard, etc.) links to `/assets/[ticker]`

### Files to read first:
- `/references/search-api.md` — existing search params (already supports `ticker=`)
- `/shared/pnl.ts` — P&L calculation to determine win/loss
- `/adapters/hyperliquid/` — for fetching current price on-demand
- `/types.ts` — existing trade type shapes

## Deliverable:
1. `GET /api/assets` and `GET /api/assets/[ticker]` routes
2. `/assets` discovery page with search + grid
3. `/assets/[ticker]` detail page with stats, sortable calls table, top callers
4. Live price fetching on asset pages
5. Ticker links throughout the site (trade cards, leaderboard rows) point to asset pages
