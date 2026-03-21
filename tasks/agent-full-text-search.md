# Task: Full-Text Thesis Search via paste.trade /api/search?q=

## Context
paste.trade's `/api/search?q=` supports full-text search across all trade theses. We're barely using this — our search route does caller/ticker matching but doesn't surface thesis-level search results prominently.

## What's Already Done
- `src/lib/paste-trade.ts` — `searchPasteTradeAdvanced()` supports `q` param
- `src/app/api/search/route.ts` — Already calls advanced search with `q` param
- Search UI exists in `src/components/search-bar.tsx` and `src/components/smart-input.tsx`

## Real API Response Shape (confirmed)
```json
{
  "trades": [{
    "trade_id": "aaed3b2a-8",
    "thesis": "If the market starts to price Bitcoin's weak long-run security budget...",
    "ticker": "BTC",
    "direction": "short",
    "platform": "hyperliquid",
    "instrument": "perps",
    "author_handle": "UrbanChirpyAnt",
    "headline_quote": "how do I position for the bitcoin security budget issue?",
    "ticker_context": "BTC perpetual is the direct trade on Bitcoin itself...",
    "chain_steps": ["step1", "step2", "step3"],
    "explanation": "If the security budget issue ever becomes...",
    "pnl_pct": null,
    "current_price": null
  }]
}
```

## What Needs To Happen
1. **Thesis search tab** — Add a "Theses" tab to the search results that shows full thesis cards from the `q=` search. Each result shows:
   - Thesis text (highlighted search term matches)
   - Author handle + avatar
   - Ticker + direction badge
   - Platform icon
   - Chain steps preview
   - P&L if available

2. **Search filters** — Wire up the direction and platform filters in the search UI to pass through to the API (`direction=long|short`, `platform=hyperliquid|robinhood|polymarket`).

3. **Pagination** — Use the `cursor` param for infinite scroll through search results.

4. **Smart input enhancement** — When typing in the smart input, show thesis previews from the `q=` endpoint as suggestions (debounced, 300ms).

## Design
- Thesis cards: bg-[#0f0f22] with thesis text in primary color, chain steps as bullet points
- Search term highlighting: accent blue (#3b82f6) background on matched text
- Filter pills: border border-[#1a1a2e] hover:border-[#3b82f6]
