# Agent Task: Live Trade Feed

## Context

You are building inside `/workspaces/agent-payments-sdk/paste-dashboard/` — a Next.js 15 App Router project.

Read `CLAUDE.md` in that directory before starting. Follow its design system and conventions exactly.

## What is the Live Feed

A real-time scrolling feed of the most recent trades posted to paste.trade by callers on the leaderboard. Like a Bloomberg terminal ticker — you see new calls as they come in, who made them, and how they're performing.

This goes on the homepage and gets its own `/feed` page.

## What to Build

### 1. API Route: `GET /api/feed`

**Logic:**
1. Fetch the top 50 callers from leaderboard (`getLeaderboard` from `@/lib/data`)
2. Fetch recent trades for each caller from paste.trade:
   `GET https://paste.trade/api/search?author={handle}&top=7d&limit=10`
3. Merge all trades into a single array
4. Sort by `posted_at` descending (most recent first)
5. Deduplicate by (author_handle + ticker + direction + author_date)
6. Return top 50

**Response shape:**
```typescript
{
  trades: Array<{
    handle: string
    winRate: number           // caller's overall win rate
    ticker: string
    direction: "long" | "short" | "yes" | "no"
    pnlPct: number | null     // null = still open
    postedAt: string          // ISO
    sourceUrl: string | null
    platform: string | null
  }>
  updatedAt: string
}
```

**Caching:** Cache for 2 minutes at the module level (reuse pattern from `data.ts`).

**File:** `src/app/api/feed/route.ts`

---

### 2. Feed Component: `src/components/trade-feed.tsx`

Client component that:
- Fetches `/api/feed` on mount
- Auto-refreshes every 60 seconds
- Shows trades in a scrollable list

**Each trade row:**
```
HIMS    LONG   @frankdegods (71% WR)   +39.9%   2h ago
SOL     LONG   @caller2 (65% WR)       OPEN     4h ago
NVDA    SHORT  @caller3 (78% WR)       +12.1%   6h ago
```

- Ticker + direction on the left (direction in green/red)
- Caller handle + win rate in middle (handle is a link to their profile)
- P&L on the right (green for positive, red for negative, muted for OPEN)
- Time ago on far right
- Row is clickable — links to `sourceUrl` if available, otherwise caller profile
- Animate new trades sliding in from top when feed refreshes

**Loading state:** Show 8 skeleton rows (muted gray rectangles, same height as real rows).

---

### 3. Homepage Integration

In `src/app/page.tsx`, add the live feed below the leaderboard preview:

```tsx
<section className="max-w-2xl mx-auto px-4 pb-16">
  <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
    LIVE FEED
  </h2>
  <TradeFeed limit={8} />  {/* show 8 rows, link to /feed for more */}
</section>
```

Add a "View full feed →" link below it pointing to `/feed`.

---

### 4. Feed Page: `/feed`

**File:** `src/app/feed/page.tsx`

Simple page showing the full feed (50 items) with auto-refresh. Add metadata:

```typescript
title: "Live Feed — paste.markets"
description: "Real-time trades from top CT callers. Ranked by real P&L."
```

Add to nav:
```tsx
<Link href="/feed" className="text-text-muted hover:text-accent transition text-sm">
  Feed
</Link>
```

Add to home page feature cards:
```typescript
{
  title: "LIVE FEED",
  description: "Trades as they happen.",
  href: "/feed",
}
```

---

### 5. OG Image

Add a `feed` case to `src/app/api/og/[...slug]/route.tsx` that shows the 5 most recent trades as a shareable card — same table layout as the leaderboard OG image.

## Notes

- Fetch all callers' trades in parallel using `Promise.all` with a concurrency limit of 10 at a time (to avoid hammering the API)
- If a caller's fetch fails, skip them silently — don't fail the whole feed
- `posted_at` vs `author_date`: sort by `posted_at` (when it entered paste.trade), display `author_date` if it differs significantly
- The feed is most valuable when it's fast — keep the cache at 2 minutes
- Use `export const dynamic = "force-dynamic"` on the route
