# Task 08: CT Wrapped / Report Card

## Goal
Build a Spotify-Wrapped-style trading report card for any CT handle. Beautiful, shareable, personality-driven. This is the most viral feature — people can't resist sharing content about themselves.

## Files
- `src/app/wrapped/[author]/page.tsx` (replace placeholder)
- `src/components/wrapped-card.tsx`

## URL Pattern
`/wrapped/frankdegods` → @frankdegods' CT Wrapped

## Design Philosophy
Think Spotify Wrapped meets Bloomberg terminal. Each "slide" reveals a different aspect of their trading personality. The page is one scrollable card (not separate slides) — optimized for screenshotting and sharing.

### Page layout
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  CT WRAPPED                                              │
│  @frankdegods                                            │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │                                                  │    │
│  │              THE SNIPER                          │    │
│  │    "Picks shots carefully. Rarely misses."       │    │
│  │                                                  │    │
│  │  ─────────────────────────────────────────────   │    │
│  │                                                  │    │
│  │  OVERALL          A                              │    │
│  │  Timing           A                              │    │
│  │  Conviction        B+                            │    │
│  │  Consistency       A                              │    │
│  │  Risk Mgmt         B                              │    │
│  │                                                  │    │
│  │  ─────────────────────────────────────────────   │    │
│  │                                                  │    │
│  │  12 trades    73% win rate    +14.2% avg         │    │
│  │                                                  │    │
│  │  Your best month was February.                   │    │
│  │  You love longing $SOL — 3 trades and counting.  │    │
│  │  You've never shorted a memecoin. Respect.       │    │
│  │                                                  │    │
│  │  ─────────────────────────────────────────────   │    │
│  │                                                  │    │
│  │  BIGGEST W         $HYPE LONG +57.2%             │    │
│  │  BIGGEST L         $NVDA SHORT -12.0%            │    │
│  │  LONGEST STREAK    4 wins                        │    │
│  │  FAVORITE TICKER   $SOL                          │    │
│  │                                                  │    │
│  │  ─────────────────────────────────────────────   │    │
│  │                                                  │    │
│  │  paste.rank — data from paste.trade              │    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [Share Wrapped]  [View Full Profile]  [Compare ↔]       │
│                                                          │
│  Try yours: ┌──────────────────┐ [Go]                    │
│             │  @ enter handle  │                         │
│             └──────────────────┘                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Wrapped card component (`src/components/wrapped-card.tsx`)

```typescript
interface WrappedCardProps {
  handle: string;
  personality: {
    label: string;
    description: string;
  };
  grades: {
    overall: string;
    timing: string;
    conviction: string;
    consistency: string;
    riskManagement: string;
  };
  highlights: {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    bestMonth: string;
    favoriteTicker: string;
    favoriteDirection: string;
    longestStreak: number;
    biggestWin: { ticker: string; pnl: number };
    biggestLoss: { ticker: string; pnl: number };
  };
  funFacts: string[];
}
```

### Personality types (map from metrics)

| Label | Criteria | Description |
|-------|----------|-------------|
| The Sniper | WR >70%, avg >15% | "Picks shots carefully. Rarely misses." |
| The Grinder | WR >60%, trades >50 | "Consistent. Relentless. Always in the market." |
| The Degen | WR <40%, has a >100% trade | "Lives for the big hit. Doesn't care about the losses." |
| The Bear | Mostly shorts | "Sees the top before anyone else." |
| The Oracle | Mostly prediction markets | "Doesn't trade assets. Trades outcomes." |
| The Bag Holder | WR <30% | "Diamond hands... on everything. Even the losses." |
| The Machine | Low P&L std dev, WR >55% | "Consistent returns. No emotion. Just execution." |
| Mr. Consistent | WR >65%, avg <10% | "Won't blow up your port. Won't 10x it either." |
| Quality Over Quantity | <10 trades, avg >20% | "Doesn't trade often. But when they do..." |
| The Gambler | High variance, WR ~50% | "50/50 every time. Coin flip merchant." |
| The Trendsetter | Trades tickers before they trend | "In before the crowd. Out before the crash." |

### Grade system
Grades are S through F, computed from metrics:

```typescript
function computeGrade(score: number): string {
  // score is 0-100 normalized
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 75) return "B+";
  if (score >= 65) return "B";
  if (score >= 55) return "C+";
  if (score >= 45) return "C";
  if (score >= 35) return "D";
  return "F";
}
```

**Timing grade:** Based on win rate (direct proxy since we don't have entry-to-peak data)
- 100% WR = 100 score, 0% WR = 0 score

**Conviction grade:** Based on average absolute P&L (higher = more conviction in positions)
- Normalize: avg |P&L| / 50 * 100, capped at 100

**Consistency grade:** Based on inverse of P&L standard deviation
- Low std dev = high consistency
- Normalize: 100 - (stddev / max_stddev * 100)

**Risk Management grade:** Based on ratio of avg win to avg loss
- Ratio > 3: 100
- Ratio = 1: 50
- Ratio < 0.5: 20

**Overall:** Weighted average (timing 30%, consistency 25%, risk 25%, conviction 20%)

### Grade visual treatment
- S grade: gold text (#f59e0b), subtle glow
- A grade: green text (#2ecc71)
- B grade: accent blue (#3b82f6)
- C grade: text secondary (#c8c8d0)
- D/F grade: red text (#e74c3c)

### Fun facts
Generate 3-5 observations from the trade data:
```typescript
function generateFunFacts(trades: Trade[], metrics: Metrics): string[] {
  const facts: string[] = [];

  // Most traded ticker
  const tickerCounts = countBy(trades, 'ticker');
  const [favTicker, favCount] = maxEntry(tickerCounts);
  facts.push(`You love ${favCount > 3 ? 'longing' : 'trading'} $${favTicker} — ${favCount} trades and counting.`);

  // Direction preference
  const longPct = trades.filter(t => t.direction === 'long').length / trades.length * 100;
  if (longPct > 80) facts.push("You've barely touched the short side. Perma-bull.");
  if (longPct < 20) facts.push("Almost all shorts. The bears know you by name.");
  if (longPct === 100) facts.push("You've never shorted anything. Ever.");

  // Best month
  facts.push(`Your best month was ${metrics.bestMonth}.`);

  // Streak info
  if (metrics.longestStreak >= 5) facts.push(`${metrics.longestStreak} wins in a row at your peak. On fire.`);

  // Memecoin check
  const memecoins = ['DOGE', 'SHIB', 'PEPE', 'BONK', 'WIF', 'POPCAT', 'PENGU', 'FLOKI'];
  const memeCount = trades.filter(t => memecoins.includes(t.ticker.toUpperCase())).length;
  if (memeCount > trades.length * 0.5) facts.push(`${memeCount} out of ${trades.length} trades were memecoins. Degen confirmed.`);

  return facts.slice(0, 5);
}
```

## Data fetching
```typescript
export default async function WrappedPage({ params }) {
  const handle = params.author.replace(/^@/, "");
  const data = await fetch(`${SITE_URL}/api/wrapped/${handle}`).then(r => r.json());

  if (data.error) {
    return <NotFound handle={handle} />;
  }

  return (
    <>
      <WrappedCard {...data} />
      <ActionButtons handle={handle} />
      <TryYours />
    </>
  );
}
```

## "Try yours" CTA
At the bottom, a prominent input to check your own wrapped:
```
Try yours:  [@ enter handle] [Go]
```
Navigates to `/wrapped/[handle]`.

## OG Metadata (dynamic)
```typescript
export async function generateMetadata({ params }) {
  const handle = params.author.replace(/^@/, "");
  return {
    title: `@${handle}'s CT Wrapped | paste.rank`,
    description: `@${handle} is "The Sniper" — 73% win rate, 12 trades, +14.2% avg. Get your CT Wrapped.`,
    openGraph: {
      images: [{ url: `/api/og/wrapped/${handle}`, width: 1200, height: 630 }],
    },
  };
}
```

## Done when
- Wrapped page renders with personality label, grades, highlights, fun facts
- Grades compute correctly from trade metrics
- Personality type assigned based on trading style
- Fun facts are generated from actual trade data
- "Try yours" input navigates to other handles
- Action buttons work
- The card looks AMAZING — screenshot-worthy, shareable
- Dynamic OG metadata for twitter cards
