# Task: "What's The Trade?" — Extract Trades from Articles, Threads, and Videos

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard has an existing `/trade` page with a basic "What's The Trade?" tool that takes a URL or text and finds trades. The paste.trade backend already supports extracting from tweets, YouTube videos, articles, and PDFs.

Community request from @Oncha1nd: "Reads a long article... Threadguy voice: so you may be asking yourself what's the trade here? Add that feature."

Frank confirmed the `/trade` command works: "/trade [any text] will route to best trade available on either robinhood, hyperliquid or polymarket — once it's routed, price is tracked from that point forward."

This task enhances the existing trade finder to handle **long-form content** — articles, Twitter threads, YouTube videos, research reports — and extract ALL tradeable theses, not just one.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Enhanced Trade Finder — `src/lib/trade-extractor.ts`

A module that processes various content types and extracts multiple trade theses:

```ts
interface TradeExtraction {
  source: {
    type: "tweet" | "thread" | "article" | "youtube" | "pdf" | "text"
    url: string | null
    title: string
    author: string | null
    publishedAt: string | null
    wordCount: number
  }
  theses: ExtractedThesis[]
  summary: string                  // 2-3 sentence summary of the content
  processingTime: number           // ms
}

interface ExtractedThesis {
  id: string                       // uuid
  ticker: string
  direction: "long" | "short" | "yes" | "no"
  platform: "hyperliquid" | "robinhood" | "polymarket"
  confidence: number               // 0-1
  reasoning: string                // why this trade was detected
  quote: string                    // relevant excerpt from the source
  timeframe: string | null         // "short-term" | "medium-term" | "long-term"
  priceAtExtraction: number | null
  conviction: "high" | "medium" | "low"
}
```

### 2. Content Processing Pipeline

**Input types and how to handle each:**

**Twitter thread** (URL like `x.com/.../status/...`):
- Fetch the thread using xactions `scrapeThread(tweetId)`
- Concatenate all tweets in the thread
- Run through Claude for thesis extraction

**Article** (any URL):
- Fetch HTML, extract readable content (use existing extract logic or a simple HTML-to-text)
- Handle paywalled content gracefully: "Could not access full article — extracted from available preview"

**YouTube video** (youtube.com or youtu.be URL):
- Pass URL to paste.trade backend `POST /api/skill/route` which handles YouTube transcript extraction
- Or fetch transcript via YouTube's auto-captions if available

**Raw text** (user pastes text directly):
- Pass directly to Claude for analysis

**PDF** (uploaded or URL):
- If URL ends in .pdf, fetch and extract text
- Handle via paste.trade backend

### 3. Multi-thesis Claude prompt

The Claude Haiku prompt should extract ALL tradeable ideas from the content:

```
You are a trade thesis extractor. Given the following content, identify ALL tradeable ideas mentioned.

For each thesis found, provide:
- ticker: the specific asset (BTC, ETH, AAPL, etc.)
- direction: long or short (or yes/no for prediction markets)
- confidence: 0-1 how clearly this is stated as a trade idea vs just mentioned
- reasoning: 1-2 sentences on why this is a trade
- quote: the exact text that contains this thesis
- conviction: how convicted the author seems (high/medium/low)
- timeframe: if mentioned (short-term = days, medium = weeks, long = months)

Important:
- Include EVERY tradeable mention, even subtle ones
- Differentiate between "I'm long X" (high confidence trade) vs "X looks interesting" (low confidence mention)
- For articles that discuss multiple assets, extract each one separately
- Ignore generic market commentary with no specific ticker
```

### 4. API endpoint — `src/app/api/extract/route.ts`

```
POST /api/extract              — extract trades from content
```

**Request:**
```ts
{
  input: string,                // URL or raw text
  type?: "auto" | "tweet" | "thread" | "article" | "youtube" | "text"
}
```

**Response:**
```ts
{
  extraction: TradeExtraction,
  tracked: Array<{
    thesisId: string,
    tradeUrl: string,          // paste.trade/s/{id}
    ticker: string,
    direction: string
  }>
}
```

### 5. Frontend: Enhanced `/trade` page

Redesign the trade finder page to handle multi-thesis extraction:

**Input section:**
```
┌──────────────────────────────────────────────┐
│  WHAT'S THE TRADE?                           │
│                                              │
│  Paste any URL or text to find the trades    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ https://x.com/taikimaeda/status/...   │  │
│  │                                        │  │
│  │ Or paste article text directly...      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Supports: Tweets · Threads · Articles ·     │
│  YouTube · PDFs · Raw text                   │
│                                              │
│  [Extract Trades]                            │
└──────────────────────────────────────────────┘
```

**Results section — multi-thesis display:**
```
SOURCE: Taiki Maeda — "March Market Outlook" (YouTube, 24 min)
Summary: Discusses BTC consolidation, ETH upgrade catalyst,
and a Polymarket play on Fed rate cuts.

━━━ 4 TRADES FOUND ━━━

┌─ Trade 1 ─────────────────────────────────────┐
│ BTC LONG on Hyperliquid          Confidence 92%│
│                                                │
│ "BTC is consolidating at 84k, I think we see  │
│  90k+ by end of month"                        │
│                                                │
│ Conviction: HIGH · Timeframe: Short-term       │
│ Entry: $84,200                                 │
│                                                │
│ [Track This Trade]  [View on paste.trade]      │
└────────────────────────────────────────────────┘

┌─ Trade 2 ─────────────────────────────────────┐
│ ETH LONG on Hyperliquid          Confidence 78%│
│                                                │
│ "ETH upgrade coming, could see relative        │
│  strength vs BTC"                              │
│                                                │
│ Conviction: MEDIUM · Timeframe: Medium-term    │
│ Entry: $3,420                                  │
│                                                │
│ [Track This Trade]  [View on paste.trade]      │
└────────────────────────────────────────────────┘

┌─ Trade 3 ─────────────────────────────────────┐
│ FED RATE CUT YES on Polymarket   Confidence 65%│
│                                                │
│ "I think the Fed cuts in June, market is       │
│  underpricing this"                            │
│                                                │
│ Conviction: LOW · Timeframe: Long-term         │
│ Market: 42% implied probability                │
│                                                │
│ [Track This Trade]  [View on paste.trade]      │
└────────────────────────────────────────────────┘
```

**"Track All" button:**
- One-click to track all extracted trades simultaneously
- Creates a "source page" grouping all trades from this content
- Returns a shareable link: `paste.markets/source/{sourceId}`

### 6. Source page — `src/app/source/[id]/page.tsx`

When multiple trades are extracted from one piece of content, group them on a source page:

```
SOURCE: @taikimaeda — March Market Outlook (YouTube)
Extracted: Mar 20, 2026 · 4 trades found

Trade 1: BTC LONG     +4.2% ✅
Trade 2: ETH LONG     -1.8% ❌
Trade 3: FED CUT YES  +12% ✅
Trade 4: SOL LONG     +8.1% ✅

Source Performance: 3/4 wins (75%) · Avg PnL: +5.6%

[Share Source Report]
```

### 7. Recent extractions feed

Add to the `/trade` page below the input:

```
━━━ RECENT EXTRACTIONS ━━━

@frankdegods thread · 2 trades found · 1h ago
Bloomberg article · 5 trades found · 3h ago
Taiki YouTube · 4 trades found · 6h ago
```

---

## Files to Read First
- `paste-dashboard/src/app/trade/page.tsx` — existing trade finder page
- `paste-dashboard/src/components/trade-finder.tsx` — existing trade finder component
- `paste-dashboard/src/components/smart-input.tsx` — input handling
- `paste-dashboard/src/lib/paste-trade.ts` — paste.trade API client
- `paste-dashboard/src/lib/scan-processor.ts` — trade detection prompts

## Deliverable
1. `src/lib/trade-extractor.ts` — multi-thesis extraction pipeline
2. `src/app/api/extract/route.ts` — extraction API endpoint
3. Enhanced `/trade` page with multi-thesis display
4. `src/app/source/[id]/page.tsx` — grouped source page
5. Source performance tracking in SQLite
6. "Track All" one-click for multiple trades
7. Recent extractions feed on `/trade` page
8. Support for: tweets, threads, articles, YouTube, PDFs, raw text
