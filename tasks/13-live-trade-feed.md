# Task 13: Build Live Trade Feed Page

## Goal
Build a real-time feed of all trades being posted to paste.trade, displayed as trade cards on paste.markets. This is the "market" view — like a Bloomberg terminal ticker but for CT trade calls.

## Context

- paste.trade API: `GET /api/search?top=7d&limit=50` returns recent trades
- Each trade has: trade_id, ticker, direction, platform, author_handle, pnl_pct, author_price, posted_price, current_price, thesis, chain_steps, explanation, source_url, author_date
- Auth: Bearer token via `PASTE_TRADE_KEY`
- Data layer: use `@/lib/data` for all imports
- Design system: Bloomberg terminal dark theme (bg: #0a0a1a, surface: #0f0f22, etc.)

## What To Build

### 1. API route

Create `src/app/api/feed/route.ts`:

```typescript
GET /api/feed?limit=50&offset=0&ticker=SOL&platform=hyperliquid
```

- Fetches from paste.trade search API
- Supports filtering by ticker and platform
- Returns normalized trade cards
- Cache with 60s revalidation

### 2. Trade card component

Create `src/components/trade-card.tsx`:

A single trade card showing:
- Author handle (links to /@handle profile)
- Thesis quote (the headline_quote)
- Ticker + Direction badge (e.g. "$SOL LONG" — green for long, red for short)
- Platform badge (Robinhood / Hyperliquid / Polymarket)
- P&L display with color (green positive, red negative)
- Price: entry → current
- Time ago (e.g. "3d ago")
- Chain steps (collapsible, show first step + "show more")
- Source link (links to original tweet/article)

Design: Each card is a `bg-surface border border-border rounded-lg p-5` with hover state. Cards stack vertically. Bloomberg terminal aesthetic.

### 3. Feed page

Create `src/app/feed/page.tsx`:

- Header: "LIVE FEED" with subtitle "Real-time trade calls from CT"
- Filter bar: ticker search input, platform toggle (All / Stocks / Perps / Prediction Markets)
- Scrollable list of trade cards
- "Load more" button at bottom (or infinite scroll)
- Auto-refresh every 60 seconds
- Empty state: "No trades yet"
- OG metadata

### 4. Navigation

Add "Feed" link to the nav component at `src/components/ui/nav.tsx`

### 5. Home page integration

On the landing page (`src/app/page.tsx`), add a "RECENT TRADES" section below the feature cards showing the 3 most recent trades as mini trade cards.

## Validation

1. `cd paste-dashboard && npx next build` — clean
2. Feed page shows real trades from paste.trade API
3. Filters work
4. Trade cards look professional and match the design system
5. Links to author profiles work

## Do NOT

- Use fake/mock data
- Build a WebSocket connection (polling every 60s is fine)
- Over-engineer infinite scroll (simple "load more" button is fine)
- Break existing pages
