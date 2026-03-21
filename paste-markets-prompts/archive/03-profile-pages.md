# Feature: Caller Profile Pages + Discovery

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun, Cloudflare Workers, JSONL storage, relational DB + JSON blobs. Existing search: `GET /api/search?author_handle=zacxbt`. Individual trade cards at `https://paste.trade/s/{trade_id}`. Share card images at `GET /api/og/share/{trade_id}`. Trades have: `ticker`, `author_handle`, `direction`, `platform`, `source_date`, `created_at_price`, `publish_price`, `since_published_move_pct`.

---

## What to Build
Public profile pages for every caller who has at least one tracked trade, plus a caller discovery page.

### New API endpoints:
```
GET /api/caller/[handle]      — full profile data
GET /api/callers              — discovery list with filters
```

**`/api/caller/[handle]` response:**
```ts
{
  handle: string,
  displayName: string,
  avatarUrl: string,
  bio: string,
  verified: boolean,
  firstCallAt: string,        // their earliest tracked call
  stats: {
    totalCalls: number,
    winRate: number,
    avgPnlPercent: number,
    totalPnlPercent: number,
    bestCall: TradeCard,
    worstCall: TradeCard,
    currentStreak: { type: "W" | "L", count: number },
    liveCallCount: number,    // calls submitted within 1h of tweet
    lateCallCount: number     // submitted more than 1h after tweet
  },
  topAssets: [
    { ticker: string, callCount: number, winRate: number }
  ],
  recentTrades: TradeCard[],   // last 20
  pnlHistory: [
    { date: string, cumulativePnl: number, tradeId: string }
  ]
}
```

The profile data is built by calling `GET /api/search?author_handle={handle}&limit=500` and aggregating. Cache results per handle for 10 minutes.

**`/api/callers` response:**
```ts
{
  callers: [
    {
      handle: string,
      displayName: string,
      avatarUrl: string,
      verified: boolean,
      totalCalls: number,
      winRate: number,
      avgPnlPercent: number,
      topAsset: string,
      lastCallAt: string
    }
  ],
  total: number,
  page: number
}
```
Supports query params: `sort=winrate|pnl|active|new`, `asset=BTC`, `platform=hyperliquid`, `page=1`

### Frontend pages:

**`/[handle]` — Caller profile page** (e.g. `paste.trade/zacxbt`):

Header:
- Large avatar
- Display name + @handle + verified badge
- Bio (from Twitter, if available)
- "View on X" button
- "First seen" date on paste.markets

Stats bar (the key numbers):
```
47 Calls  |  68% Win Rate  |  +14.2% Avg PnL  |  +340% Best Trade  |  W3 Streak
```

Cumulative PnL chart:
- Line chart (use recharts or Chart.js)
- x = date of each call, y = running cumulative PnL %
- Each data point is clickable → jumps to that trade card
- Green line overall if positive, shows red dips

Asset breakdown (horizontal bar or tag list):
- "BTC: 8 calls (75% WR) | ETH: 5 calls (60% WR) | TRUMP: 3 calls (33% WR)"
- Each asset links to `/assets/[ticker]`

Recent calls table:
- Ticker, Direction, Entry price, PnL %, Date, Platform badge, Tweet link, Trade card link
- Sortable: Date (default) | PnL
- Paginated: 10 per page, load more button

Best 5 calls (highlight cards):
- Shown above the full table
- Each card: ticker, direction, PnL %, "called X days ago", link

Worst call (shown small, for transparency):
- Single row: "Worst: -45% on DOGE, Jan 2026"

**`/callers` — Discovery page:**

Header: "Find Your Alpha Sources"

Filters bar:
- Sort by: Win Rate | Total PnL | Most Active | Newest | Trending (most calls last 7 days)
- Filter by Asset (dropdown of all tracked tickers)
- Filter by Platform (HL / Robinhood / Polymarket)
- Search: text input, filter by handle/display name

Caller cards grid (3 columns desktop, 1 mobile):
- Avatar, name, @handle
- Primary stat based on current sort (e.g. "68% Win Rate" or "+$14.2% Avg PnL")
- Top 3 assets they call (as small badges)
- "View Profile" → links to `/{handle}`

### OG Image for profiles:
When sharing `paste.trade/zacxbt` on Twitter, the og:image should show a stat card:
- Handle + avatar
- Win rate + total calls
- Best call highlight
- "View on paste.markets" text

Reuse the existing `/api/og/share/` infrastructure to build `/api/og/caller/[handle]` that generates a PNG stat card.

### Twitter metadata for profile pages:
Each profile page should have:
```html
<meta property="og:title" content="@zacxbt on paste.trade — 68% Win Rate, 47 Calls" />
<meta property="og:image" content="https://paste.trade/api/og/caller/zacxbt" />
<meta name="twitter:card" content="summary_large_image" />
```

### Files to read first:
- `/references/search-api.md` — `author_handle` search param
- `/shared/pnl.ts` — win/loss determination
- `/types.ts` — TrackedTrade, TradeExpression types
- Any existing OG image generation code in `/api/og/share/`

## Deliverable:
1. `GET /api/caller/[handle]` — aggregates search results + computes stats
2. `GET /api/callers` — discovery list with sort/filter params
3. `GET /api/og/caller/[handle]` — PNG stat card for OG sharing
4. `/[handle]` profile page with all sections
5. `/callers` discovery page with filters
6. OG meta tags on profile pages
7. Caller handle links throughout the site (trade cards, leaderboard) → profile pages
