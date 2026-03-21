# Task 15: Recent Trades Feed — Homepage & Leaderboard

## Goal
Build a live trades feed that surfaces individual trade cards from all CT callers, not just author-level rankings. This is the core content of paste.markets — every trade that comes through paste.trade, visible to anyone without needing to know whose handle to look up.

## Context
- paste.trade's search API: `GET https://paste.trade/api/search` with no `author` param may return recent trades globally — test this
- Known working: `GET https://paste.trade/api/search?author={handle}&top=7d&limit=50`
- The existing leaderboard syncs known authors from `src/lib/sync.ts` and stores in SQLite
- Trade data has: `ticker`, `direction`, `platform`, `pnlPct`, `entryPrice`, `currentPrice`, `posted_at`, `source_url`, `author_handle`
- Auth: `Bearer ${PASTE_TRADE_KEY}`
- The `TradeCard` component will be built in Task 14 — import it from `src/components/trade-card.tsx`

## What To Build

### 1. `src/app/api/trades/route.ts`
```
GET /api/trades?timeframe=7d&limit=20&sort=pnl&platform=all
```
- Pulls trades from all known authors in the local DB
- `timeframe`: "7d" | "30d" | "90d" | "all" (default: "7d")
- `sort`: "pnl" | "recent" (default: "recent")
- `platform`: "all" | "hyperliquid" | "polymarket" | "robinhood" (default: "all")
- `limit`: max 50 (default: 20)
- Returns flat array of trades with `author_handle` included on each

Implementation: query the local SQLite `trades` table (already populated by sync), join with `authors` for handle. Return sorted results.

### 2. `src/app/feed/page.tsx` — new Trades Feed page
A page at `/feed` showing:

```
Recent Trades                              [7d ▾] [All Platforms ▾]

[TradeCard] SOL LONG +13.6% · @frankdegods · 2h ago
[TradeCard] HIMS LONG +39.9% · @whoever · 4h ago
[TradeCard] CL SHORT -5.2% · @someone · 6h ago
...

[Load more]
```

- Server-rendered first 20, client-side load more
- Filter controls: timeframe dropdown, platform filter
- Each TradeCard links to `/trade/[source_id]` if source_url available, else to `/{author_handle}`

### 3. Update `src/app/page.tsx` — homepage
Add the feed as a tab or section below the hero:

```
[Leaderboard]  [Recent Trades]  ← tab switcher

(existing leaderboard OR the trades feed depending on active tab)
```

OR: Keep leaderboard as-is and add a "Recent Trades" section below it showing the top 5 most recent high-P&L trades with a "See all →" link to `/feed`.

Use whichever approach fits better with the existing homepage layout — read `src/app/page.tsx` first.

### 4. Update nav
In `src/components/ui/nav.tsx`, add "Feed" link pointing to `/feed`.

## Data Shape Expected from `/api/trades`
```typescript
interface FeedTrade {
  id: string;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform?: string;
  pnlPct?: number;
  entryPrice?: number;
  currentPrice?: number;
  posted_at: string;
  source_url?: string;
  author_handle: string;
}
```

## Empty State
If no trades in DB yet:
```
No trades yet.
Be the first — submit a tweet at /trade
```

## Design
- Follow Bloomberg terminal dark theme (CLAUDE.md)
- Feed items: compact trade card, single row on desktop, full card on mobile
- Filter dropdowns: match existing UI style — border border-[#1a1a2e] bg-[#0f0f22]
- Positive P&L rows: subtle green left border or background tint
- Negative P&L rows: subtle red left border

## Validation
1. `cd paste-dashboard && npx next build` — must be clean
2. `/feed` renders without crashing even if DB has no trades
3. Filters work client-side (no page reload)
4. Nav includes "Feed" link

## Do NOT
- Make a new paste.trade API call for every row — use local SQLite data
- Break existing leaderboard, author profile, or other pages
- Add infinite scroll — a simple "Load more" button is fine
- Show duplicate trades
