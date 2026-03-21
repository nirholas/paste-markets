# Task: Public API v2 with Developer Portal

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard has an existing v1 API (see `src/app/api/v1/`) with basic leaderboard, callers, and trades endpoints. There is also an existing developer page at `/developer` and API key management in `src/lib/api-auth.ts`.

Community request from @SenzuGod: "Can you make an API endpoint?"

From @feikuu: "scrape CT for alpha + clude remembers/learns who is alpha/tastemaker = profit" — external developers need programmatic access to build on top of paste.markets data.

From @0xk3rmit: "I'm a fellow coder, been working on a terminal... did some x tool analysis i have millions of tweets fully indexed" — builders want to integrate.

This task creates a proper v2 API with better documentation, more endpoints, WebSocket support, and a developer portal.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. v2 API Endpoints — `src/app/api/v2/`

**Callers:**
```
GET /api/v2/callers                    — paginated caller list
GET /api/v2/callers/[handle]           — full caller profile
GET /api/v2/callers/[handle]/trades    — caller's trade history
GET /api/v2/callers/[handle]/stats     — aggregated stats
GET /api/v2/callers/search             — search callers by name/handle
```

**Trades:**
```
GET /api/v2/trades                     — paginated trade list
GET /api/v2/trades/[id]                — single trade detail
GET /api/v2/trades/live                — currently open trades
GET /api/v2/trades/top                 — top trades by PnL
GET /api/v2/trades/recent              — most recent trades
```

**Assets:**
```
GET /api/v2/assets                     — all tracked assets
GET /api/v2/assets/[ticker]            — asset detail + trades
GET /api/v2/assets/[ticker]/callers    — who's calling this asset
GET /api/v2/assets/trending            — most-called assets (7d)
```

**Leaderboard:**
```
GET /api/v2/leaderboard                — ranked callers
GET /api/v2/leaderboard/predictions    — prediction market leaderboard
GET /api/v2/leaderboard/sports         — sports betting leaderboard
```

**Markets:**
```
GET /api/v2/markets                    — event markets
GET /api/v2/markets/[id]               — market detail + consensus
```

**Discovery:**
```
GET /api/v2/discover                   — newly discovered callers
GET /api/v2/signals                    — recent high-confidence signals
```

### 2. Consistent Response Format

All v2 endpoints return:
```ts
{
  data: T,                          // the actual payload
  meta: {
    page: number,
    pageSize: number,
    total: number,
    hasMore: boolean
  },
  timestamp: string                 // ISO 8601
}
```

Error responses:
```ts
{
  error: {
    code: string,                   // "NOT_FOUND" | "RATE_LIMITED" | "INVALID_KEY"
    message: string,
    details?: Record<string, any>
  },
  timestamp: string
}
```

### 3. API Key Tiers

```ts
type ApiKeyTier = "free" | "builder" | "pro"

// free: 100 requests/hour, basic endpoints only
// builder: 1000 requests/hour, all endpoints, webhooks
// pro: 10000 requests/hour, all endpoints, WebSocket, priority support
```

Rate limiting per tier — return headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1711036800
```

### 4. API Key Management

Enhance existing API key system:

```sql
-- Extend api_keys table
ALTER TABLE api_keys ADD COLUMN tier TEXT DEFAULT 'free';
ALTER TABLE api_keys ADD COLUMN requests_today INTEGER DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN last_request_at TEXT;
ALTER TABLE api_keys ADD COLUMN webhook_url TEXT;
ALTER TABLE api_keys ADD COLUMN description TEXT;
```

**API key endpoints:**
```
POST /api/v2/keys                      — generate new API key
GET  /api/v2/keys/[key]/usage          — view usage stats
POST /api/v2/keys/[key]/rotate         — rotate key
```

### 5. WebSocket API — `src/app/api/v2/ws/route.ts`

For `builder` and `pro` tier keys, provide a WebSocket endpoint:

```
ws://paste.markets/api/v2/ws?key=xxx

// Subscribe to channels:
{ "action": "subscribe", "channel": "trades" }
{ "action": "subscribe", "channel": "caller:frankdegods" }
{ "action": "subscribe", "channel": "asset:BTC" }
{ "action": "subscribe", "channel": "signals" }

// Receive events:
{ "channel": "trades", "event": "new_trade", "data": { ... } }
{ "channel": "caller:frankdegods", "event": "new_call", "data": { ... } }
{ "channel": "signals", "event": "signal", "data": { ... } }
```

### 6. Developer Portal — Enhanced `/developer` page

Redesign the developer page as a proper API portal:

**Sections:**

**Getting Started:**
```
━━━ PASTE.MARKETS API ━━━

Base URL: https://paste.markets/api/v2
Auth: Bearer token in Authorization header

1. Generate an API key below
2. Add header: Authorization: Bearer YOUR_KEY
3. Start making requests
```

**API Key Management:**
```
┌──────────────────────────────────────────────┐
│ Your API Key                                 │
│ ┌────────────────────────────────────────┐   │
│ │ pm_live_a1b2c3d4e5f6...    [Copy] [↻] │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ Tier: Free (100 req/hr)                      │
│ Usage today: 47 / 100                        │
│ [Upgrade to Builder →]                       │
└──────────────────────────────────────────────┘
```

**Interactive API Explorer:**

For each endpoint, show:
- Method + path
- Description
- Query parameters with types
- Example request (curl)
- Example response (formatted JSON)
- "Try it" button that makes a live request

```
┌──────────────────────────────────────────────┐
│ GET /api/v2/callers/[handle]                 │
│                                              │
│ Get full profile data for a caller.          │
│                                              │
│ Path params:                                 │
│   handle (string) — Twitter handle           │
│                                              │
│ Query params:                                │
│   include_trades (bool) — include recent     │
│   trades (default: false)                    │
│                                              │
│ curl -H "Authorization: Bearer YOUR_KEY" \   │
│   https://paste.markets/api/v2/callers/frank │
│                                              │
│ Response:                                    │
│ {                                            │
│   "data": {                                  │
│     "handle": "frankdegods",                 │
│     "displayName": "Frank",                  │
│     "winRate": 0.68,                         │
│     "totalCalls": 47,                        │
│     ...                                      │
│   },                                         │
│   "meta": { ... },                           │
│   "timestamp": "2026-03-21T..."              │
│ }                                            │
│                                              │
│ [Try It →]                                   │
└──────────────────────────────────────────────┘
```

**Code Examples tab:**
Show integration examples in:
- JavaScript/TypeScript (fetch)
- Python (requests)
- curl

```ts
// JavaScript
const res = await fetch('https://paste.markets/api/v2/callers/frankdegods', {
  headers: { 'Authorization': 'Bearer YOUR_KEY' }
})
const { data } = await res.json()
console.log(`${data.handle}: ${data.winRate}% win rate`)
```

### 7. Webhook Support (builder+ tier)

Let developers register webhooks for events:

```
POST /api/v2/webhooks                  — register webhook
GET  /api/v2/webhooks                  — list webhooks
DELETE /api/v2/webhooks/[id]           — remove webhook

// Webhook payload sent to developer's URL:
{
  event: "new_trade" | "trade_settled" | "new_caller" | "signal",
  data: { ... },
  timestamp: string,
  signature: string     // HMAC-SHA256 for verification
}
```

---

## Files to Read First
- `paste-dashboard/src/app/api/v1/` — existing v1 API structure
- `paste-dashboard/src/lib/api-auth.ts` — API key validation
- `paste-dashboard/src/app/developer/page.tsx` — existing developer page
- `paste-dashboard/src/lib/v1-response.ts` — v1 response formatting
- `paste-dashboard/src/lib/db.ts` — SQLite schema

## Deliverable
1. Full v2 API with all endpoints listed above
2. Consistent response format with pagination
3. Tiered API keys with rate limiting
4. API key management endpoints
5. WebSocket endpoint for real-time subscriptions
6. Redesigned `/developer` page with interactive explorer
7. Code examples in JS, Python, curl
8. Webhook registration and dispatch
9. Rate limit headers on all responses
10. v1 endpoints continue working (backwards compatible)
