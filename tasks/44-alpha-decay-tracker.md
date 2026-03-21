# Task 44: Alpha Decay Tracker

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a feature that tracks how quickly a caller's alpha decays over time. The gap between "author price" (when they tweeted) and "paste price" (when paste.markets locked it) shows the head-start. But does the alpha last? Do their calls still work if you're 1 hour late? 1 day late? This is unique data no one else has.

## Steps

### 1. Decay calculation
Create `src/lib/alpha-decay.ts`:
```typescript
interface AlphaDecay {
  handle: string;
  // For each trade, compute P&L at different time delays:
  pnl_at_0h: number;   // if you entered at author's price
  pnl_at_1h: number;   // if you entered 1 hour after tweet
  pnl_at_4h: number;
  pnl_at_12h: number;
  pnl_at_24h: number;
  pnl_at_48h: number;
  // Decay rate: how fast does alpha disappear?
  half_life_hours: number; // time for P&L to halve
  still_profitable_after: string; // "24h", "4h", "immediately unprofitable"
}
```

### 2. API route
Create `src/app/api/decay/[handle]/route.ts`:
- `GET /api/decay/{handle}?timeframe=30d`
- Returns decay curve data for the caller

### 3. Decay chart
Create `src/components/decay-chart.tsx`:
- X-axis: time delay (0h, 1h, 4h, 12h, 24h, 48h)
- Y-axis: average P&L %
- Line chart showing how P&L decreases with delay
- Green zone: still profitable
- Red zone: entry too late, negative P&L
- Vertical dashed line at the "break-even delay" point

### 4. Profile integration
On caller profile, add "Alpha Decay" section:
- The decay chart
- Key stat: "Alpha half-life: 4.2 hours"
- Interpretation: "If you follow @handle within 4 hours, you keep 50% of the alpha"
- Comparison: "Faster than 78% of callers"

### 5. Decay leaderboard
Create `src/app/decay/page.tsx`:
- "Longest-Lasting Alpha" — callers whose calls are still profitable days later
- Table: Handle | Half-Life | Still Profitable After | Avg P&L at 24h
- Sort by half-life (longer = better for followers who aren't glued to their phone)

### 6. Design
- Chart gradient: green at left (instant entry) fading to red at right (late entry)
- Break-even point marked with vertical line + label
- Half-life shown as a highlighted stat with clock icon
- Compact but readable on mobile
