# Fix: Leaderboard Page Prefetch/Navigation Failures

## Your working directory
`/workspaces/paste-markets/`

Read `CLAUDE.md` before starting. Follow its conventions exactly.

---

## Problem

Navigating to or prefetching the leaderboard page fails:

```
Fetch failed loading: GET "https://paste.markets/leaderboard?_rsc=41ze9"
```

The leaderboard RSC payload request fails, which means the server component is throwing an unhandled error during rendering.

---

## Files to investigate and fix

- `src/app/leaderboard/page.tsx` (main leaderboard page)
- `src/app/api/leaderboard/route.ts` (if the page fetches from its own API)

---

## What to fix

### 1. Read the leaderboard page and identify unprotected async calls

Open `src/app/leaderboard/page.tsx` and find all `await` calls that are not wrapped in try/catch. Common patterns that crash:

- Direct DB queries (`sql(...)`)
- Calls to data layer functions (`getLeaderboard`, etc.)
- Fetch calls to internal API routes

### 2. Wrap data fetching in try/catch with fallback UI

```tsx
export default async function LeaderboardPage() {
  let data;
  try {
    data = await getLeaderboardData(/* params */);
  } catch (err) {
    console.error("[leaderboard] Failed to load:", err);
    // Return a meaningful empty state, not a 500
    return (
      <main className="min-h-screen px-4 py-12 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-4">Leaderboard</h1>
        <p className="text-text-secondary">
          Leaderboard data is temporarily unavailable. Please try again later.
        </p>
      </main>
    );
  }

  // ... render with data
}
```

### 3. Add error.tsx boundary

Create `src/app/leaderboard/error.tsx` as a client error boundary (same pattern as the author page error boundary):

```tsx
"use client";

export default function LeaderboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Leaderboard Unavailable
        </h1>
        <p className="text-text-secondary mb-6">
          Something went wrong loading the rankings.
        </p>
        <button
          onClick={reset}
          className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
```

### 4. If the page fetches from `/api/leaderboard`

Also check `src/app/api/leaderboard/route.ts` and wrap its DB queries in try/catch, returning a proper JSON error response:

```ts
try {
  // ... existing query logic
} catch (err) {
  console.error("[api/leaderboard] Query failed:", err);
  return NextResponse.json({ entries: [], total: 0, error: "Unavailable" }, { status: 200 });
}
```

---

## Testing

1. `npm run build` — no type errors
2. The leaderboard should show an empty/error state instead of 500 when DB is unreachable
3. Prefetching the leaderboard link should not produce console errors

---

## Do NOT

- Change the leaderboard sorting/filtering logic
- Modify the leaderboard table component design
- Change the API response shape beyond adding the error field
