# Task 50: Smart Money Flow Indicator

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a "Smart Money vs Dumb Money" flow indicator. Segment callers into tiers by historical accuracy and show whether smart money (high win-rate callers) is buying or selling a given ticker. This is institutional-grade analysis applied to CT.

## Steps

### 1. Caller tiers
Create `src/lib/smart-money.ts`:
```typescript
// Tier callers by historical win rate:
// Smart Money: top 20% by win rate (min 20 trades)
// Average: middle 60%
// Dumb Money: bottom 20%

export function getSmartMoneyFlow(ticker: string, timeframe: string): SmartMoneyFlow {
  // For a given ticker, compute:
  // - How many smart money callers are long vs short
  // - How many dumb money callers are long vs short
  // - Divergence signal: if smart money and dumb money disagree, that's alpha
}
```

### 2. API route
Create `src/app/api/flow/route.ts`:
- `GET /api/flow?ticker=NVDA&timeframe=7d`
- Returns: smart_long, smart_short, dumb_long, dumb_short, signal

### 3. Flow page
Create `src/app/flow/page.tsx`:

Layout:
- Ticker search at top
- For each ticker:
  ```
  $NVDA Smart Money Flow
  ━━━━━━━━━━━━━━━━━━━━━
  Smart Money (>65% WR):  ████████░░ 80% LONG
  Average:                ██████░░░░ 60% LONG
  Dumb Money (<40% WR):   ░░░░░░████ 30% LONG (70% SHORT)

  Signal: BULLISH (smart money buying, dumb money fading)
  ```
- Signal interpretation: when smart and dumb money diverge → strong signal
- Historical accuracy of the signal

### 4. Divergence alerts
Highlight tickers where smart and dumb money strongly disagree:
- "Divergence Detected" section on the page
- These are the highest-conviction signals

### 5. Design
- Smart money: gold (#f39c12) accent
- Dumb money: red (#e74c3c) accent
- Signal badges: BULLISH (green), BEARISH (red), NEUTRAL (gray)
- Clean, data-dense layout — this targets sophisticated users
