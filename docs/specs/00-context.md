# paste.trade — Codebase Context Reference

Use this file as the shared context block to paste at the top of any feature prompt when starting a new chat.

---

## Repo
https://github.com/rohunvora/paste-trade

## What it is
paste.trade is an AI-powered platform that extracts trade theses from any source (tweets, YouTube videos, articles, PDFs) and routes them to the best execution venue (Hyperliquid perps, Robinhood shares, or Polymarket contracts). It records the price at the time the original content was published AND at the time it was pasted, then tracks PnL from both reference points forward.

## Actual Tech Stack
- **Runtime**: Bun
- **Backend**: Cloudflare Workers (serverless)
- **Storage**: JSONL files (local/edge), relational DB columns + JSON blobs on the backend API
- **Frontend**: Browser-based source page viewer with live WebSocket streaming
- **AI**: Claude (via OpenClaw / Claude Code skill system)
- **Key external APIs**: X/Twitter v2, Hyperliquid DEX, Polymarket, Yahoo Finance/Robinhood, Gemini (optional, speaker attribution), fxtwitter/vxtwitter (fallback tweet fetch)

## Key Directories
```
/scripts/          Core pipeline scripts (Bun, TypeScript)
  extract.ts       URL → text + metadata (Twitter, YouTube, article, PDF)
  route.ts         Ticker validation + platform selection
  discover.ts      Instrument catalog search (HL + Polymarket)
  post.ts          Publish trade to backend
  save.ts          Persist thesis to JSONL
  diarize.ts       Speaker attribution (Gemini)
  create-source.ts Initialize live source page + WebSocket
  finalize-source.ts Mark source complete

/adapters/
  hyperliquid/     HL perp universe, instruments, API client
  route-fields.ts  Route evidence coercion

/shared/
  pnl.ts           Dual-lens P&L calculation (author vs platform)
  trade-pricing.ts Price normalization

/types.ts          Core types: ParsedThesis, TradeExpression, InstrumentMatch, TrackedTrade
/references/       Docs: routing strategy, search API, events, DB schema
/openclaw-plugin/  /trade slash command registration
```

## Data Model (key fields)
```ts
// Stored per trade (relational columns):
ticker, source_date, author_handle, direction ("long"|"short")
instrument, platform ("hyperliquid"|"robinhood"|"polymarket")
created_at, user_id, run_id, source_id, thesis_id
created_at_price, publish_price

// JSON blob (trade_data):
ticker_context, derivation, price_ladder
author_price, created_at_price, current_price
since_published_move_pct
hl_ticker (base_symbol, full_symbol, funding_rate, open_interest)
market_implied_prob (Polymarket only)
```

## Existing API endpoints (backend)
- `GET /api/search` — trades by ticker/author/full-text/top performers/platform
- `GET /api/og/share/{trade_id}` — OG share card PNG
- `POST /api/skill/route` — route ticker to venue
- `POST /api/skill/discover` — instrument catalog
- `POST /api/skill/post` — publish trade
- `POST /api/skill/save` — save thesis

## Live pages
- `https://paste.trade/sources/{source_id}` — live extraction dashboard
- `https://paste.trade/s/{trade_id}` — individual trade card

## P&L tracking (two lenses)
- **Author lens**: `(current - author_price) / author_price × 100%` — was the caller right?
- **Platform lens**: `(current - publish_price) / publish_price × 100%` — could traders profit since posting?
- Shorts: inverted math
- Polymarket: YES/NO tokens, 0-1 probability scaling

## Event system (WebSocket)
status, extraction_complete, source_updated, thesis_found, thesis_routed, thesis_dropped, trade_posted, done, failed
