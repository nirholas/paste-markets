# Agent Task: Build the Market Page

## Your working directory
`/workspaces/agent-payments-sdk/paste-dashboard/`

Read `CLAUDE.md` before starting. Follow its design system and conventions exactly.

---

## Context

paste.trade already has a full frontend for individual trade cards at:
`https://app.paste.trade/s/{source_id}`

It shows live P&L with a rolling price ticker, full derivation/reasoning, and trade history.

**Do not replicate this.** Our market page at `/markets/[source_id]` is a discovery/summary page that gives the narrative context and links into paste.trade for the live trade view. Think of it as the editorial layer on top of the data.

---

## What to build

Page at `/markets/[source_id]` — the summary and context layer for a source. Shows what was called and who called it, then sends users to paste.trade for the live P&L.

---

## Data source

```
GET https://paste.trade/api/sources/{source_id}
Authorization: Bearer ${PASTE_TRADE_KEY}
```

Response shape:
```json
{
  "source": {
    "id": "42c23766-8",
    "url": "https://x.com/PauloMacro/status/...",
    "title": "Oil will be to 2026 what Gold was to 2025",
    "platform": "x",
    "published_at": "2025-09-23T13:04:59.000Z",
    "created_at": "2026-03-21T06:40:10.194Z",
    "source_images": ["https://pbs.twimg.com/media/...jpg"],
    "summary": "PauloMacro calls oil the 2026 version of gold...",
    "source_summary": "Oil will be to 2026 what Gold was to 2025",
    "status": "complete"
  },
  "author": {
    "handle": "PauloMacro",
    "name": null,
    "avatar_url": "/api/avatars/7e18d4b8-6",
    "twitter_url": "https://x.com/PauloMacro",
    "platform": "x"
  },
  "trades": [
    {
      "id": "0c728eba-2",
      "thesis": "Oil will outperform in 2026...",
      "ticker": "CL",
      "direction": "long",
      "author_price": 96.812,
      "posted_price": 96.793,
      "author_date": "2025-09-23T13:04:59.000Z",
      "instrument": "perps",
      "platform": "hyperliquid",
      "headline_quote": "Oil will be to 2026 what Gold was to 2025",
      "ticker_context": "CL is the WTI Crude Oil perpetual on Hyperliquid...",
      "horizon": "2026",
      "source_id": "42c23766-8",
      "author_avatar_url": "https://pbs.twimg.com/...",
      "derivation": {
        "explanation": "If oil in 2026 tracks how gold ran in 2025..."
      }
    }
  ]
}
```

`author.avatar_url` is relative — prefix with `https://paste.trade` to make it absolute.

The live P&L page for this source is: `https://app.paste.trade/s/{source_id}`

---

## Page layout: `src/app/markets/[source_id]/page.tsx`

Server component. Fetch data server-side.

```
[Nav]

[Source header]
  [platform badge]                          [View on paste.trade ↗] button
  Title — large and prominent
  @handle · formatted date                  [avatar — 32px circle]
  summary paragraph (source.summary)
  [source image if exists — max-h-56, object-cover, rounded-lg]

[Trade summary cards — one per trade]
  Compact. Links to app.paste.trade for live P&L.

[Author section]
  "More from @{handle}" → links to /{handle} profile page

[Back links]
  ← Leaderboard
```

---

## Trade summary card

Compact summary only — NOT a full trade card (paste.trade has that). The main action is linking to paste.trade.

```
┌──────────────────────────────────────────────────────────┐
│  CL  [LONG]  hyperliquid · perps         Horizon: 2026   │
│                                                          │
│  "Oil will be to 2026 what Gold was to 2025"             │
│                                                          │
│  Oil will outperform in 2026 the way gold outperformed   │
│  in 2025 — a major commodity bull run for crude is       │
│  coming.                                                 │
│                                                          │
│  Entry locked: $96.81                                    │
│                                                          │
│  [View Live P&L on paste.trade ↗]                        │
└──────────────────────────────────────────────────────────┘
```

- "View Live P&L on paste.trade ↗" links to `https://app.paste.trade/s/{source_id}` — this is the key CTA
- LONG badge: `text-[#2ecc71] border border-[#2ecc71]`
- SHORT badge: `text-[#e74c3c] border border-[#e74c3c]`
- `headline_quote`: italic, `text-[#c8c8d0]`
- Thesis: `text-[#c8c8d0] text-sm line-clamp-3`
- Entry price: `text-[#555568] text-xs`
- Card: `bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 mb-4`
- Do NOT show a P&L number — we don't have live price data, and paste.trade shows it better

---

## API route: `src/app/api/markets/[source_id]/route.ts`

Thin proxy:

```ts
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  const { source_id } = await params
  const res = await fetch(`https://paste.trade/api/sources/${source_id}`, {
    headers: { Authorization: `Bearer ${process.env.PASTE_TRADE_KEY}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
```

---

## OG metadata

```ts
export async function generateMetadata({ params }) {
  const title = source.title ?? "Trade on paste.markets"
  const description = `${trades.length} trade${trades.length !== 1 ? "s" : ""} · @${author.handle} on paste.markets`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: source.source_images?.[0] ? [source.source_images[0]] : [],
    },
  }
}
```

---

## Error states

- 404 from API: "Market not found" + link to leaderboard
- No trades: "No trades extracted yet" + link to paste.trade source

---

## Files to create

- `src/app/markets/[source_id]/page.tsx`
- `src/app/api/markets/[source_id]/route.ts`

---

## Design rules (from CLAUDE.md)

- Background: `#0a0a1a`, Cards: `#0f0f22`, Borders: `#1a1a2e`
- Win green: `#2ecc71`, Loss red: `#e74c3c`, Accent: `#3b82f6`
- Font: JetBrains Mono
- No emoji
- External links (paste.trade) open in new tab with `target="_blank" rel="noopener noreferrer"`
