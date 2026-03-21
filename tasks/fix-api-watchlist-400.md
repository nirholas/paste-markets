# Fix: /api/watchlist 400 Errors

## Your working directory
`/workspaces/paste-markets/`

Read `CLAUDE.md` before starting. Follow its conventions exactly.

---

## Problem

`GET /api/watchlist` returns HTTP 400 repeatedly on production. The browser console shows many failed requests. The watchlist endpoint provides data for the signals page and home feed components.

The most likely cause: `getAllWatched()` throws an unhandled error (e.g. the `watchlist` table doesn't exist in the database), and the error propagates as an unhandled rejection. Next.js may convert some unhandled errors to 400 depending on the error type.

---

## File to edit

- `src/app/api/watchlist/route.ts`

---

## What to fix

### 1. Wrap the GET handler in try/catch

```ts
export async function GET() {
  try {
    const callers = await getAllWatched();

    // Auto-populate if empty
    if (callers.length === 0) {
      const added = await autoPopulateFromLeaderboard();
      if (added > 0) {
        const refreshed = await getAllWatched();
        return NextResponse.json({
          callers: refreshed,
          total: refreshed.length,
          autoPopulated: true,
        });
      }
    }

    return NextResponse.json({
      callers,
      total: callers.length,
      autoPopulated: false,
    });
  } catch (err) {
    console.error("[api/watchlist] GET failed:", err);
    return NextResponse.json(
      { callers: [], total: 0, error: "Watchlist unavailable" },
      { status: 200 },
    );
  }
}
```

Returning 200 with an empty array (instead of 500) prevents the client from retrying endlessly and lets the UI show an empty state gracefully.

### 2. Also protect the POST handler

The POST handler already validates input and returns 400 for bad input, which is correct. But if the DB insert itself throws, it should catch that:

Read the POST handler fully and ensure the `addToWatchlist()` call (and any subsequent `computeAlphaScore` / `callerTier` calls) are wrapped in try/catch, returning a 500 with an error message if the write fails.

---

## Testing

1. `npm run build` — no type errors
2. `GET /api/watchlist` should return `{ callers: [], total: 0 }` even if the watchlist table doesn't exist
3. The client-side components that consume this endpoint should handle an empty callers array without crashing

---

## Do NOT

- Change the response shape (callers array + total count)
- Add authentication requirements
- Modify the watchlist table schema
