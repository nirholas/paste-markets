# Task: Rich Source Pages from paste.trade /api/sources/{id}

## Context
paste.trade's `/api/sources/{id}` returns a full source page: the original tweet/post with its metadata, the author profile, AI-extracted theses with route status, and all derived trades. Our source pages should showcase this pipeline.

## What's Already Done
- `src/lib/paste-trade.ts` — `fetchSource()` returns properly typed `SourceResult`
- `src/app/api/source/[id]/route.ts` — Proxies upstream, returns nested data
- `src/app/source/[id]/page.tsx` — Existing source page
- `src/app/markets/[source_id]/page.tsx` — Market source page

## Real API Response Shape (confirmed)
```json
{
  "source": {
    "id": "45808df1-9",
    "url": "https://x.com/Polymarket/status/...",
    "title": "Cargill using AI to extract extra meat off the bone",
    "platform": "x",
    "published_at": "2026-03-21T14:33:33.000Z",
    "created_at": "2026-03-21T14:52:18.229Z",
    "summary": "Cargill deploying AI to extract more meat...",
    "source_summary": "JUST IN: Beef processing giant...",
    "status": "complete",
    "source_theses": [{
      "thesis_id": "b5583636",
      "thesis": "AI-driven yield optimization...",
      "route_status": "routed",
      "who": [{ "ticker": "TSN", "direction": "long" }]
    }],
    "source_images": null,
    "engagement_views": null,
    "engagement_likes": null
  },
  "author": {
    "id": "02c3c77b-6",
    "handle": "Polymarket",
    "avatar_url": "/api/avatars/02c3c77b-6",
    "twitter_url": "https://x.com/Polymarket",
    "platform": "x"
  },
  "trades": [{ full trade objects with thesis, derivation, chain_steps, etc. }]
}
```

## What Needs To Happen
1. **Source header** — Show the original source: title, platform icon, published date, author with avatar and link to their profile page.

2. **Source content** — Display `source_summary` (the original text), `source_images` if available, and engagement metrics (views/likes/retweets) when available.

3. **AI extraction pipeline** — Show `source_theses` as a visual pipeline:
   - Original source -> Extracted thesis -> Route status -> Derived trades
   - Each thesis shows its `route_status` (processing/routed/failed)
   - Each `who` entry links to the trade card

4. **Derived trades** — List all trades from this source using existing trade card components. Each trade has full derivation, chain steps, and live pricing.

5. **Status indicator** — Show source processing status (processing/complete/failed).

## Design
- Bloomberg terminal aesthetic
- Pipeline visualization: horizontal flow from source -> thesis -> trades
- Status badges: "COMPLETE" in green, "PROCESSING" in amber
- Source images displayed in a card if available
