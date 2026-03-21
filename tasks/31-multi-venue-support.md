# Task 31: Multi-Venue Display (Stocks + Perps + Prediction Markets)

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Enhance the UI to properly distinguish and filter trades across venues: Robinhood (stocks), Hyperliquid (perps), and Polymarket (prediction markets). Many reply tweets asked about specific venues. Each venue has different mechanics that need proper display.

## Steps

### 1. Venue configuration
Create `src/lib/venues.ts`:
```typescript
export const VENUES = {
  robinhood: {
    name: 'Robinhood',
    type: 'stocks',
    icon: '📈', // or SVG
    color: '#2ecc71',
    pnlLabel: 'P&L',
    directionLabels: { long: 'BUY', short: 'SELL' },
  },
  hyperliquid: {
    name: 'Hyperliquid',
    type: 'perps',
    icon: '⚡',
    color: '#3b82f6',
    pnlLabel: 'P&L',
    directionLabels: { long: 'LONG', short: 'SHORT' },
    showLeverage: true,
  },
  polymarket: {
    name: 'Polymarket',
    type: 'prediction',
    icon: '🎯',
    color: '#f39c12',
    pnlLabel: 'Outcome',
    directionLabels: { long: 'YES', short: 'NO' },
    showProbability: true,
  },
} as const;
```

### 2. Venue filter component
Create `src/components/venue-filter.tsx`:
- Pill/tab selector: All | Stocks | Perps | Predictions
- Each pill shows venue icon + count of trades
- Active pill has colored underline matching venue color
- Applies to leaderboard, profile, heatmap, and consensus pages

### 3. Update existing pages
Update these pages to support venue filtering (add the filter component and pass venue param to API calls):
- `/leaderboard` — filter leaderboard by venue
- `/[author]` — filter caller's trades by venue
- `/consensus` — show consensus per venue
- All API routes should accept `?venue=` parameter

### 4. Venue-specific trade card display
Update trade cards/rows to show:
- **Stocks**: `BUY $NVDA @ $142.50 → $156.20 (+9.6%)`
- **Perps**: `LONG $ETH 10x @ $3,200 → $3,450 (+78.1%)` (show leverage)
- **Prediction**: `YES "Will Trump win?" @ 65¢ → 82¢ (+26.2%)` (show probability)

### 5. Venue stats on profile
On caller profile, add a venue breakdown section:
```
Venue Performance
─────────────────
Stocks:      12 trades | 67% win | +4.2% avg
Perps:       8 trades  | 50% win | +1.1% avg
Predictions: 5 trades  | 80% win | +12.3% avg
```

### 6. Design
- Venue icons in colored circles
- Filter pills: transparent bg, venue-colored border when active
- Per-venue accent colors throughout
