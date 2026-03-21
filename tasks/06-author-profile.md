# Task 06: Author Profile / Scorecard Page

## Goal
Build the individual author page that shows a trader's full scorecard — their metrics, trade history, and a visual scorecard card. This is the page people will link to when discussing a trader's performance.

## Files
- `src/app/[author]/page.tsx` (replace placeholder)
- `src/components/scorecard.tsx`
- `src/components/trade-history.tsx`

## URL Pattern
`/frankdegods` or `/@frankdegods` → shows @frankdegods' profile

The `[author]` dynamic segment should strip the @ if present.

## Design

### Page layout
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  @frankdegods                          Rank #1           │
│  Trade Scorecard                       Updated 2m ago    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │                                                  │    │
│  │   Win Rate     73%  ████████░░                   │    │
│  │   Avg P&L      +14.2%                            │    │
│  │   Total Trades  12                               │    │
│  │   Streak        W4                               │    │
│  │                                                  │    │
│  │   Best Call    $HYPE LONG +57.2% (Feb 12)        │    │
│  │   Worst Call   $NVDA SHORT -12.0% (Mar 3)        │    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [Share Scorecard] [Compare ↔] [View Wrapped]            │
│                                                          │
│  TRADE HISTORY                                           │
│  ┌────────┬───────┬────────┬──────────┬────────┐         │
│  │ TICKER │ DIR   │ P&L    │ DATE     │ STATUS │         │
│  ├────────┼───────┼────────┼──────────┼────────┤         │
│  │ HYPE   │ LONG  │ +57.2% │ Feb 12   │   ✓    │         │
│  │ POPCAT │ LONG  │ +42.8% │ Feb 28   │   ✓    │         │
│  │ ONDO   │ LONG  │ +31.5% │ Feb 14   │   ✓    │         │
│  │ ...    │       │        │          │        │         │
│  └────────┴───────┴────────┴──────────┴────────┘         │
│                                                          │
│  PLATFORM BREAKDOWN                                      │
│  Robinhood: 5 trades | Hyperliquid: 4 | Polymarket: 3   │
│                                                          │
│  paste.rank — data from paste.trade                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Scorecard card component (`src/components/scorecard.tsx`)

A self-contained, visually striking card showing the author's key metrics. Should look like the existing Bloomberg-terminal-style scorecard from `xactions/src/scorecard.ts`.

```typescript
interface ScorecardProps {
  handle: string;
  metrics: {
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    streak: number;
    bestTrade: { ticker: string; direction: string; pnl: number; date: string } | null;
    worstTrade: { ticker: string; direction: string; pnl: number; date: string } | null;
  };
  rank?: number;
}
```

Visual elements:
- Dark card with border
- Win rate with bar visualization
- Color-coded P&L values
- Best/worst call with details
- Rank badge in top-right corner

### Trade history table (`src/components/trade-history.tsx`)

```typescript
interface TradeHistoryProps {
  trades: Array<{
    ticker: string;
    direction: string;
    pnl_pct: number;
    platform?: string;
    entry_date: string;
  }>;
  sortable?: boolean;
}
```

Features:
- Sorted by P&L (best first) by default
- Clickable column headers to re-sort
- Color-coded P&L
- Direction badges (LONG in green, SHORT in red)
- Status: checkmark for wins, X for losses
- Platform column if data available

### Action buttons
Below the scorecard:
- **Share Scorecard** — Copies shareable URL to clipboard (`/frankdegods`)
- **Compare** — Opens handle input, navigates to `/vs/frankdegods/[other]`
- **View Wrapped** — Links to `/wrapped/frankdegods`

### Platform breakdown
If trades have platform data, show a simple breakdown:
```
PLATFORMS
Robinhood ███████  5 trades
Hyperliquid ████   4 trades
Polymarket ███     3 trades
```

## Data fetching
Server component fetching:
```typescript
export default async function AuthorPage({ params }: { params: { author: string } }) {
  const handle = params.author.replace(/^@/, "");
  const data = await fetch(`${SITE_URL}/api/author/${handle}`).then(r => r.json());

  if (!data || data.error) {
    // Show "Author not found" with option to submit for tracking
    return <NotFound handle={handle} />;
  }

  return (
    <div>
      <Scorecard handle={handle} metrics={data.metrics} rank={data.rank} />
      <TradeHistory trades={data.trades} />
    </div>
  );
}
```

Or import DB functions directly for server-side rendering.

## Not found state
If the author isn't tracked yet:
```
@unknownhandle

No data yet.
We'll start tracking this account. Check back in an hour.

[← Back to Leaderboard]
```

Also trigger a background sync to fetch their data from paste.trade.

## OG Metadata (dynamic)
```typescript
export async function generateMetadata({ params }) {
  const handle = params.author.replace(/^@/, "");
  // Fetch metrics for meta tags
  return {
    title: `@${handle} — Trade Scorecard | paste.rank`,
    description: `@${handle}'s real trading performance: ${winRate}% win rate, ${avgPnl} avg P&L across ${totalTrades} trades.`,
    openGraph: {
      images: [{ url: `/api/og/author/${handle}`, width: 1200, height: 630 }],
    },
  };
}
```

## Done when
- Author profile page renders with scorecard and trade history
- Metrics display correctly with colors and formatting
- Trade history table is sortable
- Action buttons work (share, compare, wrapped links)
- Not-found state shows for unknown authors
- Dynamic OG metadata generates
- URL works with and without @ prefix
- Page looks great — Bloomberg terminal aesthetic
