# Task 02: paste.trade API Client + Data Layer

## Goal
Build the API client for paste.trade and the local SQLite database that caches author data, trade history, and computed rankings. This is the data foundation everything else reads from.

## Context
paste.trade has a search API that returns trade data by author/ticker. We need to:
1. Wrap this API in a clean TypeScript client
2. Cache results in SQLite so we don't hammer the API
3. Compute and store aggregate metrics (win rate, avg P&L, rank)

## Files to create

### `src/lib/paste-trade.ts` — API Client

```typescript
/**
 * paste.trade API client.
 * Wraps the search endpoint with caching and error handling.
 */

const BASE_URL = "https://paste.trade";

export interface PasteTradeTrade {
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform?: string;
  pnlPct?: number;
  entryPrice?: number;
  currentPrice?: number;
  author_date?: string;
  posted_at: string;
  source_url?: string;
}

export interface SearchParams {
  author?: string;
  ticker?: string;
  top?: "7d" | "30d" | "90d" | "all";
  limit?: number;
}

export async function searchPasteTrade(params: SearchParams): Promise<PasteTradeTrade[]> {
  // Build URL with query params
  // Add Bearer token from PASTE_TRADE_KEY env var
  // Handle errors gracefully
  // Return typed array
}

export async function getAuthorTrades(handle: string, timeframe?: string): Promise<PasteTradeTrade[]> {
  // Convenience wrapper for author search
  // Default timeframe: 30d
}
```

**Important:** The API response shape may differ from the interface above. Make the client resilient — log unexpected fields, don't crash on missing ones. Normalize the response into our interface.

The API key comes from `process.env.PASTE_TRADE_KEY`. Requests need:
```
Authorization: Bearer {PASTE_TRADE_KEY}
```

### `src/lib/schema.sql` — Database Schema

```sql
-- Tracked authors
CREATE TABLE IF NOT EXISTS authors (
  handle TEXT PRIMARY KEY,
  display_name TEXT,
  added_at TEXT DEFAULT (datetime('now')),
  last_fetched TEXT,
  total_trades INTEGER DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0,
  avg_pnl REAL DEFAULT 0,
  best_pnl REAL,
  worst_pnl REAL,
  best_ticker TEXT,
  worst_ticker TEXT,
  rank INTEGER
);

-- Individual trades (cached from paste.trade)
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_handle TEXT NOT NULL,
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  pnl_pct REAL,
  platform TEXT,
  entry_date TEXT,
  posted_at TEXT,
  source_url TEXT,
  fetched_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (author_handle) REFERENCES authors(handle),
  UNIQUE(author_handle, ticker, direction, entry_date)
);

-- Precomputed rankings snapshot
CREATE TABLE IF NOT EXISTS rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_handle TEXT NOT NULL,
  rank INTEGER NOT NULL,
  win_rate REAL,
  avg_pnl REAL,
  total_trades INTEGER,
  computed_at TEXT DEFAULT (datetime('now')),
  timeframe TEXT DEFAULT '30d',
  FOREIGN KEY (author_handle) REFERENCES authors(handle)
);

-- Search/view tracking (for trending)
CREATE TABLE IF NOT EXISTS views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_handle TEXT NOT NULL,
  viewed_at TEXT DEFAULT (datetime('now')),
  page TEXT -- 'profile', 'leaderboard', 'h2h', 'wrapped'
);

CREATE INDEX IF NOT EXISTS idx_trades_author ON trades(author_handle);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_rankings_timeframe ON rankings(timeframe, rank);
CREATE INDEX IF NOT EXISTS idx_views_handle ON views(author_handle);
```

### `src/lib/db.ts` — Database Connection + Queries

```typescript
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Initialize database, run schema
// Export query functions:

export function getOrCreateAuthor(handle: string): Author;
export function upsertTrades(handle: string, trades: PasteTradeTrade[]): void;
export function getAuthorMetrics(handle: string): AuthorMetrics | null;
export function getLeaderboard(timeframe: string, limit: number, offset: number): LeaderboardEntry[];
export function updateRankings(timeframe: string): void; // recompute all ranks
export function getHeadToHead(a: string, b: string): { a: AuthorMetrics; b: AuthorMetrics };
export function recordView(handle: string, page: string): void;
export function getTrending(): string[]; // most viewed handles
```

### `src/lib/metrics.ts` — Shared Calculation Functions

```typescript
export interface AuthorMetrics {
  handle: string;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;        // 0-100
  avgPnl: number;         // percentage
  bestTrade: { ticker: string; direction: string; pnl: number; date: string } | null;
  worstTrade: { ticker: string; direction: string; pnl: number; date: string } | null;
  tradesByPlatform: Record<string, number>;
  recentTrades: TradeSummary[];
  streak: number;         // current win/loss streak (positive = wins)
}

export function computeMetrics(trades: TradeSummary[]): AuthorMetrics;
export function computeWinRate(trades: { pnl_pct: number }[]): number;
export function computeAvgPnl(trades: { pnl_pct: number }[]): number;
export function computeStreak(trades: { pnl_pct: number; entry_date: string }[]): number;
export function formatPnl(pct: number): string;  // "+12.3%" or "-5.1%"
export function formatWinRate(pct: number): string; // "73%"
export function winRateBar(pct: number, length?: number): string; // "███████░░░"
```

### `src/lib/sync.ts` — Data Sync Logic

```typescript
/**
 * Fetches fresh data from paste.trade for an author and updates the local DB.
 * Called by API routes when data is stale (>1 hour old).
 */
export async function syncAuthor(handle: string): Promise<AuthorMetrics> {
  // 1. Check last_fetched in DB
  // 2. If stale (>1 hour), fetch from paste.trade API
  // 3. Upsert trades into DB
  // 4. Recompute metrics
  // 5. Update author record
  // 6. Return fresh metrics
}

export async function syncMultipleAuthors(handles: string[]): Promise<void> {
  // Batch sync with rate limiting (don't slam paste.trade)
  // 500ms delay between requests
}

export function isStale(lastFetched: string | null, maxAgeMs?: number): boolean {
  // Default max age: 1 hour
}
```

## Seed data
Create `src/lib/seed.ts` that adds initial tracked authors to the DB:
```typescript
const INITIAL_AUTHORS = [
  "frankdegods",
  "nichxbt",
  "AzFlin",
  "0xRiver8",
  "CryptoKaleo",
  "GCRClassic",
  "hsaborern",
  "blknoiz06",
  "ColdBloodShill",
  "Pentosh1",
];
```

Add a script in `package.json`:
```json
{
  "scripts": {
    "db:seed": "tsx src/lib/seed.ts"
  }
}
```

## Important notes
- SQLite DB file goes to `src/data/db.sqlite` — gitignored
- Create the `src/data/` directory if it doesn't exist
- The paste.trade API may return different field names than expected — be flexible, log unknowns
- All DB operations should be synchronous (better-sqlite3 is sync by design)
- Add `tsx` as a dev dependency if not already present

## Done when
- `paste-trade.ts` can fetch and parse author trades from the API
- `db.ts` initializes SQLite with schema and all query functions work
- `metrics.ts` computes win rate, avg P&L, streaks, best/worst
- `sync.ts` fetches from API and updates DB
- `seed.ts` populates initial authors
- `npm run db:seed` works
