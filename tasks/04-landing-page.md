# Task 04: Landing Page + Search

## Goal
Build the homepage that introduces paste.rank, lets users search for any CT handle, and shows trending/featured content. This is the first thing people see — it needs to look sharp and communicate the value instantly.

## Context
This is a dark-themed Bloomberg-terminal-aesthetic website. Read `CLAUDE.md` for the full design system (colors, fonts, spacing). The page should feel like a premium data terminal, not a generic SaaS landing page.

## File
`src/app/page.tsx` (replace the placeholder)

## Design

### Hero section
```
┌──────────────────────────────────────────────────┐
│                                                  │
│   paste.rank                                     │
│   Real P&L rankings for Crypto Twitter.          │
│                                                  │
│   ┌──────────────────────────────────────┐       │
│   │  @ Search any CT handle...           │       │
│   └──────────────────────────────────────┘       │
│                                                  │
│   Powered by paste.trade                         │
│                                                  │
└──────────────────────────────────────────────────┘
```

- Title: "paste.rank" — large, bold, JetBrains Mono
- Subtitle: "Real P&L rankings for Crypto Twitter." — muted text
- Search bar: large, prominent, with @ prefix. On submit → navigates to `/[handle]`
- Powered by: small muted text linking to paste.trade

### Quick nav cards
Below the hero, 4 feature cards in a grid:

```
┌─────────────────┐  ┌─────────────────┐
│  LEADERBOARD     │  │  HEAD-TO-HEAD    │
│  Who's actually  │  │  1v1 any two     │
│  the best?       │  │  traders.        │
│  →               │  │  →               │
└─────────────────┘  └─────────────────┘
┌─────────────────┐  ┌─────────────────┐
│  CT WRAPPED      │  │  WHAT'S THE     │
│  Your trading    │  │  TRADE?          │
│  report card.    │  │  Paste any URL.  │
│  →               │  │  →               │
└─────────────────┘  └─────────────────┘
```

Each card links to its respective page. Use the card component from `src/components/ui/card.tsx`.

### Trending section
Show top 5 most-searched handles with their win rate:

```
TRENDING
─────────────────────────────
1. @frankdegods    73% WR   +14.2% avg
2. @nichxbt        68% WR   +11.8% avg
3. @CryptoKaleo    61% WR   +8.3% avg
4. @blknoiz06      58% WR   +6.1% avg
5. @Pentosh1       54% WR   +4.7% avg
```

Fetch from `/api/trending`. Each row links to the author profile.

### Top of leaderboard preview
Show the top 3 ranked traders as a teaser, with a "View Full Leaderboard →" link.

```
THIS WEEK'S TOP CALLERS
─────────────────────────────
#1  @frankdegods   73%  +14.2%  12 trades  ████████░░
#2  @nichxbt       68%  +11.8%   9 trades  ███████░░░
#3  @CryptoKaleo   61%   +8.3%  15 trades  ██████░░░░

View Full Leaderboard →
```

### Footer
```
paste.rank — Real P&L data from paste.trade by @frankdegods
Built by @swarminged
```

## Search behavior
- The search input should:
  - Accept handles with or without @
  - On Enter or submit → navigate to `/[handle]`
  - Show autocomplete dropdown if we have matching handles in DB (optional, nice-to-have)
  - Client component (`"use client"`) for interactivity

## Component: `src/components/ui/search-input.tsx`
If this doesn't exist yet (Task 01 should create it), build it:
```typescript
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchInput({ size = "lg" }: { size?: "sm" | "lg" }) {
  // Handle input with @ prefix display
  // On submit, router.push(`/${handle}`)
  // Large variant for hero, small variant for nav
}
```

## OG Metadata
```typescript
export const metadata = {
  title: "paste.rank — Real P&L Rankings for Crypto Twitter",
  description: "See who's actually making money on CT. Real trade data, real P&L, no cap. Powered by paste.trade.",
  openGraph: {
    title: "paste.rank — CT Trader Leaderboard",
    description: "Real P&L rankings for Crypto Twitter traders.",
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "paste.rank — CT Trader Leaderboard",
    images: ["/api/og/home"],
  },
};
```

## Data fetching
This is a server component for the main page. Fetch data directly from lib functions or internal API:
```typescript
// In page.tsx (server component)
const trending = await fetch(`${SITE_URL}/api/trending`).then(r => r.json());
const topTraders = await fetch(`${SITE_URL}/api/leaderboard?limit=3`).then(r => r.json());
```

Or better, import the DB functions directly since this is server-side:
```typescript
import { getTrending } from "@/lib/db";
import { getLeaderboard } from "@/lib/db";
```

## Done when
- Landing page renders with hero, search, feature cards, trending, leaderboard preview
- Search navigates to author profile page
- Dark theme, JetBrains Mono font throughout
- Feature cards link to correct pages
- Trending and leaderboard preview show data (or placeholder if DB empty)
- OG metadata is set
- Responsive (looks decent on mobile too, though desktop is priority)
