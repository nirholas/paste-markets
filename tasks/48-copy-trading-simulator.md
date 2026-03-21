# Task 48: Copy Trading Simulator / "Mirror @handle"

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a feature where users can "mirror" a caller and see simulated real-time P&L as if they were copying every trade. Not real money — just simulation. Shows the value of following specific callers and drives engagement.

## Steps

### 1. Mirror page
Create `src/app/mirror/[handle]/page.tsx`:

Layout:
- Header: "Mirroring @handle"
- Live portfolio panel:
  - Starting capital selector ($1k / $5k / $10k)
  - Current value (updated from caller's trades)
  - Total P&L % and $
  - Chart: portfolio value over time
- Active positions: caller's currently open trades
- Closed positions: historical trades with P&L
- "Mirror since" date selector

### 2. API route
Create `src/app/api/mirror/[handle]/route.ts`:
- `GET /api/mirror/{handle}?capital=10000&since=2026-03-01`
- Computes simulated portfolio:
  - Equal allocation per trade
  - Track each position from entry to exit (or current price)
  - Running P&L timeline

### 3. Mirror comparison
Show how mirroring different callers compares:
- Create `src/app/mirror/page.tsx` (input page):
  - Search for a caller
  - Set capital and timeframe
  - Shows quick preview stats before diving into detail

### 4. Real-time updates
On the mirror page:
- Poll for new trades every 60 seconds
- When caller makes a new trade, show notification:
  "@handle just went LONG $NVDA — mirrored into your portfolio"
- Animate portfolio value change

### 5. Shareable mirror card
- OG image: "If you mirrored @handle with $10k, you'd have $14,200"
- Big green P&L number
- Win rate + trade count

### 6. Design
- Bloomberg terminal aesthetic
- Portfolio chart: green line on dark bg
- Active positions: table with live P&L (green/red)
- Notification: slide-in from right, auto-dismiss
- Capital selector: button group with custom input option
