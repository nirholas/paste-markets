# Task 47: Narrative Tracker / "What's CT Talking About?"

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/narratives` page that groups trades by themes/narratives instead of individual tickers. "AI" narrative includes $NVDA, $AMD, $MSFT, $GOOG. "Memecoin Season" includes $DOGE, $PEPE, $WIF. Shows what macro themes CT is betting on.

## Steps

### 1. Narrative definitions
Create `src/lib/narratives.ts`:
```typescript
export const NARRATIVES: Record<string, Narrative> = {
  ai: {
    name: 'AI',
    tickers: ['NVDA', 'AMD', 'MSFT', 'GOOG', 'META', 'SMCI', 'ARM'],
    color: '#3b82f6',
    description: 'Artificial intelligence and compute plays',
  },
  memecoins: {
    name: 'Memecoins',
    tickers: ['DOGE', 'PEPE', 'WIF', 'BONK', 'SHIB'],
    color: '#f39c12',
    description: 'Degen memecoin bets',
  },
  defi: {
    name: 'DeFi',
    tickers: ['ETH', 'SOL', 'AVAX', 'UNI', 'AAVE'],
    color: '#2ecc71',
    description: 'Decentralized finance protocols',
  },
  macro: {
    name: 'Macro',
    tickers: ['SPY', 'QQQ', 'TLT', 'DXY', 'GLD'],
    color: '#c0c0c0',
    description: 'Macro and index plays',
  },
  politics: {
    name: 'Politics',
    tickers: [], // Polymarket events tagged as political
    color: '#e74c3c',
    description: 'Political prediction markets',
    isPredictionMarket: true,
  },
};
```

### 2. API route
Create `src/app/api/narratives/route.ts`:
- `GET /api/narratives?timeframe=7d`
- Groups trades by narrative
- Returns per-narrative: call_count, avg_pnl, direction_consensus, top_callers
- Sorted by activity (most calls first)

### 3. Build the page
Create `src/app/narratives/page.tsx`:

Layout:
- Header: "What's CT Betting On?"
- Narrative cards in a grid:
  ```
  🤖 AI — 34 calls this week
  Consensus: 80% LONG
  Avg P&L: +6.2%
  Top callers: @frank, @alex, @trader
  ████████░░ bullish
  ```
- Each card clickable → expands to show individual trades in that narrative
- Timeframe selector

### 4. Narrative detail view
Create `src/app/narratives/[id]/page.tsx`:
- Narrative name + description
- All tickers in this narrative with individual stats
- Trade list filtered to this narrative
- Consensus meter (conviction bar)
- Timeline: when did CT start talking about this?

### 5. Design
- Each narrative has its own accent color (defined in config)
- Cards with colored left border matching narrative
- Consensus bar using narrative color
- Grid: 2 columns desktop, 1 mobile
