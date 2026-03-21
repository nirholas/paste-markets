# Task 09: "What's The Trade?" Page

## Goal
Build the AI-powered trade finder. User pastes any URL (tweet, article, video) or types a thesis in plain text. The system analyzes it, finds tradeable ideas, identifies the best instrument/venue, and explains the reasoning. This is the "TradeTheNews" concept.

## Files
- `src/app/trade/page.tsx` (replace placeholder)
- `src/components/trade-finder.tsx`

## URL Pattern
`/trade` → the tool page
`/trade?q=https://x.com/...` → pre-filled with a URL

## Design

### Page layout
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  WHAT'S THE TRADE?                                       │
│  Paste any URL or type a thesis. AI finds the trade.     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  https://x.com/elonmusk/status/123456789         │    │
│  │                                                  │    │
│  │  OR type your thesis:                            │    │
│  │  "nvidia earnings will beat expectations"        │    │
│  └──────────────────────────────────────────────────┘    │
│  [Find The Trade]                                        │
│                                                          │
│  ── ANALYSIS ──────────────────────────────────────────  │
│                                                          │
│  SOURCE: Tweet by @elonmusk                              │
│  THESIS: Tesla robotaxi timeline accelerated             │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  TRADE #1                           CONFIDENCE 85│    │
│  │                                                  │    │
│  │  $TSLA  LONG                                     │    │
│  │  Venue: Robinhood (stock)                        │    │
│  │  Timeframe: 1-2 weeks                            │    │
│  │                                                  │    │
│  │  Robotaxi announcements historically pump TSLA   │    │
│  │  10-15% within days. Direct exposure to the      │    │
│  │  thesis with high liquidity.                     │    │
│  │                                                  │    │
│  │  [Track on paste.trade]                          │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  TRADE #2                           CONFIDENCE 72│    │
│  │                                                  │    │
│  │  "Tesla robotaxi launch in 2026"  YES            │    │
│  │  Venue: Polymarket (prediction market)           │    │
│  │  Timeframe: Event-based                          │    │
│  │                                                  │    │
│  │  Direct bet on the thesis. Currently trading     │    │
│  │  at 34c — implied probability seems low given    │    │
│  │  the signal.                                     │    │
│  │                                                  │    │
│  │  [Track on paste.trade]                          │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ── REASONING ─────────────────────────────────────────  │
│  The source suggests [analysis text from Claude]...      │
│                                                          │
│  DISCLAIMER: Not financial advice. AI-generated          │
│  analysis. Do your own research.                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Trade finder component (`src/components/trade-finder.tsx`)

This is a client component — handles input, submission, loading state, and results.

```typescript
"use client";

interface TradeResult {
  thesis: string;
  source_type: string;
  trades: Array<{
    ticker: string;
    direction: "long" | "short" | "yes" | "no";
    venue: string;
    confidence: number;
    reasoning: string;
    timeframe: string;
  }>;
  analysis: string;
}

export function TradeFinder() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);

  async function handleSubmit() {
    setLoading(true);
    const res = await fetch("/api/trade", {
      method: "POST",
      body: JSON.stringify({ input }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  // Render input, loading skeleton, and results
}
```

### Input section
- Large textarea/input that accepts both URLs and free text
- Auto-detect if input is a URL (starts with http) or thesis text
- Placeholder cycling through examples:
  - "https://x.com/elonmusk/status/..."
  - "nvidia earnings will beat expectations"
  - "fed will cut rates this summer"
  - "solana flips ethereum by market cap"
- "Find The Trade" button — prominent, accent color on hover

### Loading state
While waiting for Claude's response (can take 5-10s):
```
Analyzing source...
Extracting thesis...
Researching instruments...
```
Animated dots or progress indicator. Dark skeleton cards.

### Result cards
Each trade suggestion gets its own card:
- **Header:** Ticker + Direction (e.g. "$TSLA LONG")
- **Confidence bar:** Visual bar + percentage (85 = green, 50 = amber, <30 = red)
- **Venue:** Where to trade it (Robinhood, Hyperliquid, Polymarket)
- **Timeframe:** How long to hold
- **Reasoning:** 2-3 sentences explaining why
- **"Track on paste.trade" button** — links to paste.trade (if integration available) or shows how to track

### Confidence visual
```
CONFIDENCE ████████░░ 85
```
- >70: green
- 40-70: amber
- <40: red

### Analysis section
Below the trade cards, show the full analysis text from Claude. This is the "reasoning" — what the AI understood from the source and why it suggested these trades.

### Disclaimer
Always show at bottom:
```
Not financial advice. AI-generated analysis for informational purposes only.
Do your own research. Past performance does not guarantee future results.
```

## Backend integration
The page POSTs to `/api/trade` (built in Task 03). That route:
1. Detects input type (URL vs text)
2. If URL: fetches the content
3. Sends to Claude Haiku with analysis prompt
4. Returns structured trade suggestions

The Claude prompt (defined in the API route) should:
```
You are a financial analyst. Given a source (tweet, article, or thesis), identify tradeable opportunities.

For each opportunity:
- Identify the specific ticker/instrument
- Determine direction (long/short/yes/no)
- Suggest the best venue (Robinhood for stocks, Hyperliquid for crypto perps, Polymarket for prediction markets)
- Rate your confidence 0-100
- Explain your reasoning in 2-3 sentences
- Suggest a timeframe

Be opinionated. Don't hedge everything. If the signal is clear, say so.
If there's no trade, say "No clear trade here" rather than forcing one.

Source: {input}

Respond in JSON format:
{
  "thesis": "...",
  "source_type": "tweet|article|text|video",
  "trades": [...],
  "analysis": "..."
}
```

## Pre-filled URL support
If the page is loaded with `?q=...`, pre-fill the input and auto-submit:
```typescript
const searchParams = useSearchParams();
const initialQuery = searchParams.get("q");

useEffect(() => {
  if (initialQuery) {
    setInput(initialQuery);
    handleSubmit();
  }
}, []);
```

## Recent analyses
Below the tool, show 3-5 recent analyses (cached in localStorage or DB):
```
RECENT
─────
"fed will cut rates" → $TLT LONG (78% confidence)
"solana memecoin season" → $SOL LONG (82% confidence)
"nvidia beats earnings" → $NVDA LONG (91% confidence)
```

## OG Metadata
```typescript
export const metadata = {
  title: "What's The Trade? — AI Trade Finder | paste.rank",
  description: "Paste any URL or type a thesis. AI finds the optimal trade. Powered by Claude + paste.trade.",
  openGraph: {
    images: [{ url: "/api/og/trade", width: 1200, height: 630 }],
  },
};
```

## Done when
- Input accepts URLs and free text
- Loading state shows while processing
- Trade suggestions display as cards with confidence, venue, reasoning
- Full analysis text shows below
- Pre-filled URL support works
- Disclaimer always visible
- "Track on paste.trade" buttons link out
- Responsive and looks great
- Error handling for failed analysis (show user-friendly message)
