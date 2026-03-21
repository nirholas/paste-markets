# Task: Real-Time Price Updates via paste.trade WebSocket

## Context
The WebSocket at `wss://paste.trade/ws` streams `price_update` events immediately on connect. We have a working WebSocket client and React hook, but they're not connected to any UI components for live updates.

## What's Already Done
- `src/lib/ws-client.ts` — Working WebSocket client with reconnection, correctly typed for real event shape
- `src/lib/use-paste-ws.ts` — React hook exposing `priceUpdates: Map<string, WSPriceEntry>`, `newTrades`, `isConnected`
- `src/lib/ws-bridge.ts` — WebSocket bridge (may need updating)

## Real WebSocket Message Shape (confirmed)
```json
{
  "type": "price_update",
  "prices": {
    "price:polymarket:0x814657a16a3c5b39834864251372e30f68ddcd0f040c5c6a83a52cddb2c35226:yes": {
      "price": 0.2665,
      "ts": 1774106444581
    },
    "price:polymarket:0x814657a16a3c5b39834864251372e30f68ddcd0f040c5c6a83a52cddb2c35226:no": {
      "price": 0.7335,
      "ts": 1774106444581
    }
  }
}
```

The price key format is: `price:{platform}:{condition_id}:{side}`

## What Needs To Happen
1. **Price key mapping** — Build a mapping layer that links trades to their WebSocket price keys. For Polymarket trades, the key is `price:polymarket:{condition_id}:{outcome}`. The `condition_id` and `outcome` fields are available on trade objects from the feed.

2. **Live price component** — Create a `<LivePrice tradeId={id} conditionId={...} outcome={...} />` component that:
   - Subscribes to the WebSocket via `usePasteWS()`
   - Looks up the current price from the `priceUpdates` map
   - Shows a price flash animation (green up, red down) when price changes
   - Falls back to polling `/api/prices` if WebSocket disconnects

3. **Connection status** — Show a small indicator (green dot = connected, yellow = reconnecting, red = disconnected) in the navbar or feed header.

4. **Feed integration** — Plug `<LivePrice>` into feed cards and trade detail pages. When a price update arrives for a displayed trade, recalculate its P&L in real-time.

5. **Performance** — Use `useMemo` or a ref to avoid re-rendering the entire feed on every price tick. Only re-render the specific trade card whose price changed.

## Design
- Price flash: brief green/red background pulse on change
- Connection dot: 8px circle, absolutely positioned
- P&L updates: smooth CSS transition on number changes
