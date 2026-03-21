# Task 05: Leaderboard Page

## Goal
Build the main leaderboard page — a ranked table of CT traders sorted by real P&L performance. This is the core destination page that people will share and argue about.

## File
`src/app/leaderboard/page.tsx` (replace placeholder)

Also create: `src/components/leaderboard-table.tsx`

## Design

### Page layout
```
┌──────────────────────────────────────────────────────────┐
│  LEADERBOARD                                             │
│  Who's actually making money on CT.                      │
│                                                          │
│  [7D] [30D] [90D] [ALL]     Sort: Win Rate ▼     Min: 5 │
│                                                          │
│  ┌────┬────────────────┬────────┬────────┬───────┬─────┐ │
│  │ #  │ TRADER         │ W/R    │ AVG    │ TRADES│     │ │
│  ├────┼────────────────┼────────┼────────┼───────┼─────┤ │
│  │ 1  │ @frankdegods   │ 73%    │+14.2%  │ 12    │█████│ │
│  │ 2  │ @nichxbt       │ 68%    │+11.8%  │  9    │████ │ │
│  │ 3  │ @CryptoKaleo   │ 61%    │ +8.3%  │ 15    │███  │ │
│  │ 4  │ @blknoiz06     │ 58%    │ +6.1%  │  8    │███  │ │
│  │ 5  │ @GCRClassic    │ 55%    │ +3.7%  │ 22    │██   │ │
│  │ ...│                │        │        │       │     │ │
│  └────┴────────────────┴────────┴────────┴───────┴─────┘ │
│                                                          │
│  Showing 1-25 of 47        [← Prev] [Next →]            │
│                                                          │
│  Know someone who should be tracked?                     │
│  ┌──────────────────────────┐ [Submit]                   │
│  │  @ Add a handle...       │                            │
│  └──────────────────────────┘                            │
└──────────────────────────────────────────────────────────┘
```

### Table columns
1. **Rank** — # with medal icons for top 3 (gold/silver/bronze via colored text, not actual emojis)
2. **Trader** — @handle, clickable → links to `/[handle]` profile
3. **Win Rate** — percentage with color (green >50%, red <50%)
4. **Avg P&L** — with sign and color
5. **Trades** — total count
6. **Win Bar** — visual bar `████░░░░░░` colored by win rate
7. **Best Call** — ticker + P&L of their best trade (e.g. "$HYPE +57%")
8. **Streak** — current streak (e.g. "W4" for 4 wins, "L2" for 2 losses)

### Filters (client component)
- **Timeframe toggle:** 7D / 30D / 90D / ALL — buttons, active state highlighted
- **Sort dropdown:** Win Rate, Avg P&L, Total Trades, Best Trade, Streak
- **Min trades:** Slider or input, minimum trades to qualify for ranking (default: 5)

### Pagination
- 25 per page
- "Showing 1-25 of N" text
- Prev/Next buttons
- URL params: `?timeframe=30d&sort=win_rate&page=1&min=5`

### Handle submission
At the bottom, a form to submit new handles for tracking:
- Input with @ prefix
- Submit button
- On submit: POST to an endpoint or call paste.trade to check if the handle exists, then add to DB
- Show confirmation: "Added @handle — data will appear within an hour"

## Component: `src/components/leaderboard-table.tsx`

```typescript
interface LeaderboardEntry {
  rank: number;
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  bestTicker: string;
  bestPnl: number;
  streak: number;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading?: boolean;
}
```

Features:
- Rows are clickable → navigate to author profile
- Hover state: slight background change
- Top 3 rows have subtle highlight (slightly brighter border or bg)
- Columns are responsive — hide "Best Call" and "Streak" on narrow viewports
- Loading skeleton state

## Data fetching
Use the API route:
```typescript
const res = await fetch(`/api/leaderboard?timeframe=${tf}&sort=${sort}&limit=25&offset=${page*25}&min_trades=${min}`);
```

Since filters are interactive, the table needs to be a client component that refetches on filter change. The page itself can be server-rendered with initial data.

Pattern:
```typescript
// page.tsx (server component)
export default async function LeaderboardPage({ searchParams }) {
  const initialData = await getLeaderboard(searchParams);
  return <LeaderboardClient initialData={initialData} />;
}

// LeaderboardClient.tsx ("use client")
// Manages filter state, refetches on change
```

## OG Metadata
```typescript
export const metadata = {
  title: "CT Leaderboard — paste.rank",
  description: "Ranked list of Crypto Twitter's best traders by real P&L. Win rates, avg returns, streaks.",
  openGraph: {
    images: [{ url: "/api/og/leaderboard", width: 1200, height: 630 }],
  },
};
```

## Edge cases
- Empty leaderboard (no tracked authors): Show message + prominent submit form
- Author with 0 trades: Exclude from rankings
- All authors have same win rate: Sort by avg P&L as tiebreaker
- Very long handle: Truncate with ellipsis

## Done when
- Leaderboard table renders with ranked authors
- Timeframe filter works (7D/30D/90D/ALL)
- Sort by different metrics works
- Min trades filter works
- Pagination works
- Clicking a row navigates to author profile
- Handle submission form works
- Top 3 have visual distinction
- Win rate bars display correctly
- Responsive layout
