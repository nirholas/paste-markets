# Feature: Public Developer API

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun, Cloudflare Workers. The existing internal search API is `GET /api/search` (60 req/min rate limit, supports ticker/author/direction/platform filtering, top_performers mode). Trade cards: `paste.trade/s/{trade_id}`. OG images: `/api/og/share/{trade_id}`.

Community request (@SenzuGod): "Can you make an api endpoint?" Multiple developers want to build on top of paste.trade data.

---

## What to Build

A documented public API that lets developers query paste.trade data, with API key auth, rate limiting, and proper docs.

### Endpoints to expose:

**Trades:**
```
GET /v1/trades                     — list/search trades
GET /v1/trades/[id]                — single trade by ID
GET /v1/trades/top                 — top performing trades (all time or by timeframe)
```

**Callers:**
```
GET /v1/callers                    — list callers (sorted/filtered)
GET /v1/callers/[handle]           — caller profile + stats
GET /v1/callers/[handle]/trades    — all trades by a caller
```

**Assets:**
```
GET /v1/assets                     — all tracked tickers
GET /v1/assets/[ticker]            — stats + calls for a ticker
```

**Leaderboard:**
```
GET /v1/leaderboard                — ranked callers (wraps leaderboard feature)
```

### `/v1/trades` query params:
```
ticker=BTC               filter by ticker
author=zacxbt            filter by author handle
direction=long|short     filter by direction
platform=hyperliquid|robinhood|polymarket
timeframe=today|week|month|alltime
sort=pnl|date|confidence  default: date
order=asc|desc
limit=10                 max 100
offset=0                 pagination
min_pnl=-100             minimum PnL % (e.g. only winners: 0)
integrity=live|same_day|historical|retroactive
```

**Response envelope (all endpoints):**
```ts
{
  ok: true,
  data: T,              // the actual payload
  meta: {
    total: number,
    limit: number,
    offset: number,
    page: number
  },
  requestId: string     // for debugging
}

// Error response:
{
  ok: false,
  error: {
    code: string,       // e.g. "RATE_LIMITED", "NOT_FOUND", "INVALID_PARAM"
    message: string
  },
  requestId: string
}
```

**Single trade shape (`/v1/trades/[id]`):**
```ts
{
  id: string,
  ticker: string,
  direction: "long" | "short",
  platform: "hyperliquid" | "robinhood" | "polymarket",
  author: {
    handle: string,
    displayName: string,
    avatarUrl: string,
    verified: boolean
  },
  sourceDate: string,           // when the tweet/article was published
  publishedAt: string,          // when submitted to paste.trade
  prices: {
    atSource: number,           // price when tweet was published
    atPublish: number,          // price when submitted to paste.trade
    current: number,            // current price
    pnlFromSource: number,      // % from author's perspective
    pnlFromPublish: number      // % from platform entry perspective
  },
  derivation: {
    steps: string[],            // 3-step explanation (≤70 chars each)
    thesis: string,             // 1-sentence thesis
    quote: string               // headline quote from source
  },
  source: {
    url: string,                // original tweet/video/article URL
    type: "twitter" | "youtube" | "article" | "pdf",
    title: string | null
  },
  integrity: "live" | "same_day" | "historical" | "retroactive",
  cardUrl: string,              // https://paste.trade/s/{id}
  shareImageUrl: string         // https://paste.trade/api/og/share/{id}
}
```

### Authentication:

**API Key model:**
- Free tier: 100 requests/day, limited to read-only, no bulk endpoints
- Developer tier: 10,000 requests/day (apply via Discord)
- Keys are passed via `Authorization: Bearer pt_xxxx` header or `?api_key=pt_xxxx`

**Key generation:**
- `POST /v1/keys` (authenticated via Twitter OAuth) — generates a key tied to a Twitter account
- Keys stored in Cloudflare KV: `api_key:{key}` → `{ handle, tier, createdAt, requestCount }`

**Rate limiting:**
- Uses Cloudflare's built-in rate limiting
- Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- 429 response when exceeded with `Retry-After` header

### Docs page: `/api`

A clean, self-hosted API docs page (can use Redoc, Scalar, or hand-rolled):
- Endpoint reference with request/response examples
- Authentication section
- Code examples in JavaScript, Python, curl
- "Try it" functionality (interactive)
- Rate limit explanation

Example code snippet shown in docs:
```js
// Get top BTC callers this week
const res = await fetch('https://paste.trade/v1/callers?asset=BTC&sort=winrate&timeframe=week', {
  headers: { 'Authorization': 'Bearer pt_your_key_here' }
})
const { data } = await res.json()
console.log(data[0].handle, data[0].winRate) // "zacxbt" 71
```

### Webhooks (stretch goal):
- `POST /v1/webhooks` — register a URL to receive events
- Events: `trade.posted`, `trade.updated` (price check), `caller.new_call`
- Useful for bots that want real-time alerts when specific callers post

### Files to read first:
- `/references/search-api.md` — existing search API to wrap + extend
- `/references/index/trade-index.md` — DB schema for correct field names
- `/types.ts` — type definitions to align response shapes
- Any existing Cloudflare Worker route definitions

## Deliverable:
1. `/v1/trades`, `/v1/callers`, `/v1/assets`, `/v1/leaderboard` endpoints with consistent response envelope
2. API key generation + auth middleware
3. Rate limiting via Cloudflare
4. `/api` docs page (at minimum: hand-rolled markdown rendered, ideally interactive)
5. Consistent error handling with typed error codes
6. `X-RateLimit-*` headers on all responses
