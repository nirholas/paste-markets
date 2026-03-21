# Task 14: Trade Card Page — Display Individual Trades with Live P&L

## Goal
Build a shareable trade card page at `/trade/[source_id]` that displays a submitted trade source and its extracted trades with live P&L. This is the page users land on after submission, and the shareable unit that spreads paste.markets on Twitter.

## Context
- After `POST /api/sources`, paste.trade returns a `source_id`
- paste.trade's search API: `GET https://paste.trade/api/search?author={handle}` returns trades including `pnlPct`, `ticker`, `direction`, `platform`, `entryPrice`, `currentPrice`, `posted_at`, `source_url`
- We need to find trades that came from a specific source — search by `source_url` match or by `author_handle` after submission
- Auth: `Bearer ${PASTE_TRADE_KEY}` on all paste.trade API calls
- The existing `src/lib/paste-trade.ts` has the search client

## What To Build

### 1. `src/app/api/source/[id]/route.ts`
```
GET /api/source/[id]?handle={author_handle}
```
- Calls `GET https://paste.trade/api/search?author={handle}`
- Filters results to find trades whose `source_url` contains the original submitted URL or matches the source_id
- Returns the trades array + metadata
- If no handle is known, return empty and let the UI show "processing"

### 2. `src/app/trade/[source_id]/page.tsx`
A server component that:
- Reads `source_id` from params
- Reads `handle` and `original_url` from searchParams (passed through from submission)
- Fetches from `/api/source/[id]`
- Renders the trade card(s)

Page layout:
```
Source: [original tweet URL as clickable link]
Author: @handle
Submitted: [timestamp]

[Trade Card(s)]

Share on X | Back to Leaderboard
```

### 3. `src/components/trade-card.tsx` (new component)
A single trade card displaying:
```
┌─────────────────────────────────────────┐
│ TICKER    LONG/SHORT    PLATFORM        │
│ SOL       LONG          Hyperliquid     │
│                                         │
│ Entry: $185.20   Now: $210.40           │
│ P&L:  +13.6%  ████████░░               │
│                                         │
│ Thesis: "..."                           │
│ @author · Mar 21, 2026                  │
└─────────────────────────────────────────┘
```

Props:
```typescript
interface TradeCardProps {
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform?: string;
  entryPrice?: number;
  currentPrice?: number;
  pnlPct?: number;
  thesis?: string;
  authorHandle?: string;
  postedAt: string;
  sourceUrl?: string;
}
```

P&L display:
- Positive: green (#2ecc71), show +13.6%
- Negative: red (#e74c3c), show -5.2%
- Unknown/processing: amber (#f39c12), show "tracking..."
- Use the win-rate bar style (█ blocks) for a visual P&L bar

### 4. OG image for trade cards
Add metadata to `src/app/trade/[source_id]/page.tsx`:
```typescript
export async function generateMetadata({ params, searchParams }) {
  return {
    title: `${ticker} ${direction.toUpperCase()} · paste.markets`,
    description: `${pnlPct > 0 ? '+' : ''}${pnlPct}% · Track CT trade calls with real P&L`,
    openGraph: { ... }
  };
}
```

### 5. Update submission success state
In `src/app/trade/page.tsx` (from Task 13), after successful submission redirect or link to:
`/trade/{source_id}?handle={author_handle}&url={encodeURIComponent(original_url)}`

## Processing / Empty State
If no trades are found yet (paste.trade is still processing):
```
Processing...
paste.trade is extracting trades from this source.
This usually takes 30–60 seconds. Refresh to check.

[Refresh] [View on paste.trade →]
```

## Design
- Follow Bloomberg terminal dark theme (CLAUDE.md)
- Trade card: bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6
- Direction badge: LONG in green, SHORT in red, YES in blue, NO in red
- Platform as small uppercase label: color #555568

## Validation
1. `cd paste-dashboard && npx next build` — must be clean
2. Page renders without crashing when no trades found yet
3. Trade card displays correctly for long/short/yes/no directions
4. P&L colors correct: green positive, red negative, amber unknown

## Do NOT
- Fetch prices yourself — use pnlPct from paste.trade API
- Break existing `/api/author/[handle]` or leaderboard routes
- Add polling — a manual refresh link is fine for now
