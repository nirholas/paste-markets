# Agent Task: Trade Submission API

## Context

You are building inside `/workspaces/agent-payments-sdk/paste-dashboard/` — a Next.js 15 App Router project.

Read `CLAUDE.md` in that directory before starting. Follow its design system and conventions exactly.

The existing `src/app/api/trade/route.ts` uses Claude to extract trade ideas from a URL but is a dead end — it shows trades but never posts them anywhere. Your job is to build the real submission pipeline that actually POSTs trades to paste.trade so they get tracked with live P&L.

## What to Build

A new API route: `POST /api/submit`

This route takes a tweet/article URL, extracts the trade, looks up the historical price at the time the author posted, and submits it to paste.trade so it appears on the leaderboard with live P&L tracking.

## Step-by-Step Pipeline

```
POST /api/submit { url: "https://x.com/someone/status/123" }

1. Detect source type (tweet / article / text)
2. For tweets: fetch content via fxtwitter API (api.fxtwitter.com)
   - Get: tweet text, author_handle, author timestamp (created_at)
3. Call Claude (claude-haiku-4-5-20251001) to extract:
   - ticker (e.g. "NVDA", "SOL", "BTC")
   - direction ("long" | "short" | "yes" | "no")
   - platform ("robinhood" | "hyperliquid" | "polymarket")
   - thesis (the core investment thesis, 1-2 sentences)
   - headline_quote (the most memorable quote from the source, verbatim)
4. POST to paste.trade /api/skill/assess to get author_price:
   - Endpoint: ${PASTE_TRADE_URL}/api/skill/assess
   - Body: { ticker, direction, platform, author_date: <tweet timestamp ISO> }
   - Auth: Bearer ${PASTE_TRADE_KEY}
   - Returns: { author_price: number } — price at the moment the author posted
5. POST to paste.trade /api/sources to register the source:
   - Endpoint: ${PASTE_TRADE_URL}/api/sources
   - Body: { url, title, platform: "x", source_date: <tweet timestamp>, author_handle }
   - Returns: { source_id, source_url }
6. POST to paste.trade /api/trades to submit the trade:
   - Endpoint: ${PASTE_TRADE_URL}/api/trades
   - Body: {
       ticker, direction, platform, instrument: "stock"|"perp"|"prediction",
       thesis, headline_quote,
       author_handle, author_date, author_price,
       source_url: <original tweet url>,
       source_id: <from step 5>
     }
   - Returns: { trade_id, trade_url }
7. Return to client: { ok: true, trade_url, author_handle, ticker, direction, author_price, thesis }
```

## Error Handling

- If assess endpoint fails → use current market price as fallback (fetch from a free price API or skip author_price)
- If source creation fails → still attempt trade post without source_id
- If trade post fails → return { ok: false, error, trades } so client can show what was extracted even if not posted

## Environment Variables

All already defined in `.env`:
- `PASTE_TRADE_KEY` — Bearer token for paste.trade API
- `PASTE_TRADE_URL` — defaults to `https://paste.trade` if not set
- `ANTHROPIC_API_KEY` — for Claude extraction

## Files to Create

- `src/app/api/submit/route.ts` — the main route

## Claude Prompt for Extraction

Use this system prompt for the extraction step:

```
You are a trading analyst. Given tweet or article content, extract ONE primary trade.

Return JSON only, no markdown:
{
  "ticker": "NVDA",
  "direction": "long",
  "platform": "robinhood",
  "instrument": "stock",
  "thesis": "NVDA is undervalued after the selloff given AI capex acceleration",
  "headline_quote": "exact memorable quote from the source verbatim"
}

direction must be: long, short, yes, or no
platform must be: robinhood (stocks/ETFs), hyperliquid (crypto perps), polymarket (prediction markets)
instrument must be: stock, etf, perp, prediction
ticker must be the exact symbol (no $ prefix)
If no clear trade exists, return { "error": "no_trade" }
```

## Important Notes

- `author_date` must be ISO 8601 format
- `author_handle` from fxtwitter is the handle without @
- The assess endpoint may return 404 for some tickers — handle gracefully
- Do not retry failed API calls more than once
- Log all paste.trade API responses to console for debugging
- The route must be `export const dynamic = "force-dynamic"`
