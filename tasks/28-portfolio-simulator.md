# Task 28: "What If" Portfolio Simulator

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a tool where users can select callers they want to "follow" and see what their simulated portfolio P&L would be. "If you followed @frankdegods and @trader99 with $10k, you'd have $14,200 today." Turns passive viewers into engaged users.

## Steps

### 1. API route
Create `src/app/api/simulate/route.ts`:
- `POST /api/simulate`
- Body: `{ callers: string[], starting_capital: number, timeframe: string, allocation: 'equal' | 'weighted' }`
- Computes simulated portfolio:
  - Equal: split capital evenly across callers' trades
  - Weighted: allocate more to higher win-rate callers
- Returns: timeline of portfolio value, total P&L, per-caller contribution, max drawdown, best/worst trade

### 2. Build the page
Create `src/app/simulate/page.tsx` (client component):

Layout:
- **Step 1**: Search and select callers (multi-select with search)
- **Step 2**: Set starting capital ($1k / $5k / $10k / $50k / custom)
- **Step 3**: Choose timeframe (7d / 30d / 90d / all)
- **Results panel**:
  - Big number: final portfolio value + total P&L %
  - Line chart: portfolio value over time (SVG)
  - Per-caller breakdown: who made you money, who lost you money
  - Key stats: win rate, max drawdown, sharpe-like ratio, best single trade
  - Comparison: "vs S&P 500" or "vs BTC" in same period

### 3. Chart component
Create `src/components/portfolio-chart.tsx`:
- Simple SVG line chart (no charting library needed)
- X-axis: dates, Y-axis: portfolio value
- Green line if positive overall, red if negative
- Hover tooltip showing value at that point
- Starting capital shown as dashed horizontal line

### 4. Caller selector component
Create `src/components/caller-selector.tsx`:
- Search input with autocomplete from caller database
- Selected callers shown as removable chips/tags
- Each chip shows: @handle + win rate badge
- Max 10 callers

### 5. Shareable results
After simulation:
- "Share your picks" button → generates URL like `/simulate?callers=frank,alex&capital=10000&tf=30d`
- OG image showing the portfolio result

### 6. Design
- Dark theme per CLAUDE.md
- Chart: green (#2ecc71) line on dark bg, subtle grid lines (#1a1a2e)
- P&L number: large, green/red, JetBrains Mono
- Cards for per-caller breakdown
