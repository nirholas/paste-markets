# Task 34: Multi-Caller Comparison Tool

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Expand the existing head-to-head (`/vs/[a]/[b]`) to support comparing 2-4 callers at once. Show radar charts, stat comparisons, and determine who's best at what.

## Steps

### 1. Update API
Update `src/app/api/vs/route.ts`:
- `GET /api/vs?callers=frank,alex,trader99&timeframe=30d`
- Support 2-4 callers (not just 2)
- Returns per-caller stats for comparison

### 2. Build the page
Create `src/app/compare/page.tsx` (client component):

Layout:
- Caller selector: add up to 4 callers via search
- URL updates as callers are added: `/compare?c=frank,alex,trader99`

Comparison sections:
1. **Stat table**: side-by-side columns for each caller
   - Win rate, avg P&L, total trades, best trade, worst trade, streak
   - Highlight the winner in each row (green)

2. **Radar chart**: SVG pentagon/hexagon showing:
   - Win Rate, Volume, Consistency, Best Trade, Risk (inverse of max drawdown)
   - Each caller is a colored line on the radar
   - Legend with caller colors

3. **Overlap analysis**: "Both @frank and @alex called $NVDA long"
   - Show tickers they agreed on and who was right

4. **Timeline**: trades from all callers on one timeline
   - Color-coded dots by caller
   - Hover shows trade details

### 3. Radar chart component
Create `src/components/radar-chart.tsx`:
- SVG-based radar/spider chart
- 5-6 axes with labels
- One polygon per caller, semi-transparent fill
- Colors: rotate through blue, green, amber, red
- Responsive sizing

### 4. Shareable URL
- All comparison state in URL params
- OG image: shows the radar chart + caller handles

### 5. Design
- Dark theme per CLAUDE.md
- Stat table: alternating row bg #0f0f22 / #0a0a1a
- Winner highlight: subtle green left border or bg tint
- Caller color dots consistent across all visualizations
