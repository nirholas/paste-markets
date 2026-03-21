# Task 14: Build Trade Detail Page

## Goal
Build a dedicated page for each individual trade showing the full trade card with thesis, chain of reasoning, P&L chart, and sharing options. When someone shares a paste.markets trade link on Twitter, the OG image should show the trade card.

## Context

- paste.trade API: `GET /api/search` returns trades with full details
- Each trade has a `trade_id` field
- Design system: Bloomberg terminal dark theme
- Existing components: PnlDisplay, WinRateBar, Card

## What To Build

### 1. API route

Create `src/app/api/trade/[id]/route.ts`:

```typescript
GET /api/trade/[id]
```

- Fetches the specific trade from paste.trade (search by trade_id or use a direct endpoint if available)
- Returns the full trade object
- Falls back to searching recent trades and filtering by trade_id

### 2. Trade detail page

Create `src/app/trade/[id]/page.tsx`:

Layout:
- Full trade card at top (expanded version of the feed card)
  - Author handle + avatar placeholder
  - Thesis (full text, not truncated)
  - All chain steps displayed (numbered, not collapsed)
  - Full explanation text
  - Ticker + direction + platform
  - Entry price → current price with P&L
  - Source link (original tweet/article)
  - Timestamp
- "Share Trade" button → Twitter intent with trade stats
- "View Author Profile" link → /@handle
- "More from @handle" section at bottom showing 3 other trades by same author

### 3. Dynamic OG image

Add a case to the existing OG route at `src/app/api/og/[...slug]/route.tsx`:

`/api/og/trade/[id]` should generate a 1200x630 image showing:
- Ticker + direction prominently
- Author handle
- P&L percentage (big, colored)
- Entry price → current price
- Short thesis quote
- "paste.markets" watermark

### 4. Dynamic metadata

```typescript
export async function generateMetadata({ params }) {
  // Fetch trade data
  // Return title: "$TICKER DIRECTION by @handle | paste.markets"
  // OG image pointing to /api/og/trade/[id]
}
```

## Validation

1. `cd paste-dashboard && npx next build` — clean
2. Trade detail page renders with real data
3. OG image generates correctly
4. Share button works
5. Links work (author profile, source)

## Do NOT

- Build a P&L chart (save for later — just show current P&L)
- Create a comments/discussion section
- Break existing trade finder at /trade
