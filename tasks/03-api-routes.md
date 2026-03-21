# Task 03: API Routes

## Goal
Build all the backend API routes that the frontend pages will consume. Every page fetches data through these routes, which read from the local SQLite cache and sync with paste.trade when data is stale.

## Context
The frontend pages (leaderboard, profiles, h2h, wrapped) are built by other agents. They will call these API routes. The data layer (`src/lib/db.ts`, `src/lib/paste-trade.ts`, `src/lib/sync.ts`) is built by Task 02. Import from those paths — they will exist.

All routes live under `src/app/api/`. They return JSON responses.

## Routes to build

### `GET /api/author/[handle]`
**File:** `src/app/api/author/[handle]/route.ts`

Returns full author profile data.

```typescript
// Response shape:
{
  handle: string;
  metrics: {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    winCount: number;
    lossCount: number;
    bestTrade: { ticker: string; direction: string; pnl: number; date: string } | null;
    worstTrade: { ticker: string; direction: string; pnl: number; date: string } | null;
    streak: number;
  };
  trades: Array<{
    ticker: string;
    direction: string;
    pnl_pct: number;
    platform?: string;
    entry_date: string;
  }>;
  rank: number | null;
  lastUpdated: string;
}
```

Logic:
1. Clean the handle (remove @, lowercase)
2. Call `syncAuthor(handle)` if data is stale
3. Get metrics from DB
4. Get trade history from DB
5. Get current rank from rankings table
6. Return combined response

### `GET /api/leaderboard`
**File:** `src/app/api/leaderboard/route.ts`

Returns ranked list of authors.

Query params:
- `timeframe` — "7d", "30d", "90d", "all" (default: "30d")
- `sort` — "win_rate", "avg_pnl", "total_trades" (default: "win_rate")
- `limit` — number (default: 50, max: 100)
- `offset` — number (default: 0)
- `min_trades` — minimum trade count to qualify (default: 5)

```typescript
// Response:
{
  entries: Array<{
    rank: number;
    handle: string;
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    bestTicker: string;
    bestPnl: number;
    streak: number;
  }>;
  total: number;
  timeframe: string;
  updatedAt: string;
}
```

Logic:
1. Query rankings table with filters
2. If rankings are stale (>1 hour), trigger recomputation
3. Apply sort, limit, offset
4. Filter by min_trades
5. Return paginated results

### `GET /api/vs`
**File:** `src/app/api/vs/route.ts`

Head-to-head comparison.

Query params:
- `a` — first handle (required)
- `b` — second handle (required)
- `timeframe` — "7d", "30d", "90d", "all" (default: "30d")

```typescript
// Response:
{
  a: AuthorProfile;
  b: AuthorProfile;
  comparison: {
    winRateWinner: "a" | "b" | "tie";
    avgPnlWinner: "a" | "b" | "tie";
    totalTradesWinner: "a" | "b" | "tie";
    bestTradeWinner: "a" | "b" | "tie";
    overallWinner: "a" | "b" | "tie";
    sharedTickers: Array<{
      ticker: string;
      a_pnl: number;
      b_pnl: number;
    }>;
  };
  timeframe: string;
}
```

Logic:
1. Sync both authors if stale
2. Get metrics for both
3. Compare across dimensions
4. Find tickers they both traded and compare P&L
5. Determine overall winner (most dimensions won)

### `GET /api/wrapped/[author]`
**File:** `src/app/api/wrapped/[author]/route.ts`

CT Wrapped / Report Card data.

```typescript
// Response:
{
  handle: string;
  grades: {
    overall: "S" | "A" | "B" | "C" | "D" | "F";
    timing: "S" | "A" | "B" | "C" | "D" | "F";
    conviction: "S" | "A" | "B" | "C" | "D" | "F";
    consistency: "S" | "A" | "B" | "C" | "D" | "F";
    riskManagement: "S" | "A" | "B" | "C" | "D" | "F";
  };
  personality: {
    label: string;       // "The Sniper", "The Degen", "The Bag Holder", etc.
    description: string; // One-liner about their style
  };
  highlights: {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    bestMonth: string;         // "February 2026"
    favoriteTicker: string;    // most traded
    favoriteDirection: string; // "long" or "short"
    longestStreak: number;
    biggestWin: { ticker: string; pnl: number };
    biggestLoss: { ticker: string; pnl: number };
  };
  funFacts: string[]; // 3-5 fun observations
}
```

Logic for grades:
- **Timing:** Based on avg entry-to-peak ratio (if data available), else based on win rate
- **Conviction:** Based on avg position hold time and consistency of direction
- **Consistency:** Standard deviation of P&L — lower variance = higher grade
- **Risk Management:** Ratio of avg win to avg loss, worst drawdown
- **Overall:** Weighted combination

Personality labels (map from metrics):
- Win rate >70% + avg P&L >15%: "The Sniper"
- Win rate >60% + total trades >50: "The Grinder"
- Win rate <40% but has a >100% trade: "The Degen"
- Mostly shorts: "The Bear"
- Mostly prediction markets: "The Oracle"
- Win rate <30%: "The Bag Holder"
- Very consistent P&L: "The Machine"
- High win rate, low avg: "Mr. Consistent"
- Few trades, high avg: "Quality Over Quantity"

Fun facts format:
- "You love longing $SOL — 7 trades and counting"
- "Your best month was February with +142% total P&L"
- "You've never shorted anything. Ever."
- "3 out of your last 5 trades were memecoins"

### `POST /api/trade`
**File:** `src/app/api/trade/route.ts`

"What's The Trade?" endpoint. Takes a URL or text thesis, uses Claude to analyze it.

```typescript
// Request body:
{
  input: string;  // URL or text thesis
}

// Response:
{
  thesis: string;          // Extracted thesis
  source_type: string;     // "tweet", "article", "text", "video"
  trades: Array<{
    ticker: string;
    direction: "long" | "short" | "yes" | "no";
    venue: string;         // "Robinhood", "Hyperliquid", "Polymarket"
    confidence: number;    // 0-100
    reasoning: string;     // Why this trade
    timeframe: string;     // "1 day", "1 week", "1 month"
  }>;
  analysis: string;        // Full analysis text
}
```

Logic:
1. Detect input type (URL vs text)
2. If URL: fetch the page content (use fetch for articles, note that tweets/videos may need special handling)
3. Send to Claude Haiku with a prompt that extracts tradeable ideas
4. For each idea, identify the best instrument and venue
5. Return structured analysis

Claude prompt should:
- Extract the core thesis from the source
- Identify 1-5 tradeable ideas
- For each, suggest specific ticker, direction, venue, timeframe
- Explain reasoning concisely
- Be opinionated — don't hedge everything

Use `ANTHROPIC_API_KEY` env var. Model: `claude-haiku-4-5-20251001`.

### `GET /api/search`
**File:** `src/app/api/search/route.ts`

Search for authors by handle prefix.

Query params:
- `q` — search query (handle prefix)
- `limit` — max results (default: 10)

```typescript
// Response:
{
  results: Array<{
    handle: string;
    totalTrades: number;
    winRate: number;
  }>;
}
```

Logic:
1. Search authors table with LIKE query
2. If no local results, try paste.trade API search
3. Return matches

### `GET /api/trending`
**File:** `src/app/api/trending/route.ts`

Most viewed/searched authors.

```typescript
// Response:
{
  trending: Array<{
    handle: string;
    views: number;
    winRate: number;
  }>;
}
```

## Error handling
All routes should:
- Return proper HTTP status codes (200, 400, 404, 500)
- Return JSON error bodies: `{ error: string; details?: string }`
- Never expose internal errors to clients
- Log errors to console for debugging

## Done when
- All 7 API routes are implemented
- Routes return proper JSON responses
- Error handling works for missing authors, bad params
- Stale data triggers automatic sync from paste.trade
- `/api/trade` calls Claude and returns structured analysis
