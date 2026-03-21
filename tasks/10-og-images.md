# Task 10: Dynamic OG Image Generation

## Goal
Build dynamic Open Graph images for every page so that when someone shares a paste.rank link on Twitter, it shows a beautiful preview card. This is the growth engine — every share is a mini-billboard.

## Files
- `src/app/api/og/[...slug]/route.tsx`

## Context
Twitter cards are 1200x630px. When someone pastes a paste.rank URL on Twitter, the OG image is what people see in the timeline. It needs to:
1. Look professional (Bloomberg terminal aesthetic)
2. Show data that makes people click
3. Be generated dynamically per page/author

## Tech
Use `@vercel/og` (Satori) which renders JSX to images at the Edge. Already installed in Task 01.

```typescript
import { ImageResponse } from "@vercel/og";
```

## Route: `GET /api/og/[...slug]`

The catch-all slug determines which OG image to generate:

### `/api/og/home` — Homepage OG
```
┌──────────────────────────────────────────────────┐
│                                                  │
│   paste.rank                                     │
│                                                  │
│   Real P&L rankings for                          │
│   Crypto Twitter.                                │
│                                                  │
│   Leaderboard · Head-to-Head · CT Wrapped        │
│                                                  │
│   Powered by paste.trade                         │
│                                                  │
└──────────────────────────────────────────────────┘
```
Dark bg (#0a0a1a), large title, subtitle, feature list.

### `/api/og/leaderboard` — Leaderboard OG
```
┌──────────────────────────────────────────────────┐
│                                                  │
│   CT LEADERBOARD — paste.rank                    │
│                                                  │
│   #1  @frankdegods   73%  +14.2%                 │
│   #2  @nichxbt       68%  +11.8%                 │
│   #3  @CryptoKaleo   61%   +8.3%                │
│   #4  @blknoiz06     58%   +6.1%                │
│   #5  @Pentosh1      54%   +4.7%                │
│                                                  │
│   Who's actually making money on CT?             │
│                                                  │
└──────────────────────────────────────────────────┘
```
Shows top 5 from leaderboard. Fetches from DB at render time.

### `/api/og/author/[handle]` — Author Scorecard OG
```
┌──────────────────────────────────────────────────┐
│                                                  │
│   @frankdegods — Trade Scorecard                 │
│                                                  │
│   Win Rate     73%  ████████░░                   │
│   Avg P&L      +14.2%                            │
│   Total Trades  12                               │
│   Best Call     $HYPE +57.2%                     │
│                                                  │
│   Rank #1 · paste.rank                           │
│                                                  │
└──────────────────────────────────────────────────┘
```
Shows author's key metrics. This is the card people share when linking to a profile.

### `/api/og/vs/[a]/[b]` — Head-to-Head OG
```
┌──────────────────────────────────────────────────┐
│                                                  │
│   @frankdegods  VS  @nichxbt                     │
│                                                  │
│   Win Rate   73%      68%                        │
│   Avg P&L    +14.2%   +11.8%                     │
│   Trades     12       9                          │
│                                                  │
│   @frankdegods wins 3-0                          │
│                                                  │
│   paste.rank                                     │
│                                                  │
└──────────────────────────────────────────────────┘
```
Shows both traders side by side with winner. Maximum drama in the card.

### `/api/og/wrapped/[handle]` — CT Wrapped OG
```
┌──────────────────────────────────────────────────┐
│                                                  │
│   @frankdegods                                   │
│   CT WRAPPED                                     │
│                                                  │
│          THE SNIPER                              │
│   "Picks shots carefully. Rarely misses."        │
│                                                  │
│   Overall: A  |  73% WR  |  12 trades            │
│                                                  │
│   Get yours → paste.rank/wrapped                 │
│                                                  │
└──────────────────────────────────────────────────┘
```
Personality label and description featured prominently. This makes people want to check their own.

### `/api/og/trade` — What's The Trade OG
```
┌──────────────────────────────────────────────────┐
│                                                  │
│   WHAT'S THE TRADE?                              │
│                                                  │
│   Paste any URL. AI finds the trade.             │
│                                                  │
│   Tweets · Articles · Videos · Any thesis        │
│                                                  │
│   paste.rank                                     │
│                                                  │
└──────────────────────────────────────────────────┘
```
Static promo card for the trade finder tool.

## Implementation

### Route handler structure
```typescript
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const [type, ...rest] = params.slug;

  switch (type) {
    case "home":
      return generateHomeOG();
    case "leaderboard":
      return generateLeaderboardOG();
    case "author":
      return generateAuthorOG(rest[0]);
    case "vs":
      return generateVsOG(rest[0], rest[1]);
    case "wrapped":
      return generateWrappedOG(rest[0]);
    case "trade":
      return generateTradeOG();
    default:
      return generateHomeOG();
  }
}
```

### Font loading
Load JetBrains Mono for Satori:
```typescript
const font = await fetch(
  new URL("../../../../public/fonts/JetBrainsMono-Bold.woff2", import.meta.url)
).then((res) => res.arrayBuffer());

// OR fetch from Google Fonts CDN
const fontData = await fetch(
  "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff"
).then((res) => res.arrayBuffer());
```

### Image generation helper
```typescript
function generateImage(element: JSX.Element) {
  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "JetBrains Mono",
        data: fontData,
        weight: 700,
        style: "normal",
      },
    ],
  });
}
```

### Styling in Satori
Satori uses a subset of CSS via inline styles (not Tailwind). Use:
```tsx
<div style={{
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  backgroundColor: "#0a0a1a",
  color: "#f0f0f0",
  fontFamily: "JetBrains Mono",
  padding: "48px 56px",
}}>
  {/* content */}
</div>
```

### Data fetching in OG routes
For dynamic OG images (author, vs, wrapped, leaderboard), you need to fetch data:

**Option A:** Import DB functions directly (works if not using Edge runtime with SQLite)
```typescript
import { getAuthorMetrics } from "@/lib/db";
```

**Option B:** Fetch from own API routes
```typescript
const data = await fetch(`${BASE_URL}/api/author/${handle}`).then(r => r.json());
```

**Option C:** Fetch directly from paste.trade API (simplest for Edge runtime)
```typescript
const trades = await searchPasteTrade({ author: handle });
const metrics = computeMetricsFromTrades(trades);
```

Option C is recommended since Edge runtime can't use better-sqlite3. Import the paste-trade client and metrics functions.

### Win rate bar in Satori
Since Satori supports limited CSS, render the bar as colored divs:
```tsx
<div style={{ display: "flex", gap: "2px" }}>
  {Array.from({ length: 10 }).map((_, i) => (
    <div key={i} style={{
      width: "16px",
      height: "16px",
      backgroundColor: i < Math.round(winRate / 10) ? "#2ecc71" : "#1a1a2e",
    }} />
  ))}
</div>
```

## Caching
Add cache headers so OG images aren't regenerated on every request:
```typescript
export async function GET(request: NextRequest) {
  // ... generate image

  const response = generateImage(element);
  response.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
  return response;
}
```

Cache for 1 hour. Data doesn't change that fast.

## Testing
Visit each OG URL directly in the browser to preview:
- `http://localhost:3000/api/og/home`
- `http://localhost:3000/api/og/leaderboard`
- `http://localhost:3000/api/og/author/frankdegods`
- `http://localhost:3000/api/og/vs/frankdegods/nichxbt`
- `http://localhost:3000/api/og/wrapped/frankdegods`
- `http://localhost:3000/api/og/trade`

## Done when
- All 6 OG image types generate correctly
- Images are 1200x630px
- Dark theme matches the site design
- JetBrains Mono font renders
- Dynamic images show real data (author metrics, leaderboard rankings)
- Win rate bars render visually
- P&L shows correct colors (green/red)
- Cache headers set
- Images look professional when previewed
