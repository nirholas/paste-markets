# Fix: Author Page Prefetch/Navigation 500 Errors

## Your working directory
`/workspaces/paste-markets/`

Read `CLAUDE.md` before starting. Follow its conventions exactly.

---

## Problem

When the user is on the home page or leaderboard, Next.js prefetches author profile links in the viewport. These prefetch requests and subsequent navigations return 500:

```
GET https://paste.markets/nichxbt?_rsc=vusbg  500
GET https://paste.markets/PhotonCap?_rsc=1ce29  500
GET https://paste.markets/CryptoCapo_?_rsc=vp77g  500
GET https://paste.markets/IronSageBrook?_rsc=3lb4g  Failed
```

The `?_rsc=` parameter indicates these are React Server Component prefetch/navigation requests. When the `[author]` page's server component throws, Next.js returns 500 for both the full page load and the RSC payload.

---

## Root cause

This is the same underlying issue as the author page 500 — unhandled exceptions in the server component. However, there's an additional concern: **prefetch requests should be lightweight**. Currently the author page does heavy work (sync, Twitter fetch, reputation calc, badge computation) on every request including prefetches.

---

## File to edit

- `src/app/[author]/page.tsx`

---

## What to fix

### 1. Add a top-level try/catch around the entire page function

As a safety net beyond the individual try/catches (see `fix-author-page-500.md`), wrap the entire `AuthorPage` function body:

```tsx
export default async function AuthorPage({ params }: PageProps) {
  const { author: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);

  if (!isValidHandle(handle)) notFound();

  try {
    // ... all existing logic ...
  } catch (err) {
    console.error(`[author-page] Unhandled error for ${handle}:`, err);
    return <NotFound handle={handle} />;
  }
}
```

This ensures that even if an unexpected error occurs, the page returns a valid React tree instead of a 500.

### 2. Add an error.tsx boundary

Create `src/app/[author]/error.tsx` as a client-side error boundary. This catches rendering errors that escape the server component:

```tsx
"use client";

import Link from "next/link";

export default function AuthorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Something went wrong
        </h1>
        <p className="text-text-secondary mb-6">
          This profile couldn&apos;t be loaded right now.
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

---

## Testing

1. `npm run build` — no type errors
2. If the database is unreachable, author pages should show the NotFound/error UI instead of a raw 500
3. Prefetch requests should not cause console errors (they'll get the error boundary instead)

---

## Do NOT

- Add loading skeletons (that's a separate enhancement)
- Change the page URL structure
- Modify the leaderboard or home page
