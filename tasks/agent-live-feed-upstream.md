# Task: Wire Live Feed to paste.trade /api/feed + WebSocket

## Context
We've confirmed paste.trade's `/api/feed` returns rich, structured trade cards and the WebSocket at `wss://paste.trade/ws` streams real-time `price_update` events. Our internal `/api/feed` route already fetches from upstream, but the live-updating client components don't use the WebSocket for real-time P&L.

## What's Already Done
- `src/lib/paste-trade.ts` — `fetchPasteTradeFeed()` is wired and typed
- `src/lib/ws-client.ts` — WebSocket client handles `price_update` events with correct types
- `src/lib/use-paste-ws.ts` — React hook exposes `priceUpdates` map
- `src/app/api/feed/route.ts` — Fetches from upstream, enriches with hotness/alpha scores

## What Needs To Happen
1. **Feed client** (`src/components/feed-client.tsx` or `src/components/home-feed.tsx`) — Connect the WebSocket hook to update trade card prices in real-time. When a `price_update` comes in matching a displayed trade's condition_id/trade_id, update its current_price and pnl_pct live.

2. **Price polling fallback** — Use `fetchPasteTradePrices()` from `src/lib/paste-trade.ts` to poll `/api/prices` every 10s for trade IDs that don't get WebSocket updates. This is how paste.trade's own frontend works.

3. **Live indicator** — Show a green dot or "LIVE" badge on trades that have received a recent price_update (within last 30s).

## API Shapes (confirmed)

### GET /api/feed?sort=new&limit=20
```json
{
  "items": [{
    "source": { "id", "title", "summary", "platform", "created_at", "source_images" },
    "author": { "handle", "avatar_url", "platform" },
    "trades": [{
      "id", "ticker", "direction", "platform", "instrument",
      "author_price", "posted_price", "created_at", "logo_url",
      "headline_quote", "ticker_context", "chain_steps",
      "market_question", "condition_id", "market_slug", "outcome"
    }],
    "tradeCount": 1,
    "submitter": { "handle", "avatar_url" }
  }]
}
```

### WebSocket price_update
```json
{
  "type": "price_update",
  "prices": {
    "price:polymarket:0x...:yes": { "price": 0.2665, "ts": 1774106444581 },
    "price:polymarket:0x...:no": { "price": 0.7335, "ts": 1774106444581 }
  }
}
```

### GET /api/prices?ids=trade_id1,trade_id2
Returns `{ "trade_id1": { "price": 58.18, "timestamp": 1774106414265 } }`

## Design
- Use Bloomberg terminal aesthetic (dark theme, monospace)
- P&L: green (#2ecc71) positive, red (#e74c3c) negative, always show +/- sign
- Cards: bg-[#0f0f22] border border-[#1a1a2e] rounded-lg
