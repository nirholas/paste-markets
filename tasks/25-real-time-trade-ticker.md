# Task 25: Real-Time Trade Ticker

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a Bloomberg-style scrolling ticker that shows trades as they happen. Sits at the top of the site (persistent across pages) or as a dedicated `/live` page. Creates urgency and FOMO.

## Steps

### 1. Ticker component
Create `src/components/trade-ticker.tsx` (client component):
- Horizontal scrolling bar, auto-scrolls right-to-left
- Each item: `@handle LONG $NVDA +12.3% 3m ago`
- Color-coded: green for wins, red for losses
- Pauses on hover
- Smooth CSS animation (no JS interval for scroll)

Format per item:
```
@handle | LONG $TICKER | +X.X% | Xm ago
```

### 2. Data source
Create `src/app/api/live/route.ts`:
- `GET /api/live?limit=50` — returns most recent trades
- Pulls from the trades table, ordered by posted_at DESC
- Returns: handle, ticker, direction, pnl_pct, posted_at

### 3. Integration options

**Option A: Persistent bar** (recommended)
- Add to `src/app/layout.tsx` as a thin bar above the nav
- Height: 32px, bg: #0a0a1a with bottom border
- Always visible, adds energy to every page

**Option B: Dedicated page**
- Create `src/app/live/page.tsx`
- Full-screen terminal view with trades streaming in
- Each trade appears with a typing animation
- Sound toggle (subtle tick on each new trade)

Build Option A first, Option B as stretch goal.

### 4. Design
- Bar background: #0a0a1a or slightly darker
- Text: JetBrains Mono, 12px
- Green (#2ecc71) for positive P&L, red (#e74c3c) for negative
- Ticker separator: `·` or `|` in #555568
- Subtle left-fade and right-fade gradients at edges

### 5. Polling
- Client-side polling every 30 seconds for new trades
- Use `setInterval` + `fetch` (no WebSocket needed for v1)
- New trades slide in from the right
