# Task: Enhanced Leaderboards — Timeframe Filters, Asset-Level Rankings, Streaks

> **IMPORTANT: Only work inside `/workspaces/agent-payments-sdk/paste-dashboard/`. Do NOT touch any files outside this folder. The parent repo `agent-payments-sdk` is private and `paste-dashboard` pushes to the public `nirholas/paste-markets` remote.**

## Context

Multiple commenters requested better leaderboards (@lesabrefomo: "leaderboards by timeframe — weekly, daily"). The existing leaderboard works but needs richer filtering and views to become a daily destination.

## Existing Code to Build On

- `src/app/leaderboard/page.tsx` — current leaderboard page
- `src/components/leaderboard-table.tsx` — sortable table component
- `src/app/api/leaderboard/route.ts` — API (supports window=7d|30d|all, sort, platform, limit)
- `src/lib/db.ts` — SQLite with rankings table + prepared statements
- `src/lib/metrics.ts` — computeMetrics, computeWinRate, computeStreak
- `src/lib/schema.sql` — rankings table schema

## What to Build

### 1. Timeframe Tabs on Leaderboard Page
- Add tabs: **24h | 7d | 30d | All Time**
- Each tab re-fetches with the `window` param
- Show rank changes (arrows up/down) vs previous period
- Highlight "biggest movers" — who climbed/dropped the most

### 2. Asset-Level Leaderboard
- New route: `/leaderboard/[ticker]` (e.g. `/leaderboard/BTC`)
- "Who's the best BTC caller?" — ranked by PnL on that specific ticker
- Filter bar at top with popular tickers as quick-select chips
- API: extend `/api/leaderboard` with `?ticker=BTC` param

### 3. Streak Leaderboard
- New tab or section: "Hot Streaks"
- Show callers currently on winning streaks
- Columns: handle, streak length, streak PnL, last trade
- Use `computeStreak()` from metrics.ts

### 4. Daily/Weekly Snapshot
- "Today's Top Callers" section on homepage
- Shows top 5 by PnL in last 24h
- Auto-refreshes, feels like a live scoreboard

### 5. Rank Change Indicators
- Store previous rank in rankings table (add `prev_rank` column if needed)
- Show green arrow + number for rank improvements
- Show red arrow + number for drops
- New entries get a "NEW" badge

## Design System
- Follow existing Bloomberg terminal aesthetic
- Tabs: use `border-b-2 border-accent` for active tab
- Rank changes: `text-win` for up, `text-loss` for down
- Streak flames: use unicode "🔥" or styled counter
- Reference `src/components/leaderboard-table.tsx` for table patterns

## Acceptance Criteria
- [ ] Timeframe tabs (24h, 7d, 30d, all) work with URL params
- [ ] Asset-level leaderboard page renders per-ticker rankings
- [ ] Streak leaderboard shows current hot streaks
- [ ] Rank change arrows display correctly
- [ ] API supports new filter params (ticker, expanded timeframes)
- [ ] Mobile responsive with horizontal scroll on tables
