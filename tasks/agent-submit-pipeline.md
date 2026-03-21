# Agent Task: Build the Trade Submission Pipeline

## Your working directory
`/workspaces/agent-payments-sdk/paste-dashboard/`

Read `CLAUDE.md` before starting. Follow its design system and conventions exactly.

---

## What to build

A new API route `POST /api/submit` that takes a URL (tweet, article, YouTube), extracts the trade thesis using Claude, and posts it to paste.trade so it gets tracked with live P&L.

This is the core of paste.markets: turning a URL into a tracked trade.

---

## The pipeline (in order)

```
POST /api/submit
Body: { url: string }

Step 1 — Fetch source content
  - If twitter/x.com URL: fetch from fxtwitter API
      GET https://api.fxtwitter.com/status/{tweet_id}
      Extract: text, author_handle, created_at (ISO timestamp), author name
  - If other URL: fetch the page, extract title + text content (first 2000 chars)
  - Detect platform: "x" | "youtube" | "article"

Step 2 — Extract trade via Claude
  - Model: claude-haiku-4-5-20251001
  - Extract ONE primary trade per call (see prompt below)
  - Returns: { ticker, direction, platform, instrument, thesis, headline_quote }

Step 3 — POST /api/sources to paste.trade
  - Creates the source page and gets a source_id
  - Endpoint: https://paste.trade/api/sources
  - Auth: Bearer ${PASTE_TRADE_KEY}
  - Body:
    {
      "url": "<original url>",
      "title": "<page title or tweet text truncated to 100 chars>",
      "platform": "x" | "youtube" | "article",
      "source_date": "<author's ISO timestamp>",
      "author_handle": "<handle without @>",
      "source_images": []
    }
  - Returns: { source_id, source_url, run_id }

Step 4 — GET entry price via /api/skill/assess
  - Locks the price at the moment the author posted
  - Endpoint: https://paste.trade/api/skill/assess
  - Auth: Bearer ${PASTE_TRADE_KEY}
  - Method: POST
  - Body:
    {
      "tickers": ["<ticker>"],
      "direction": "<long|short>",
      "capital": 100000,
      "source_date": "<author ISO timestamp>",
      "subject_kind": "asset"
    }
  - Returns: { results: [{ author_price: number }] }
  - If this fails or returns no price: set author_price to null and continue

Step 5 — POST /api/trades to paste.trade
  - Endpoint: https://paste.trade/api/trades
  - Auth: Bearer ${PASTE_TRADE_KEY}
  - Body:
    {
      "ticker": "<ticker>",
      "direction": "<long|short|yes|no>",
      "platform": "<robinhood|hyperliquid|polymarket>",
      "instrument": "<stock|etf|perp|prediction>",
      "thesis": "<thesis string>",
      "headline_quote": "<verbatim quote>",
      "author_handle": "<handle>",
      "author_date": "<ISO timestamp>",
      "author_price": <number | omit if null>,
      "source_id": "<from step 3>",
      "source_url": "<original url>"
    }
  - Returns: { id, source_url, ... }

Step 6 — Return to client
  {
    ok: true,
    source_id: string,
    paste_trade_url: string,  // "https://app.paste.trade/s/{source_id}" — the live P&L page
    markets_url: string,      // "/markets/{source_id}" — our summary page
    ticker: string,
    direction: string,
    thesis: string,
    author_handle: string,
    author_price: number | null
  }
```

---

## Claude extraction prompt

Use `@anthropic-ai/sdk` (already available — check package.json; if missing add it).

System prompt:
```
You are a trading analyst. Given source content, extract the single clearest trade call.

Return ONLY valid JSON, no markdown fences:
{
  "ticker": "NVDA",
  "direction": "long",
  "platform": "robinhood",
  "instrument": "stock",
  "thesis": "One sentence summary of why this trade makes sense",
  "headline_quote": "Most memorable verbatim quote from the source (max 120 chars)"
}

Rules:
- direction: "long" (bullish/buy) or "short" (bearish/sell) or "yes"/"no" for prediction markets
- platform: "robinhood" for stocks/ETFs, "hyperliquid" for crypto perps, "polymarket" for prediction markets
- instrument: "stock", "etf", "perp", or "prediction"
- ticker: exact symbol, no $ prefix (e.g. NVDA not $NVDA)
- If no clear trade exists: return {"error": "no_trade"}
```

User message: the source content text (tweet text, article excerpt, etc.)

---

## Error handling

- Step 1 fails (can't fetch URL): return `{ ok: false, error: "fetch_failed" }`
- Step 2 returns no_trade: return `{ ok: false, error: "no_trade_found" }`
- Step 3 fails (sources): log error, return `{ ok: false, error: "source_failed" }`
- Step 4 fails (assess): continue with `author_price: null` — not fatal
- Step 5 fails (trades): return `{ ok: false, error: "post_failed", details: <api response> }`
- All paste.trade API calls: log full response body on non-2xx

---

## File to create

`src/app/api/submit/route.ts`

```ts
export const dynamic = "force-dynamic"
export async function POST(request: NextRequest) { ... }
```

---

## Environment variables (already in .env)

```
PASTE_TRADE_KEY=<bearer token>
ANTHROPIC_API_KEY=<claude key>
```

paste.trade base URL: `https://paste.trade` (hardcode it)

---

## Do not modify

- `src/app/api/trade/route.ts` — leave it as-is (analysis-only, no posting)
- Any existing routes or lib files
