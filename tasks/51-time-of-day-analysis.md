# Task 51: Time-of-Day Analysis / "When to Trade"

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a heatmap showing when callers are most active and most accurate by hour/day. "CT is most profitable at 10am EST on Tuesdays." Helps followers know when to pay attention.

## Steps

### 1. API route
Create `src/app/api/timing/route.ts`:
- `GET /api/timing?handle={handle}` — per-caller timing analysis
- `GET /api/timing` — aggregate across all callers
- Returns: 24x7 grid (hour x day-of-week) with trade_count and avg_pnl

### 2. Build the page
Create `src/app/timing/page.tsx`:

Layout:
- 24x7 heatmap grid:
  - X-axis: hours (12am-11pm)
  - Y-axis: days (Mon-Sun)
  - Cell color: green intensity = higher win rate / positive P&L
  - Cell size or opacity: trade volume
- Toggle: "All callers" vs specific caller search
- Key insights: "Best time: Tuesday 10-11am (78% win rate)"
- "Worst time: Friday 3-4pm (34% win rate)"

### 3. Heatmap component
Create `src/components/time-heatmap.tsx`:
- SVG grid with colored cells
- Color scale: red (#e74c3c) → neutral (#1a1a2e) → green (#2ecc71)
- Hover: shows exact stats for that hour/day
- Cell labels: win rate % (for high-volume cells)

### 4. Per-caller timing
On caller profiles, add compact version:
- "Most active: Weekdays 9-11am"
- "Best performance: Mondays"
- Small sparkline or mini heatmap

### 5. Design
- Heatmap cells: rounded squares with 2px gap
- Color gradient: intuitive red-to-green
- Labels: small, monospace
- Responsive: on mobile, show simplified version (day-only or hour-only)
