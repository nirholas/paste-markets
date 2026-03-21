# Task 19: Build "Fade The Caller" Feature

## Goal
Add a "Fade" toggle to the leaderboard and author profiles that inverts the P&L — showing what you'd make if you took the opposite side of every trade. The worst callers become the best fade signals. People love this.

## Context

- Metrics are computed in `src/lib/metrics.ts` via `computeMetrics()`
- Leaderboard sorts by win rate / avg P&L
- Author profiles show scorecard with P&L stats

## What To Build

### 1. Fade metrics computation

Add to `src/lib/metrics.ts`:

```typescript
export function computeFadeMetrics(handle: string, trades: TradeSummary[]): AuthorMetrics {
  // Invert every trade's P&L
  const faded = trades.map(t => ({
    ...t,
    pnl_pct: -t.pnl_pct,
    direction: t.direction === "long" ? "short" : t.direction === "short" ? "long" : t.direction === "yes" ? "no" : "yes"
  }));
  return computeMetrics(handle, faded);
}
```

### 2. Leaderboard fade toggle

In `src/app/leaderboard/client.tsx`:
- Add a "FADE MODE" toggle button next to the filters
- When active: sort by worst performers (lowest win rate / most negative avg P&L)
- Show inverse metrics: if someone has 30% WR, in fade mode they show as 70% WR
- Visual indicator: red border or "FADE" badge when active
- URL param: `?fade=true`

### 3. Author profile fade view

In the author page, add a small "Fade this caller" toggle:
- When active: scorecard shows inverted metrics
- "If you faded @handle: 70% WR, +8.3% avg"
- The scorecard component should accept a `faded` boolean prop

### 4. Fade leaderboard page (optional shortcut)

Add a route alias: `/fade` that redirects to `/leaderboard?fade=true&sort=win_rate&order=asc`

## Validation

1. `cd paste-dashboard && npx next build` — clean
2. Fade toggle on leaderboard inverts rankings
3. Fade toggle on author page inverts scorecard
4. URL param `?fade=true` persists the state

## Do NOT

- Change the actual stored data — fade is a view-layer inversion only
- Make fade the default (normal mode is default)
- Over-complicate — it's literally just negating pnl_pct
