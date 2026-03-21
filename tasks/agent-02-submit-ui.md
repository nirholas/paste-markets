# Agent Task: Trade Submission UI

## Context

You are building inside `/workspaces/agent-payments-sdk/paste-dashboard/` — a Next.js 15 App Router project.

Read `CLAUDE.md` in that directory before starting. Follow its design system and conventions exactly.

The existing `src/app/trade/page.tsx` is a "What's The Trade?" page that shows AI-extracted trades but never actually posts them. You are replacing it with a proper submission UI that:
1. Takes any tweet URL
2. Shows animated progress as it extracts + posts the trade
3. Shows the result as a trade card with a link to paste.trade
4. Makes the submission feel real and satisfying

## Existing Files to Read First

- `src/app/trade/page.tsx` — existing page, understand its structure
- `src/components/trade-finder.tsx` — existing client component
- `src/app/api/submit/route.ts` — the new API you will call (built by agent-01, assume it exists)
- `src/components/ui/*.tsx` — shared UI components

## What to Build

### Replace `src/components/trade-finder.tsx` entirely

New client component with these states:

**State 1: Input**
```
┌────────────────────────────────────────┐
│  SUBMIT A TRADE TO PASTE.TRADE         │
│                                        │
│  [ paste a tweet URL or thesis       ] │
│                                        │
│  [   Find & Submit Trade   ]           │
│                                        │
│  Works with tweets, articles, theses   │
└────────────────────────────────────────┘
```

**State 2: Loading — animated progress steps**

Show each step completing in sequence with a checkmark or spinner:
```
  ✓  Fetching tweet content
  ✓  Extracting trade thesis
  ⟳  Looking up price at author's timestamp
  ·  Submitting to paste.trade
```

Each step should visually complete before the next appears (use the actual API response timing, not fake delays).

**State 3: Success — trade card**
```
┌─────────────────────────────────────────┐
│  TRADE SUBMITTED                        │
│                                        │
│  @frankdegods · Jan 10, 2026           │
│                                        │
│  "how do I long looksmaxxing?"         │
│                                        │
│  HIMS   LONG                           │
│  $15.74 entry · live tracking started  │
│                                        │
│  [ View on paste.trade → ]             │
│  [ Submit Another ]                    │
└─────────────────────────────────────────┘
```

**State 4: Error**

Show what was extracted (ticker, direction, thesis) even if posting failed. Let the user know what went wrong simply ("Couldn't post — paste.trade API unavailable" etc).

## API Contract

`POST /api/submit` with `{ url: string }`

Success response:
```typescript
{
  ok: true,
  trade_url: string,      // link to paste.trade trade page
  author_handle: string,
  ticker: string,
  direction: "long" | "short" | "yes" | "no",
  author_price: number,
  thesis: string,
  headline_quote?: string,
}
```

Error response:
```typescript
{
  ok: false,
  error: string,
  // may still include partial extraction:
  ticker?: string,
  direction?: string,
  thesis?: string,
}
```

## Design Requirements

- Dark Bloomberg terminal aesthetic — see CLAUDE.md for colors
- Font: JetBrains Mono throughout
- Progress steps: use `#2ecc71` (GREEN) for completed, `#3b82f6` (ACCENT) for active, `#555568` (MUTED) for pending
- Trade card: same surface/border styling as other cards in the app
- PnL shown as `+X.X%` in green or `-X.X%` in red
- The `trade_url` link should open in a new tab
- Mobile responsive

## Files to Modify

- `src/components/trade-finder.tsx` — full rewrite
- `src/app/trade/page.tsx` — update title/description to reflect submission (not just finding)

## Note

The "what's the trade?" framing is now secondary. The primary action is **submitting** a trade to paste.trade so it gets tracked. Update the copy to reflect this:
- Page title: "Submit a Trade"
- Subtitle: "Paste a tweet. We extract the thesis, lock the price, and post it to paste.trade for live P&L tracking."
