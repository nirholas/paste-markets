# Feature: Polymarket & Sports Betting Expansion

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun, Cloudflare Workers. Polymarket is already one of the three supported routing targets (alongside Hyperliquid and Robinhood). The routing logic in `/scripts/route.ts` and instrument discovery in `/scripts/discover.ts` already handles Polymarket contracts. P&L for Polymarket uses market_implied_prob (0-1 probability) scaling.

From Frank: "didn't build it for sports betting initially but someone just used it for the kentucky game lol" and "yeah sometimes polymarket can have better r/r, even capo cooks."

The opportunity: Polymarket covers sports, politics, macro events — not just crypto. This is a massive untapped call category. Lean into it explicitly.

---

## What to Build

Enhance Polymarket support to be a first-class experience, not just a fallback. Add sports/events as an explicit call category alongside crypto and stocks.

### Problem with current Polymarket handling:
- It's treated as a fallback ("no HL perps or RH shares available")
- The routing doesn't explicitly support sports/event keywords
- P&L display is confusing for prediction markets (0-100 probability, not price in USD)
- No dedicated UI for Polymarket-style calls

### Part 1: Better Polymarket Routing

**Keyword detection for sports/events:**
Add pattern matching in `/scripts/route.ts` (or extract.ts thesis detection) for common Polymarket query types:
```
"[Team] to win [Game/Tournament]"
"[Candidate] to win [Election]"
"[Event] to happen by [Date]"
"[Athlete] to [Achieve X]"
"over/under [X] [stat] in [Game]"
```

When detected, bypass the Hyperliquid/Robinhood path and go directly to Polymarket search.

**Polymarket contract matching:**
The current `discover.ts` queries Polymarket — enhance it to:
- Search by team name, player name, event name
- Return YES/NO contract options with current probability
- Include market volume (filter out illiquid markets < $1k volume)
- Include market expiry date (when the question resolves)
- Return the specific contract URL on Polymarket

**Enhanced routing output for Polymarket:**
```ts
{
  platform: "polymarket",
  ticker: "KENTUCKY_WINNER_2026",      // or the market slug
  contractTitle: "Will Kentucky win the 2026 NCAA Tournament?",
  direction: "yes" | "no",             // instead of long/short
  currentProbability: 0.23,            // 23% chance
  impliedOdds: "+330",                 // American odds format
  marketVolume: 85000,                 // USDC volume in this market
  expiresAt: "2026-04-06T00:00:00Z",   // when market resolves
  polymarketUrl: "https://polymarket.com/event/..."
}
```

### Part 2: Prediction Market UI

Trade cards for Polymarket calls look different from perps/stocks:

**Polymarket card:**
```
┌────────────────────────────────────────┐
│ 🎯 YES  [Polymarket]            ✅ Reliable │
│ @frankdegods           3 hours ago    │
│                                        │
│ "Kentucky to win the 2026 NCAA        │
│  Tournament — they've been on a tear  │
│  the last 4 games"                     │
│                                        │
│ At call: 23% ($0.23)                  │
│ Now:     31% ($0.31)   +34.8% 🟢      │
│                                        │
│ Implied Odds: +330 → +222             │
│ Resolves: April 6, 2026               │
│ Market Vol: $85k USDC                 │
└────────────────────────────────────────┘
```

Key differences from crypto cards:
- Show probability (%) instead of dollar price
- Show implied odds in American format (+330) — relatable for sports bettors
- Show market volume (liquidity indicator)
- Show resolution date
- Direction is "YES" / "NO" instead of "LONG" / "SHORT"
- PnL is probability change, not dollar change

**P&L calculation for prediction markets:**
```ts
// YES call: PnL = (current_prob - entry_prob) / entry_prob * 100%
// NO call: PnL = (entry_prob - current_prob) / entry_prob * 100%

// For display, also show:
// "If this resolves YES and you bought at 23%, you'd make +335%"
// "Currently at 31% — if you exited now, you'd be up +34.8%"
```

### Part 3: Category Tags

Add a `category` field to all trades:
```ts
type CallCategory =
  | "crypto_perp"      // Hyperliquid
  | "crypto_spot"      // Robinhood crypto
  | "stock"            // Robinhood equity
  | "sports"           // Polymarket sports
  | "politics"         // Polymarket elections/governance
  | "macro_event"      // Polymarket macro (Fed, CPI, etc.)
  | "entertainment"    // Polymarket awards, pop culture
```

Auto-classify during routing based on the Polymarket category or Robinhood/HL instrument type.

### Part 4: Sports/Events Feed

**`/events` page** — A dedicated feed for Polymarket calls only:
- Filter tabs: All Events | Sports | Politics | Macro | Entertainment
- Cards display with probability + implied odds
- Sort by: Hottest (move in probability since call) | Newest | Best PnL | Most Backed

**On the main feed:**
- Add "Category" filter (crypto / stocks / sports & events)
- Sports calls get a 🏈/⚽/🎾 emoji based on detected sport

### Part 5: Sports Caller Leaderboard

On the `/leaderboard` page, add a "Sports & Events" tab:
- Same structure as main leaderboard but filtered to `platform: "polymarket"` + `category: "sports"`
- Top sports callers ranked by win rate on prediction markets
- "Sports Bet Tracker" positioning

### Part 6: Better Polymarket Discovery

When routing a call to Polymarket, if multiple matching markets exist, surface them:
- "We found 3 Polymarket contracts related to your thesis:"
  1. "Kentucky to win NCAA 2026" — $85k vol, 23%, resolves Apr 6
  2. "Kentucky to cover spread vs Duke" — $12k vol, 51%, resolves tonight
  3. "NCAA 2026 winner" — $2.3M vol, 8% for Kentucky, resolves Apr 8
- Let the user (or the AI) pick the best expression

### Files to read first:
- `/scripts/route.ts` — routing logic to extend for Polymarket
- `/scripts/discover.ts` — Polymarket API integration to enhance
- `/shared/pnl.ts` — P&L calculation to handle probability-based math
- `/types.ts` — TradeExpression type, add `category` and `direction: "yes"|"no"`
- `/references/routing.md` — routing strategy docs
- Any existing Polymarket contract types in `/adapters/`

## Deliverable:
1. Enhanced Polymarket routing with sports/event keyword detection
2. `category` field added to trade schema + auto-classification at routing time
3. `direction: "yes" | "no"` support for Polymarket cards (alongside existing "long" | "short")
4. Polymarket trade card component with probability display, implied odds, volume, expiry
5. `/events` page with category tabs (Sports | Politics | Macro | Entertainment)
6. "Sports & Events" tab on the leaderboard
7. Category filter on the main feed
8. Multi-contract selection UI when multiple Polymarket markets match the thesis
