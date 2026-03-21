# Task 26: "Fade the Caller" Tracker

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a "Fade Score" for each caller — showing how profitable it would be to take the OPPOSITE of their trades. If someone is consistently wrong, fading them is alpha. This is the most CT-native feature possible and will go viral.

## Context
Multiple tweet replies mentioned wanting to "inverse" or "fade" bad callers. This is core CT culture — the worst callers are just as valuable as the best ones if you trade against them.

## Steps

### 1. Fade score calculation
Add to `src/lib/metrics.ts`:
```typescript
export function computeFadeScore(trades: Trade[]): FadeStats {
  // For each trade, compute what P&L would be if you took the opposite
  // LONG +10% → fade would be SHORT -10% (loss)
  // LONG -15% → fade would be SHORT +15% (win)
  // Return: fade_win_rate, fade_avg_pnl, fade_total_pnl, best_fade, worst_fade
}
```

### 2. API route
Create `src/app/api/fade/[handle]/route.ts`:
- `GET /api/fade/{handle}?timeframe=30d`
- Returns: original stats vs fade stats side-by-side
- Includes "Fade Rating": S/A/B/C/D/F based on how profitable fading is

### 3. Profile integration
On the author profile page (`src/app/[author]/page.tsx`), add a "Fade Stats" section:
- Toggle: "Follow" vs "Fade" view
- Side-by-side comparison:
  ```
  FOLLOW @handle          FADE @handle
  Win Rate: 35%           Win Rate: 65%
  Avg P&L: -4.2%          Avg P&L: +4.2%
  Total: -$12,340         Total: +$12,340
  ```
- If fade win rate > 60%: show "PROFITABLE FADE" badge in red

### 4. Fade Leaderboard
Create `src/app/fade/page.tsx`:
- "Best Callers to Fade" — ranked by fade profitability
- Same table structure as main leaderboard but inverted
- Column: Handle | Their Win Rate | Fade Win Rate | Fade Avg P&L
- Red/green color coding inverted (their losses = your gains)

### 5. Shareable fade card
OG image for `/fade/{handle}` showing:
- "Fade @handle for profit"
- Their win rate vs fade win rate
- Big P&L number

### 6. Design
- Use red (#e74c3c) as the accent color for fade pages (vs green for regular)
- "FADE" label in red badge
- Inverted P&L colors in fade view (their red = your green)
