# Task 36: Global Search & Discovery

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a powerful search that lets users find callers, tickers, or trades instantly. Plus a discovery page for browsing trending content. This is the connective tissue that makes the whole platform navigable.

## Steps

### 1. Search API
Create `src/app/api/search/route.ts`:
- `GET /api/search?q=frank` — searches across callers and tickers
- Returns:
  ```json
  {
    "callers": [{ "handle": "frankdegods", "win_rate": 67, "trades": 42 }],
    "tickers": [{ "ticker": "FRANK", "calls": 3 }],
    "trades": [{ "handle": "someone", "ticker": "X", "content_preview": "..." }]
  }
  ```
- Searches handle names, ticker symbols, and trade content
- Fuzzy matching for handles (frank → frankdegods)

### 2. Search component
Create `src/components/search-bar.tsx` (client component):
- Cmd+K / Ctrl+K keyboard shortcut to open
- Full-screen overlay with search input
- Instant results as you type (debounced 300ms)
- Results grouped: Callers | Tickers | Trades
- Arrow key navigation + Enter to select
- Recent searches stored in localStorage

### 3. Discovery page
Create `src/app/discover/page.tsx`:

Sections:
- **Trending Callers** — most active this week (by trade count)
- **Trending Tickers** — most called tickers this week
- **Rising Stars** — callers with best recent win rate (min 5 trades)
- **Hot Takes** — most controversial calls (high P&L variance)
- **New to paste.markets** — recently added callers

Each section: horizontal scroll cards on mobile, grid on desktop.

### 4. Add search to nav
Update `src/components/ui/nav.tsx`:
- Add search icon/button that triggers the Cmd+K overlay
- Show on all pages

### 5. Design
- Search overlay: full screen, dark bg with blur (#0a0a1a at 95% opacity)
- Input: large, centered, JetBrains Mono, no border, just bottom line
- Results: clean list with subtle dividers
- Discovery cards: compact, showing key stat + sparkline or win rate bar
