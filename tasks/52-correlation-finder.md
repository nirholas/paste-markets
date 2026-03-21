# Task 52: Caller Correlation Finder

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Find callers who consistently call the same things at the same time. "When @frank goes long $NVDA, @alex goes long $NVDA 80% of the time." Reveals who follows who, who the original thinkers are, and who's just copying.

## Steps

### 1. Correlation engine
Create `src/lib/correlation.ts`:
```typescript
export function findCorrelations(timeframe: string): CallerCorrelation[] {
  // For each pair of callers:
  // - Find trades on the same ticker within 24h window
  // - Calculate agreement rate (same direction %)
  // - Calculate timing: who calls first?
  // Return sorted by correlation strength
}

interface CallerCorrelation {
  caller_a: string;
  caller_b: string;
  overlap_trades: number;    // trades on same tickers
  agreement_rate: number;    // % same direction
  avg_time_diff_hours: number; // who calls first (negative = A first)
  leader: string;            // who consistently calls first
}
```

### 2. API route
Create `src/app/api/correlations/route.ts`:
- `GET /api/correlations?timeframe=30d&min_overlap=3`
- Returns top caller pairs by correlation strength

### 3. Build the page
Create `src/app/correlations/page.tsx`:

Layout:
- "Who follows who?" headline
- Network/table of correlated callers:
  ```
  @frank ←→ @alex (87% agreement, frank leads by 3.2 hrs avg)
  @trader99 ←→ @degen (72% agreement, simultaneous)
  ```
- "Original Thinkers" — callers who consistently call first
- "Echo Chamber" — callers who mostly copy others
- Filter: min overlap trades, min agreement %

### 4. Relationship graph (stretch)
SVG force-directed graph:
- Nodes = callers (sized by trade count)
- Edges = correlations (thickness = agreement rate)
- Edge arrows = who leads
- Clusters reveal groups/cliques

### 5. Per-caller view
On caller profile: "Most correlated with: @frank (85%)"
- Shows if they tend to lead or follow

### 6. Design
- Table view as default (simpler, more readable)
- Graph as optional toggle
- Leader badge: blue arrow icon
- High correlation: bold/highlighted row
