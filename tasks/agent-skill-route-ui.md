# Task: Enhance "What's The Trade?" with paste.trade Skill/Route Data

## Context
paste.trade's `POST /api/skill/route` returns incredibly detailed venue routing: current price, instruments with funding direction, max leverage, 24h volume, liquidation prices at 3x/5x/10x, 30-day funding income, and P&L scenario tables. This should power our "What's The Trade?" feature.

## What's Already Done
- `src/lib/paste-trade.ts` — `skillRoute()` and `skillDiscover()` are typed and working
- `src/app/api/execution/preflight/route.ts` — Already calls both skill/route and skill/discover
- `src/app/api/execute/route.ts` — Uses skillRoute for pre-execution validation
- `src/components/trade-finder.tsx` — Existing "What's The Trade?" UI

## Real API Response Shapes (confirmed)

### POST /api/skill/route { tickers: ["BTC"], direction: "long" }
```json
{
  "contract_version": "skill_assess_v1",
  "results": [{
    "ticker": "BTC",
    "direction": "long",
    "capital": 100000,
    "current_price": 70523.5,
    "sector": null,
    "instruments": {
      "perps": {
        "form": "perp",
        "platform": "hyperliquid",
        "available": true,
        "max_leverage": 40,
        "volume_24h": 1534993444,
        "liquidity": "high",
        "asset_class": "crypto",
        "instrument_description": "A perpetual future contract...",
        "funding_direction": "neutral",
        "funding_income_30d_dollars": { "3x": -962, "5x": -1604, "10x": -3208 },
        "liquidation_price": { "3x": 47015.67, "5x": 56418.8, "10x": 63471.15 },
        "liquidation_move_pct": { "3x": 33.33, "5x": 20, "10x": 10 },
        "from_here": {
          "3x": [
            { "move_pct": -50, "price": 35261.75, "pnl_dollars": -100000, "return_pct": -100, "note": "liquidated" },
            { "move_pct": 10, "price": 77575.85, "pnl_dollars": 30000, "return_pct": 30 },
            { "move_pct": 50, "price": 105785.25, "pnl_dollars": 150000, "return_pct": 150 }
          ]
        }
      }
    }
  }]
}
```

### POST /api/skill/discover { query: "bitcoin" }
```json
{
  "contract_version": "skill_discover_v1",
  "hyperliquid": {
    "search_results": [{
      "symbol": "BTC",
      "asset_class": "crypto",
      "description": "A perpetual future contract tracking Bitcoin...",
      "theme_tags": [],
      "max_leverage": 40,
      "liquidity": "high",
      "score": 3,
      "match_kind": "query"
    }],
    "query": "bitcoin",
    "total_instruments": 309
  }
}
```

## What Needs To Happen
1. **Venue routing card** — When a user enters a ticker/thesis, show which venues support it, the current price, max leverage, and liquidity tier.

2. **Leverage calculator** — Interactive leverage selector (1x/3x/5x/10x) that shows:
   - Liquidation price
   - Liquidation distance (%)
   - 30-day funding cost
   - P&L scenarios from the `from_here` table

3. **P&L scenario table** — Render the `from_here` scenarios as a visual table showing what happens at -50%, -20%, -10%, +10%, +20%, +50% moves at different leverage levels. Highlight the "liquidated" rows in red.

4. **Instrument discovery** — Use skill/discover to suggest alternative instruments when the user searches. Show theme_tags, liquidity, max leverage.

5. **Execution preflight** — Before the user confirms execution, show the preflight data (risk check, routing, estimated fees) from `/api/execution/preflight`.

## Design
- Bloomberg terminal aesthetic
- P&L scenarios: green gradient for gains, red gradient for losses
- Liquidation price shown with warning yellow/red
- Leverage slider with visual risk indicator
