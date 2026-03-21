# Agent Task: Build the Home Feed

## Your working directory
`/workspaces/agent-payments-sdk/paste-dashboard/`

Read `CLAUDE.md` before starting. Follow its design system and conventions exactly.

---

## What to build

Replace the current home page (`src/app/page.tsx`) with a live feed of recent trades from paste.trade. This is the first thing visitors see — it should show what's being tracked right now.

---

## Data source

```
GET https://paste.trade/api/trades?limit=20
Authorization: Bearer ${PASTE_TRADE_KEY}
```

Response:
```json
{
  "items": [
    {
      "id": "0c728eba-2",
      "thesis": "Oil will outperform in 2026...",
      "ticker": "CL",
      "direction": "long",
      "author_price": 96.812,
      "posted_price": 96.793,
      "author_handle": "PauloMacro",
      "source_url": "https://x.com/PauloMacro/status/...",
      "author_date": "2025-09-23T13:04:59.000Z",
      "created_at": "2026-03-21T06:42:12.081Z",
      "instrument": "perps",
      "platform": "hyperliquid",
      "headline_quote": "Oil will be to 2026 what Gold was to 2025",
      "source_id": "42c23766-8",
      "author_avatar_url": "https://pbs.twimg.com/...",
      "card_headline": "..."
    }
  ],
  "next_cursor": "2026-03-21T06:38:23.129Z|ef304d63-6",
  "total": 845
}
```

For pagination: `GET /api/trades?limit=20&cursor={next_cursor}`

---

## Page layout: `src/app/page.tsx`

This is a **server component**. Fetch first 20 trades server-side.

```
[Nav]

[Hero — above the feed]
  H1: "paste.markets"
  Subtitle: "Real trades. Real P&L. No noise."
  Two CTAs side by side:
    [Track a Trade →]  → /submit
    [View Leaderboard] → /leaderboard

[Stats bar — single row of numbers]
  "845 trades tracked  ·  39 callers  ·  live P&L"
  Pull total from API response. Hardcode caller count for now (or fetch leaderboard count).

[Feed section]
  H2: "Latest Trades"  (left-aligned, small caps, muted)

  [Trade card × 20]     ← see card spec below

[Load more — client component]
  "Load more" button — fetches next page via /api/feed?cursor=...

[Footer]
  "Powered by paste.trade · Built on Claude"
```

---

## Trade card (feed item)

Compact — not full detail. Click goes to `/markets/[source_id]`.

```
┌──────────────────────────────────────────────────────┐
│ @PauloMacro          hyperliquid · perps    2h ago    │
│                                                       │
│ CL  [LONG]                          Entry: $96.81     │
│                                                       │
│ "Oil will be to 2026 what Gold was to 2025"           │
│                                                       │
│ Oil will outperform in 2026 the way gold outperformed │
│ in 2025 — a major commodity bull run for crude...     │
│                                                [→]    │
└──────────────────────────────────────────────────────┘
```

- Card links to `/markets/{source_id}` (entire card is clickable)
- `@handle` links to `/{author_handle}`
- Timestamp: relative ("2h ago", "3d ago") computed from `created_at`
- `[LONG]` badge: green border + green text. `[SHORT]`: red.
- Thesis: truncated to 2 lines with CSS `line-clamp-2`
- `headline_quote`: italic, quoted, 1 line
- Card: `bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4 mb-3 cursor-pointer hover:border-[#3b82f6] transition-colors`
- No P&L shown on feed cards (not enough data without current price)

---

## API route for pagination: `src/app/api/feed/route.ts`

```ts
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined
  const limit = 20
  const url = new URL("https://paste.trade/api/trades")
  url.searchParams.set("limit", String(limit))
  if (cursor) url.searchParams.set("cursor", cursor)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.PASTE_TRADE_KEY}` },
  })
  const data = await res.json()
  return NextResponse.json(data)
}
```

---

## Load more button: `src/components/feed-loader.tsx`

Client component. Receives initial `next_cursor` and `initial_items` as props.
- On click: fetches `/api/feed?cursor={cursor}`
- Appends new items to displayed list
- Hides button when no more cursor
- Shows "Loading..." during fetch

---

## Files to create/modify

- **Modify**: `src/app/page.tsx` — rebuild as home feed (server component)
- **Create**: `src/app/api/feed/route.ts` — pagination proxy
- **Create**: `src/components/feed-loader.tsx` — client component for load more
- **Create**: `src/components/trade-feed-card.tsx` — the compact feed card

## Do not modify

- Any other pages or routes
- `src/components/ui/nav.tsx` (another agent is modifying this)

---

## Design rules (from CLAUDE.md)

- Background: `#0a0a1a`, Cards: `#0f0f22`, Borders: `#1a1a2e`
- Win green: `#2ecc71`, Loss red: `#e74c3c`, Accent blue: `#3b82f6`
- Font: JetBrains Mono
- H1: 28px weight 700. H2: 20px weight 700.
- Body text: 14px `#c8c8d0`
- Muted/labels: `#555568`
- No emoji
