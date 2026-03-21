# Search API — query paste.trade data during conversations

## Endpoint

```
GET https://paste.trade/api/search
Authorization: Bearer $PASTE_TRADE_KEY
```

## Query modes (combinable)

| Param | Example | What it does |
|-------|---------|-------------|
| `ticker` | `?ticker=GOLD` | All trades for a ticker |
| `author` | `?author=PeterSchiff` | All trades by an author |
| `q` | `?q=iran oil` | Full-text search on theses |
| `top` | `?top=7d` | Best performing trades (24h, 7d, 30d, all) |
| `direction` | `?direction=short` | Filter long/short |
| `platform` | `?platform=hyperliquid` | Filter by venue |
| `limit` | `?limit=10` | Max results (default 20, max 100) |
| `cursor` | `?cursor=...` | Pagination |

At least one of `ticker`, `author`, `q`, or `top` is required.

## When to query

Query when the user is **thinking about a trade**, not when they paste a URL to process.

- "I'm thinking about gold" → `?ticker=GOLD`
- "Who's been right about oil?" → `?ticker=CL&top=all`
- "Anyone bearish on NVDA?" → `?ticker=NVDA&direction=short`
- "Best trades this week?" → `?top=7d`
- "What are people saying about Iran?" → `?q=iran`

Do NOT query when the user pastes a source URL — just process it normally.

## Response shape

```json
{
  "trades": [{
    "trade_id": "abc123",
    "thesis": "Gold will rise as real rates fall",
    "ticker": "GOLD",
    "direction": "long",
    "platform": "hyperliquid",
    "instrument": "perps",
    "author_handle": "PeterSchiff",
    "author_avatar_url": "/api/avatars/...",
    "source_url": "https://x.com/...",
    "source_title": "Peter Schiff on gold",
    "source_platform": "youtube",
    "author_price": 2340.5,
    "posted_price": 2345.2,
    "created_at": "2026-03-19T14:22:00Z",
    "author_date": "2025-10-23T00:13:06Z",
    "headline_quote": "Gold is the only real money",
    "ticker_context": "GOLD tracks spot gold on Hyperliquid...",
    "chain_steps": [
      "Central banks buying gold to replace dollar reserves",
      "Only 2% of investable assets in gold",
      "Sovereign debt crisis makes Treasuries uninvestable"
    ],
    "explanation": "Free-form reasoning paragraph...",
    "market_question": null,
    "pnl_pct": 3.42,
    "current_price": 2425.0
  }],
  "total": 31,
  "next_cursor": "2026-03-18T10:00:00Z|def456"
}
```

`pnl_pct` and `current_price` are only populated in `?top=` mode.

## How to present results

Summarize conversationally. Don't dump raw JSON. Example:

**User:** "What's the bull case for gold right now?"

**Good response:**
> 29 people are long gold on paste.trade. The main theses:
> 1. **Iran escalation** — @zerohedge citing ground troop prep, gold as safe haven (+X%)
> 2. **Inflation** — @TKL_Adam on 5.2% inflation expectations
> 3. **De-dollarization** — @PeterSchiff on central banks replacing dollar reserves
>
> Best performer: @DeepDishEnjoyer on a related CL LONG at +40%.
> Want me to track a gold position for you?

**User:** "Anyone bearish on NVDA?"

**Good response:**
> 12 shorts on paste.trade. Strongest theses:
> - @marginsmall: "AI overbuild → compute glut in 2027 → washout 2028-2030"
> - @AndrewYang: compared AI valuations to dot-com bubble
> - @ContrarianCurse: P/E compressing even as earnings grow
>
> Want to dig into any of these, or track your own NVDA thesis?

## When results are empty — suggest adding data

If a query returns 0 trades, the gap IS the opportunity. Suggest the user contribute:

**User:** "What's the trade on AAPL?"

**Response when 0 results:**
> Nobody's tracking AAPL on paste.trade yet — you'd be the first.
>
> If you have a thesis, just tell me (e.g., "I think AAPL drops after earnings") and I'll route and track it.
> Or paste a tweet/article about AAPL and I'll extract the trade.

**User:** "Who called TSLA?"

**Response when 0 results:**
> No TSLA calls on paste.trade yet. Want to add one?
> Paste a tweet or share your thesis and I'll track it with live PnL.

This turns every gap into a contribution prompt. The more people query and fill gaps, the richer the data gets for everyone.

## Rate limits

60 requests per minute per API key. Max 100 results per call.
