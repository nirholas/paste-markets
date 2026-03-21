# Task 17: Build Ticker Heatmap Page

## Goal
Build a visual heatmap showing what tickers CT is trading right now, sized by volume and colored by sentiment (bullish green / bearish red). Think Finviz heatmap but for CT trade calls.

## Context

- paste.trade API returns trades with ticker, direction, pnl_pct
- We can aggregate: how many calls per ticker, net direction (more longs = bullish), avg P&L
- Design system: Bloomberg terminal dark theme

## What To Build

### 1. API route

Create `src/app/api/heatmap/route.ts`:

```typescript
GET /api/heatmap?timeframe=7d
```

Returns:
```json
{
  "tickers": [
    {
      "ticker": "SOL",
      "calls": 12,
      "longs": 9,
      "shorts": 3,
      "avgPnl": 14.2,
      "sentiment": "bullish",
      "topCaller": "frankdegods"
    }
  ],
  "timeframe": "7d"
}
```

Fetch from paste.trade search API, group by ticker, compute aggregates.

### 2. Heatmap component

Create `src/components/ticker-heatmap.tsx` ("use client"):

- Treemap-style grid where each ticker is a rectangle
- Size = number of calls (more calls = bigger rectangle)
- Color = sentiment:
  - Strong bullish (>70% longs): bright green (#2ecc71)
  - Lean bullish (50-70% longs): dim green
  - Neutral: gray (#555568)
  - Lean bearish: dim red
  - Strong bearish (>70% shorts): bright red (#e74c3c)
- Each rectangle shows: $TICKER, call count, avg P&L
- Hover: show top caller, long/short breakdown
- Click: navigate to a filtered view or search

Implementation: Use CSS Grid with `grid-template-columns` and varying `grid-row` spans based on call count. No external charting library needed.

### 3. Heatmap page

Create `src/app/heatmap/page.tsx`:

- Header: "TICKER HEATMAP" with subtitle "What CT is trading right now"
- Timeframe toggle: 7D / 30D / 90D
- The heatmap component
- Below heatmap: top 5 tickers as a simple list with details
- OG metadata

### 4. Navigation

Add "Heatmap" to the nav

## Validation

1. `cd paste-dashboard && npx next build` — clean
2. Heatmap shows real ticker data
3. Colors correctly reflect sentiment
4. Sizes correctly reflect volume
5. Timeframe filter works

## Do NOT

- Use D3 or heavy charting libraries (CSS Grid is sufficient)
- Make it interactive beyond hover + click-to-navigate
- Show tickers with only 1 call (minimum 2 to appear on heatmap)
