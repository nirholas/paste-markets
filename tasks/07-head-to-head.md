# Task 07: Head-to-Head Comparison Page

## Goal
Build a 1v1 comparison page where users pick two CT traders and see who's better across every metric. This creates drama and arguments — exactly the kind of content that goes viral on CT.

## Files
- `src/app/vs/[a]/[b]/page.tsx` (replace placeholder)
- `src/components/head-to-head-card.tsx`

## URL Pattern
`/vs/frankdegods/nichxbt` → compares @frankdegods vs @nichxbt

## Design

### Page layout
```
┌──────────────────────────────────────────────────────────┐
│  HEAD-TO-HEAD                                            │
│                                                          │
│  ┌──────────────┐       VS       ┌──────────────┐       │
│  │  @ handle A   │               │  @ handle B   │       │
│  └──────────────┘               └──────────────┘       │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │                                                 │     │
│  │  @frankdegods          VS          @nichxbt     │     │
│  │                                                 │     │
│  │  WIN RATE                                       │     │
│  │  ████████░░  73%      ←→      68%  ███████░░░  │     │
│  │                   ✓ frankdegods                 │     │
│  │                                                 │     │
│  │  AVG P&L                                        │     │
│  │  +14.2%               ←→             +11.8%     │     │
│  │                   ✓ frankdegods                 │     │
│  │                                                 │     │
│  │  TOTAL TRADES                                   │     │
│  │  12                   ←→                 9      │     │
│  │                   ✓ frankdegods                 │     │
│  │                                                 │     │
│  │  BEST TRADE                                     │     │
│  │  $HYPE +57.2%         ←→        $ETH +34.1%    │     │
│  │                   ✓ frankdegods                 │     │
│  │                                                 │     │
│  │  STREAK                                         │     │
│  │  W4                   ←→                W2      │     │
│  │                   ✓ frankdegods                 │     │
│  │                                                 │     │
│  │  ─────────────────────────────────────────────  │     │
│  │                                                 │     │
│  │  VERDICT: @frankdegods wins 5-0                 │     │
│  │  "Not even close."                              │     │
│  │                                                 │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  SHARED TICKERS (both traded these)                      │
│  ┌────────┬────────────────┬────────────────┐            │
│  │ TICKER │ @frankdegods   │ @nichxbt       │            │
│  ├────────┼────────────────┼────────────────┤            │
│  │ SOL    │ +14.8%         │ +22.3%   ✓     │            │
│  │ BTC    │ +8.3%    ✓     │ +3.1%         │            │
│  │ ETH    │ +4.1%          │ +34.1%   ✓     │            │
│  └────────┴────────────────┴────────────────┘            │
│                                                          │
│  [Share This Matchup]  [Flip Sides]  [New Matchup]       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Input section (top)
Two input fields for handles, pre-filled from URL params. Users can change either handle and hit "Compare" to navigate to new URL.

```typescript
// Client component for handle inputs
"use client";
function H2HInput({ initialA, initialB }) {
  // Two search inputs side by side
  // "Compare" button → router.push(`/vs/${a}/${b}`)
}
```

### Comparison card (`src/components/head-to-head-card.tsx`)

Each metric row shows:
- Left value (handle A)
- Metric label in center
- Right value (handle B)
- Winner indicator (checkmark on winning side, highlighted in green)

```typescript
interface H2HCardProps {
  a: {
    handle: string;
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    bestTrade: { ticker: string; pnl: number } | null;
    streak: number;
  };
  b: {
    handle: string;
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    bestTrade: { ticker: string; pnl: number } | null;
    streak: number;
  };
  comparison: {
    winRateWinner: "a" | "b" | "tie";
    avgPnlWinner: "a" | "b" | "tie";
    totalTradesWinner: "a" | "b" | "tie";
    bestTradeWinner: "a" | "b" | "tie";
    overallWinner: "a" | "b" | "tie";
    sharedTickers: Array<{ ticker: string; a_pnl: number; b_pnl: number }>;
  };
}
```

### Visual treatment
- Winner side for each metric: green text, subtle glow/highlight
- Loser side: dimmed/muted
- Tie: amber for both
- Overall verdict at bottom: large text declaring winner with score (e.g. "5-0", "3-2")
- Verdict text options:
  - 5-0: "Flawless victory."
  - 4-1: "Dominant."
  - 3-2: "Close fight."
  - Tie: "Dead even. Run it back."

### Shared tickers table
Shows tickers both traders have traded, with P&L comparison. Winner for each ticker gets a checkmark. This adds depth and creates talking points.

### Action buttons
- **Share This Matchup** — Copy URL to clipboard
- **Flip Sides** — Swap A and B (navigate to `/vs/b/a`)
- **New Matchup** — Clear inputs

## Data fetching
```typescript
export default async function H2HPage({ params }: { params: { a: string; b: string } }) {
  const data = await fetch(`${SITE_URL}/api/vs?a=${params.a}&b=${params.b}`).then(r => r.json());

  if (data.error) {
    return <ErrorState message={data.error} />;
  }

  return (
    <>
      <H2HInput initialA={params.a} initialB={params.b} />
      <HeadToHeadCard a={data.a} b={data.b} comparison={data.comparison} />
      {data.comparison.sharedTickers.length > 0 && (
        <SharedTickersTable tickers={data.comparison.sharedTickers} a={params.a} b={params.b} />
      )}
    </>
  );
}
```

## OG Metadata (dynamic)
```typescript
export async function generateMetadata({ params }) {
  return {
    title: `@${params.a} vs @${params.b} — Head to Head | paste.rank`,
    description: `Who's the better trader? @${params.a} vs @${params.b} — real P&L comparison.`,
    openGraph: {
      images: [{ url: `/api/og/vs/${params.a}/${params.b}`, width: 1200, height: 630 }],
    },
  };
}
```

## Edge cases
- Same handle for both: Show error "Can't compare someone to themselves"
- One handle not found: Show available data + "No data for @handle yet"
- No shared tickers: Hide that section
- All ties: Show "Dead even" verdict

## Done when
- H2H page renders with two-column comparison
- All metrics compared with winner highlighting
- Shared tickers table works
- Handle inputs allow changing the matchup
- Share/Flip/New buttons work
- Dynamic OG metadata
- Looks great — dramatic, shareable, Bloomberg aesthetic
