# Task 39: Prediction Market Odds Display

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build dedicated UI for prediction market trades (Polymarket). These are different from stocks/perps — they have event titles, probability %, resolution dates, and YES/NO positions instead of LONG/SHORT. Several replies specifically asked about Polymarket integration.

## Steps

### 1. Prediction market data model
Create or update types in `src/lib/types.ts`:
```typescript
interface PredictionTrade {
  id: string;
  handle: string;
  event_title: string;        // "Will Trump win 2026 midterms?"
  market_url: string;
  direction: 'yes' | 'no';
  entry_probability: number;  // 0.65 = 65%
  current_probability: number;
  exit_probability?: number;
  resolved: boolean;
  resolution: 'yes' | 'no' | null;
  pnl_pct: number;
  posted_at: string;
}
```

### 2. Prediction trades page
Create `src/app/predictions/page.tsx`:

Layout:
- Header: "Prediction Markets" + stats (total bets, avg accuracy)
- Active Markets section: trades on unresolved events
  - Each card: event title, caller's position (YES/NO), entry price, current price, implied P&L
  - Probability bar: visual 0-100% with caller's entry marked
- Resolved Markets section: completed trades with outcomes
  - Shows if caller was right or wrong
  - Green checkmark or red X

### 3. Probability bar component
Create `src/components/probability-bar.tsx`:
- Horizontal bar 0% to 100%
- Filled portion shows current probability
- Marker showing entry probability
- Color: green if moving in caller's direction, red if against
- Labels: "YES 65%" on left, "NO 35%" on right

### 4. Prediction caller stats
On caller profiles, add prediction-specific stats:
- Prediction accuracy: % of resolved markets where caller was right
- Avg entry vs resolution delta
- Best prediction call
- Number of active predictions

### 5. Prediction leaderboard
Create `src/app/predictions/leaderboard/page.tsx`:
- Separate leaderboard for prediction market callers
- Columns: Handle, Accuracy %, Avg P&L, Total Predictions, Active Bets
- Sorted by accuracy (min 5 resolved predictions)

### 6. Design
- Prediction accent color: amber (#f39c12)
- YES = green, NO = red
- Event titles in slightly larger font
- Resolution timestamp prominent
- "ACTIVE" badge for unresolved, "RESOLVED" for completed
