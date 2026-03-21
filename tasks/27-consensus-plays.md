# Task 27: Consensus Plays / "CT Thinks..."

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a page showing what tickers multiple callers agree on. When 5+ callers are all long $NVDA, that's a consensus play. When 3 are long and 3 are short, that's a contested ticker. This is unique alpha that no other platform provides.

## Steps

### 1. Aggregation logic
Create `src/lib/consensus.ts`:
```typescript
interface ConsensusPlay {
  ticker: string;
  platform: string;
  long_count: number;
  short_count: number;
  callers_long: string[];   // handles
  callers_short: string[];
  avg_pnl_long: number;
  avg_pnl_short: number;
  consensus: 'strong_long' | 'strong_short' | 'contested' | 'mixed';
  conviction_score: number; // 0-100 based on agreement + caller quality
}
```

- Strong consensus: 80%+ same direction
- Contested: 40-60% split
- Weight by caller win rate (good callers' votes count more)

### 2. API route
Create `src/app/api/consensus/route.ts`:
- `GET /api/consensus?timeframe=7d&min_callers=3`
- Returns tickers sorted by conviction score
- Filters: min callers, timeframe, platform

### 3. Build the page
Create `src/app/consensus/page.tsx`:

Layout:
- Header: "CT Consensus" + timeframe selector
- Each ticker card:
  ```
  $NVDA — STRONG LONG (8 of 10 callers)
  ████████░░ 80% long
  Avg P&L (longs): +7.2%  |  Avg P&L (shorts): -3.1%
  Callers: @frank @alex @trader99 +5 more
  ```
- Sort by: Conviction | # Callers | Avg P&L
- Color: green bar for long %, red for short %
- "Contested" tickers get amber (#f39c12) highlight

### 4. Conviction meter component
Create `src/components/conviction-meter.tsx`:
- Horizontal bar: green (long) fills from left, red (short) from right
- Percentage labels on each side
- Ticker name centered above

### 5. Design
- Bloomberg aesthetic per CLAUDE.md
- Cards with strong borders for high-conviction plays
- Dimmer styling for contested/low-conviction
- Caller avatars in a small row below each play
