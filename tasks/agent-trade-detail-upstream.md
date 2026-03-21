# Task: Rich Trade Detail Pages from paste.trade /api/trades/{id}

## Context
paste.trade's `/api/trades/{id}` returns incredibly rich trade data: full thesis, derivation with cited source segments, chain steps with links, ticker context, live price, and Polymarket fields. Our trade detail page should showcase all of this.

## What's Already Done
- `src/lib/paste-trade.ts` — `getTradeById()` fetches from `/api/trades/{id}` with fallbacks
- `src/app/api/trade/[id]/route.ts` — Proxies to upstream
- `src/app/trade/[id]/page.tsx` — Existing trade detail page (may need enrichment)

## Real API Response Shape (confirmed)
```json
{
  "id": "ca462c0f-e",
  "thesis": "AI-driven yield optimization in beef processing...",
  "ticker": "TSN",
  "direction": "long",
  "author_price": 58.18,
  "posted_price": 58.18,
  "author_handle": "Polymarket",
  "source_url": "https://x.com/Polymarket/status/...",
  "author_date": "2026-03-21T14:33:33.000Z",
  "trade_type": "derived",
  "instrument": "shares",
  "platform": "robinhood",
  "headline_quote": "Cargill is reportedly using AI to extract...",
  "ticker_context": "Tyson Foods (TSN) is the largest publicly traded...",
  "derivation": {
    "explanation": "Cargill proved AI vision systems...",
    "segments": [{
      "quote": "Beef processing giant...",
      "speaker": "Polymarket",
      "speaker_handle": "Polymarket"
    }],
    "steps": [{
      "text": "Cargill AI yields ~1% more... [1](https://bloomberg.com/...)",
      "segment": 0
    }]
  },
  "chain_steps_card": ["step1", "step2", "step3"],
  "logo_url": "https://api.elbstream.com/logos/symbol/TSN",
  "price": { "price": 58.18, "timestamp": 1774106414265 },
  "market_question": null,
  "condition_id": null,
  "market_slug": null
}
```

## What Needs To Happen
1. **Derivation display** — Render `derivation.segments` as quoted source material, `derivation.steps` as a numbered chain of reasoning with clickable citation links. This is the crown jewel of paste.trade's data.

2. **Thesis card** — Show the full `thesis` in a prominent card, with `headline_quote` as the pull quote.

3. **Ticker context** — Display `ticker_context` as an info section explaining what the asset is.

4. **Live price** — Use the `price` object for real-time P&L calculation. Set up polling via `/api/prices` for updates.

5. **Source attribution** — Link to `source_url`, show `author_handle` with avatar, and `author_date`.

6. **Polymarket fields** — For prediction market trades, show `market_question`, `condition_id`, `market_slug`, `outcome`.

7. **OG image** — Use `getShareImageUrl(tradeId)` from paste-trade.ts for Twitter card metadata.

## Design
- Bloomberg terminal dark theme
- Derivation steps as a vertical timeline/chain
- Source segments in blockquote style with speaker attribution
- Green/red P&L with large numbers
