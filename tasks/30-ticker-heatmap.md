# Task 30: Ticker Heatmap

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a visual heatmap showing which tickers are being called most and their aggregate P&L. Like a treemap/heatmap you'd see on finviz.com but for CT callers on paste.markets. Instantly shows what CT is trading and whether they're winning.

## Steps

### 1. API route
Create `src/app/api/heatmap/route.ts`:
- `GET /api/heatmap?timeframe=7d`
- Aggregates trades by ticker
- Returns: ticker, call_count, avg_pnl, total_volume, direction_split (% long vs short)
- Sorted by call_count descending

### 2. Build the page
Create `src/app/heatmap/page.tsx`:

Layout:
- Treemap visualization where:
  - Box SIZE = number of calls (more calls = bigger box)
  - Box COLOR = avg P&L (green gradient for positive, red for negative)
  - Box LABEL = ticker symbol + avg P&L %
- Timeframe selector: 24h / 7d / 30d
- Platform filter: All / Stocks / Perps / Prediction Markets
- Click a box → shows caller breakdown for that ticker

### 3. Treemap component
Create `src/components/ticker-heatmap.tsx` (client component):

Implementation with SVG:
- Use squarified treemap algorithm (can implement simple version or use d3-hierarchy)
- Each rectangle:
  - Fill: interpolate between red (#e74c3c) → neutral (#1a1a2e) → green (#2ecc71) based on P&L
  - Text: ticker symbol (bold, white) + P&L % below
  - Border: 1px solid #0a0a1a (gap between boxes)
- Hover: shows tooltip with full stats (calls, avg P&L, top callers)
- Click: expands to show caller list

### 4. Lightweight treemap algorithm
If avoiding d3, implement a simple squarified treemap:
```typescript
function squarify(items: { ticker: string; weight: number; pnl: number }[], bounds: Rect): Rect[]
```
- Sort items by weight descending
- Recursively divide the bounding rectangle
- Return positioned rectangles

### 5. Mobile view
On mobile, switch to a simple list/grid:
- 2-column grid of ticker cards
- Each card: ticker, call count, avg P&L with color coding
- Sorted by call count

### 6. Design
- Background: #0a0a1a
- Green scale: #0a2e1a → #2ecc71 (0% to +20%+)
- Red scale: #2e0a0a → #e74c3c (0% to -20%+)
- Neutral: #1a1a2e
- Labels: JetBrains Mono, white with text shadow for readability
- Tooltip: dark card (#0f0f22) with border
