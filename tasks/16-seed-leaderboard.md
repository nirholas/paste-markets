# Task 16: Seed Leaderboard from paste.trade API

## Goal
The leaderboard is empty because we haven't populated it. Pull all available trade data from paste.trade, compute metrics for every author, and populate the rankings. Also set up a background sync that keeps data fresh.

## Context

- paste.trade API: `GET /api/search?top=90d&limit=200` returns recent trades across all authors
- Each trade includes `author_handle` — we can extract all unique authors
- DB functions exist: `getOrCreateAuthor`, `upsertTrades`, `updateRankings`, `updateAuthorRecord`
- Metrics computation exists: `computeMetrics` in `@/lib/metrics`
- The data layer at `@/lib/data` handles both SQLite and serverless modes

## What To Build

### 1. Seed script

Create `src/lib/seed-from-api.ts`:

```typescript
// Fetches all recent trades from paste.trade
// Groups by author
// Creates author records
// Upserts all trades
// Computes and stores rankings
```

Steps:
1. Fetch `GET /api/search?top=90d&limit=200` (paginate if needed using next_cursor)
2. Group trades by `author_handle`
3. For each author: `getOrCreateAuthor(handle)` then `upsertTrades(handle, trades)`
4. After all authors synced: `updateRankings("30d")` and `updateRankings("7d")`
5. Log summary: "Synced X authors, Y trades, Z ranked"

### 2. NPM script

Add to `package.json`:
```json
"db:sync": "tsx src/lib/seed-from-api.ts"
```

### 3. API route for manual sync

Create `src/app/api/sync/route.ts`:

```typescript
POST /api/sync
```

- Triggers the same sync logic
- Protected: only runs if request includes a secret header or env var check
- Returns: `{ authors: number, trades: number, ranked: number }`

### 4. Auto-sync on leaderboard visit

In the leaderboard API route (`src/app/api/leaderboard/route.ts`):
- If the leaderboard is empty (0 entries), trigger a sync automatically
- This ensures first-time visitors see data

### 5. Handle the paste.trade response format

The API returns `{ trades: [...], total: number, next_cursor: string | null }`.

Each trade object has these fields (map them to our schema):
- `author_handle` → author handle
- `ticker` → ticker
- `direction` → direction ("long", "short", "yes", "no")
- `platform` → platform ("robinhood", "hyperliquid", "polymarket")
- `pnl_pct` → pnl_pct
- `author_date` → entry_date
- `created_at` → posted_at
- `source_url` → source_url

## Validation

1. Run `npm run db:sync` — outputs sync summary
2. Visit /leaderboard — shows ranked authors with real data
3. Visit /@{handle} for any synced author — shows real scorecard
4. `npx next build` — clean

## Do NOT

- Hardcode author handles — discover them from the API
- Rate-limit too aggressively (paste.trade is our own infra)
- Skip error handling — some trades may have null fields
- Run sync on every page load (only on empty leaderboard or manual trigger)
