# Task: Native Upstream Leaderboard with Full paste.trade Data

## Context
paste.trade's `/api/leaderboard` returns official rankings with rich author data. We already proxy this in our `/api/leaderboard` route but can leverage more of the response data, especially the author IDs for linking to profile pages and the platform field for venue filtering.

## What's Already Done
- `src/lib/paste-trade.ts` — `fetchPasteTradeLeaderboard()` returns typed `LeaderboardResult`
- `src/lib/upstream.ts` — `fetchLeaderboard()` with fallback chain (public -> auth -> search)
- `src/app/api/leaderboard/route.ts` — Full implementation with upstream + local DB fallback
- Leaderboard page already works

## Real API Response Shape (confirmed)
```json
{
  "authors": [{
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
      "avg_pnl": 11.21,
      "win_rate": 66.67,
      "best_pnl": 32.47,
      "best_ticker": "Iran x Israel/US conflict ends by May 15?",
      "total_pnl": 33.64
    }
  }]
}
```

## What Needs To Happen
1. **Author avatars** — The leaderboard has avatar_url for each author. Proxy these through our app (prefix `https://paste.trade` for relative URLs like `/api/avatars/...`). Show avatars in the leaderboard table.

2. **Platform badges** — Show platform icons (X/Twitter, YouTube, Hyperliquid, direct) next to author names based on the `platform` field.

3. **24h window** — We currently map `24h` to `7d` because upstream didn't support it. Test if upstream now supports `24h` directly and wire it up.

4. **Author IDs** — Store and use `author.id` for linking to author profile pages and for cross-referencing with trade data.

5. **Best P&L display** — Show `best_pnl` alongside `best_ticker` in the leaderboard row for context.

6. **Total P&L column** — Add `total_pnl` as an optional column in the leaderboard table.

## Platform Stats Integration
The `/api/stats` endpoint gives us global platform metrics. Show these above the leaderboard:
- Total users: 101
- Total trades: 883
- Win rate: (profitable_trades / total_trades * 100)%
