# Agent Task: Refactor Leaderboard to Use Native paste.trade API

## Your working directory
`/workspaces/agent-payments-sdk/paste-dashboard/`

Read `CLAUDE.md` before starting. Follow its design system and conventions exactly.

---

## What to do

The current leaderboard at `src/app/api/leaderboard/route.ts` builds rankings locally by syncing author trades into SQLite and computing ranks. This is unnecessary — paste.trade has a native leaderboard endpoint. Replace it.

---

## paste.trade Leaderboard API

```
GET https://paste.trade/api/leaderboard
Authorization: Bearer ${PASTE_TRADE_KEY}
```

Query params:
- `window` — `7d` | `30d` | `all` (default: `7d`)
- `sort` — `avg_pnl` | `win_rate` | `total_trades` (default: `avg_pnl`)
- `limit` — number (default: 20)

Response shape:
```json
{
  "window": "7d",
  "sort": "avg_pnl",
  "computed_at": "2026-03-21T08:45:08.759Z",
  "authors": [
    {
      "rank": 1,
      "author": {
        "id": "75c23110-0",
        "handle": "CryptoMikli",
        "name": null,
        "avatar_url": "/api/avatars/75c23110-0",
        "platform": "x"
      },
      "stats": {
        "trade_count": 3,
        "avg_pnl": 11.64,
        "win_rate": 66.67,
        "best_pnl": 33.77,
        "best_ticker": "Iran x Israel/US conflict ends by May 15?",
        "total_pnl": 34.91
      }
    }
  ]
}
```

Note: `avatar_url` is a relative path like `/api/avatars/75c23110-0` — prefix with `https://paste.trade` to make it absolute.

---

## Files to change

### 1. `src/app/api/leaderboard/route.ts`

Replace the entire implementation. The new route should:
- Accept `window` (7d/30d/all), `sort` (avg_pnl/win_rate/total_trades), `limit` query params
- Proxy the paste.trade API with those params
- Map the response to this shape for the frontend:
```ts
{
  entries: Array<{
    rank: number
    handle: string
    winRate: number       // stats.win_rate
    avgPnl: number        // stats.avg_pnl
    totalTrades: number   // stats.trade_count
    totalPnl: number      // stats.total_pnl
    bestTicker: string    // stats.best_ticker
    platform: string      // author.platform
    avatarUrl: string     // "https://paste.trade" + author.avatar_url (or null if no avatar_url)
  }>
  total: number           // authors.length
  window: string
  sort: string
  updatedAt: string       // computed_at
}
```
- Add `Cache-Control: s-maxage=60, stale-while-revalidate=30` header
- No SQLite. No local DB calls at all.

### 2. `src/app/leaderboard/page.tsx`

Update to use the new fields:
- Show `platform` as a small badge/label (x, youtube, robinhood, bloomberg — use their platform name, lowercase)
- Show `totalPnl` as a column (e.g. "Total P&L: +34.91%")
- Show `bestTicker` in the best trade column
- Add window selector buttons: 7d / 30d / all (default 7d to match API)
- Keep the existing sort controls (win rate / avg P&L / total trades)
- If `avatarUrl` exists, show a small avatar image next to the handle — 24x24px circle, fallback to first letter of handle

### 3. `src/app/api/leaderboard/route.ts` — remove all SQLite imports

The new route should import nothing from `@/lib/db`, `@/lib/data`, or `@/lib/metrics`. It is a pure HTTP proxy.

---

## Environment variables (already in .env)

```
PASTE_TRADE_KEY=<bearer token>
```

Base URL: `https://paste.trade` (hardcode this — no env var needed)

---

## Do not touch

- `src/lib/db.ts` — leave it, other routes still use it
- `src/lib/data.ts` — leave it
- Any other routes

---

## Design rules (from CLAUDE.md)

- Dark Bloomberg terminal theme
- Win (positive P&L): `#2ecc71`
- Loss (negative P&L): `#e74c3c`
- Always show P&L with sign: `+12.3%` or `-5.1%`
- Font: JetBrains Mono
- Cards: `bg-[#0f0f22] border border-[#1a1a2e] rounded-lg`
