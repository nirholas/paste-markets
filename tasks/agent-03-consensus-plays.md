# Agent Task: Consensus Plays

## Context

You are building inside `/workspaces/agent-payments-sdk/paste-dashboard/` — a Next.js 15 App Router project.

Read `CLAUDE.md` in that directory before starting. Follow its design system and conventions exactly.

## What is Consensus Plays

When multiple top-ranked callers on the leaderboard all hold the same position on the same ticker, that's a consensus signal. It's more trustworthy than any single caller's call because it's weighted by real P&L track records.

Example: "4 of the top 10 callers are long $SOL right now. Their avg win rate: 71%. Avg entry: $182."

This doesn't exist anywhere on paste.trade. It's the most useful thing paste.markets can offer.

## What to Build

### 1. API Route: `GET /api/consensus`

**Logic:**
1. Fetch top 20 callers from leaderboard (use existing `getLeaderboard` from `@/lib/data`)
2. For each caller, fetch their recent trades from paste.trade:
   `GET https://paste.trade/api/search?author={handle}&top=30d&limit=50`
   Auth: `Bearer ${PASTE_TRADE_KEY}`
3. Group all trades by ticker + direction
4. A "consensus" exists when:
   - 3 or more callers have the same ticker + direction in the last 30 days
   - Weighted by caller win rate (callers with higher WR count more)
5. For each consensus, compute:
   - `callers`: array of { handle, winRate, avgPnl }
   - `callerCount`: number of callers
   - `avgWinRate`: weighted average win rate of those callers
   - `avgEntryPrice`: average of their entry prices (if available)
   - `currentPnl`: average P&L across those callers' trades on that ticker
   - `ticker`, `direction`
6. Sort by `callerCount DESC`, then `avgWinRate DESC`
7. Return top 10 consensus plays

**Response shape:**
```typescript
{
  plays: Array<{
    ticker: string
    direction: "long" | "short" | "yes" | "no"
    callerCount: number
    avgWinRate: number
    avgEntryPrice: number | null
    currentPnl: number | null      // avg P&L across callers' positions
    callers: Array<{
      handle: string
      winRate: number
      avgPnl: number
    }>
  }>
  timeframe: "30d"
  updatedAt: string
}
```

**Performance:** Fetch all callers' trades in parallel with `Promise.all`. Cache the result for 10 minutes using a module-level cache (same pattern as `data.ts` in-memory cache).

**File:** `src/app/api/consensus/route.ts`

---

### 2. Page: `/consensus`

**File:** `src/app/consensus/page.tsx` (server component with metadata)
**Component:** `src/components/consensus-plays.tsx` (client component)

**Layout:**
```
CONSENSUS PLAYS                          [30d ▾]

When 3+ top callers agree on the same ticker.
Weighted by real win rate — not just vote count.

─────────────────────────────────────────────
#1  SOL    LONG    4 callers    68% avg WR
    @caller1 (71%) @caller2 (68%) @caller3 (65%) +1
    Avg entry: $182.40  ·  Avg P&L: +12.4%

#2  NVDA   SHORT   3 callers    74% avg WR
    @caller4 (78%) @caller5 (74%) @caller6 (70%)
    Avg entry: $142.50  ·  Avg P&L: +8.1%
─────────────────────────────────────────────
```

- Each consensus row is expandable to show all callers and their individual trades
- Callers are clickable links to their profile pages
- Direction badge: green for long/yes, red for short/no
- "X callers" badge: amber if 3, brighter amber/green if 4+
- Empty state: "Not enough data yet — needs 3+ callers on the same ticker"

**OG image:** Add a `consensus` case to `src/app/api/og/[...slug]/route.tsx` showing the top 3 consensus plays as a shareable card.

**Metadata:**
```typescript
title: "Consensus Plays — paste.markets"
description: "When 3+ top CT callers agree on the same trade. Weighted by real win rate."
```

---

### 3. Add to Home Page

In `src/app/page.tsx`, add a "CONSENSUS" feature card alongside the existing ones:
```typescript
{
  title: "CONSENSUS PLAYS",
  description: "When top callers agree.",
  href: "/consensus",
}
```

Also fetch and display the top 1-2 consensus plays directly on the homepage below the leaderboard preview.

---

### 4. Add to Nav

In `src/components/ui/nav.tsx`, add:
```tsx
<Link href="/consensus" className="text-text-muted hover:text-accent transition text-sm">
  Consensus
</Link>
```

## Notes

- `PASTE_TRADE_KEY` env var is the Bearer token for paste.trade API reads
- Handle API failures gracefully — if a caller's trades can't be fetched, skip them
- Minimum 3 callers to qualify as consensus (not 2)
- If `pnlPct` is null (open position, no P&L yet), still count the caller but show P&L as "OPEN"
- The consensus data is most interesting when P&L is positive — these are the signals that were RIGHT
