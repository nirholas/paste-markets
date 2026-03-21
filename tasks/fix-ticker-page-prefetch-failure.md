# Fix: Ticker/Asset Page Prefetch Failures

## Your working directory
`/workspaces/paste-markets/`

Read `CLAUDE.md` before starting. Follow its conventions exactly.

---

## Problem

Prefetching ticker pages fails with network errors:

```
Fetch failed loading: GET "https://paste.markets/ticker/ETH?_rsc=3lb4g"
Fetch failed loading: GET "https://paste.markets/IronSageBrook?_rsc=3lb4g"
```

The `/ticker/[ticker]` route's server component is likely throwing an unhandled exception during data fetching, causing the RSC payload to fail.

---

## Files to investigate and fix

- `src/app/ticker/[ticker]/page.tsx`
- `src/app/t/[ticker]/page.tsx` (short URL variant, if it exists)
- `src/app/api/ticker/[ticker]/route.ts` (if the page fetches from its own API)

---

## What to fix

### 1. Read the ticker page and identify unprotected async calls

Open `src/app/ticker/[ticker]/page.tsx` and find all `await` calls that could throw. Typical culprits:
- DB queries for ticker data
- Calls to paste.trade API for trade data
- Price fetching calls

### 2. Wrap all data fetching in try/catch

The page should never throw an unhandled exception. Wrap the primary data fetch in try/catch and return a meaningful fallback:

```tsx
export default async function TickerPage({ params }: PageProps) {
  const { ticker } = await params;

  try {
    // ... existing data fetching
  } catch (err) {
    console.error(`[ticker-page] Failed to load ${ticker}:`, err);
    return (
      <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {ticker.toUpperCase()}
        </h1>
        <p className="text-text-secondary">
          Ticker data is temporarily unavailable.
        </p>
      </main>
    );
  }
}
```

### 3. Add error.tsx boundary

Create `src/app/ticker/[ticker]/error.tsx`:

```tsx
"use client";

import Link from "next/link";

export default function TickerError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Ticker Unavailable
        </h1>
        <p className="text-text-secondary mb-6">
          Could not load data for this ticker.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Try again
          </button>
          <Link
            href="/leaderboard"
            className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
```

### 4. Protect the API route

If `src/app/api/ticker/[ticker]/route.ts` exists, wrap its handler in try/catch as well.

---

## Testing

1. `npm run build` — no type errors
2. `/ticker/ETH` should show a fallback state instead of 500 when data is unavailable
3. Prefetching ticker links from the home page should not produce console errors

---

## Do NOT

- Change the ticker page layout or design
- Modify price fetching intervals
- Change how ticker data is stored
