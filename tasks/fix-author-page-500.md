# Fix: Author Profile Page 500 Errors

## Your working directory
`/workspaces/paste-markets/`

Read `CLAUDE.md` before starting. Follow its conventions exactly.

---

## Problem

Author profile pages (`/[author]`) return HTTP 500 on production when any non-critical database call throws. Visiting e.g. `/nichxbt`, `/PhotonCap`, or `/CryptoCapo_` crashes the entire page.

The root cause: several DB calls in `src/app/[author]/page.tsx` are **not wrapped in try/catch**. If the database is temporarily unreachable, a table is missing, or a query fails, the unhandled exception kills the server component and returns a 500 instead of gracefully degrading.

---

## Files to edit

- `src/app/[author]/page.tsx` (primary)

---

## What to fix

### 1. Wrap `recordView` in try/catch (line ~159)

```ts
// BEFORE (crashes page if DB fails)
await recordView(handle, "profile");

// AFTER
try {
  await recordView(handle, "profile");
} catch {
  // View tracking is non-critical
}
```

### 2. Wrap `getIntegrityStats` in try/catch (line ~241)

```ts
// BEFORE
const integrityStats = await getIntegrityStats(handle);

// AFTER
let integrityStats = null;
try {
  integrityStats = await getIntegrityStats(handle);
} catch {
  // Integrity stats are optional
}
```

### 3. Wrap `getCallerTipsEarned` and `getCallerWagerHistory` (lines ~244-247)

```ts
// BEFORE
const tipsEarned = await getCallerTipsEarned(handle);
const wagerHistory = (await getCallerWagerHistory(handle)).filter(
  (w) => w.wager_count > 0,
);

// AFTER
let tipsEarned = 0;
let wagerHistory: Awaited<ReturnType<typeof getCallerWagerHistory>> = [];
try {
  tipsEarned = await getCallerTipsEarned(handle);
  wagerHistory = (await getCallerWagerHistory(handle)).filter(
    (w) => w.wager_count > 0,
  );
} catch {
  // Wager data is non-critical
}
```

### 4. Wrap `getOrCreateAuthor` re-read in try/catch (line ~162)

The second call to `getOrCreateAuthor` after sync could also fail. Fall back to the first `author` value:

```ts
// BEFORE
const refreshed = await getOrCreateAuthor(handle);

// AFTER
let refreshed = author;
try {
  refreshed = await getOrCreateAuthor(handle);
} catch {
  // Use original author data
}
```

### 5. Wrap badge/fade computation in try/catch (lines ~262-275)

`computeFadeScore` and `computeBadges` use metrics data and could throw on unexpected shapes:

```ts
let fadeStats = null;
try {
  fadeStats = computeFadeScore(metrics.recentTrades);
} catch {
  // Fade stats are optional
}

let badgeData: { id: string; earnedAt: string }[] = [];
try {
  const earnedBadges = computeBadges(metrics, metrics.recentTrades);
  badgeData = earnedBadges.map((e) => ({
    id: e.badge.id,
    earnedAt: e.earnedAt,
  }));
} catch {
  // Badges are optional
}
```

---

## Rendering guard

For any data that is now nullable because of try/catch, make sure the JSX conditionally renders. Example:

```tsx
{integrityStats && <IntegrityBreakdown stats={integrityStats} />}
{fadeStats && <FadeScorecardWrapper fadeStats={fadeStats} />}
{badgeData.length > 0 && <BadgeShelf badges={badgeData} />}
```

Check the existing rendering code — some of these guards may already exist. Only add guards where missing.

---

## Testing

1. Run `npm run build` — should compile with no type errors
2. The page should render even if the database is unreachable for non-critical queries (integrity, wagers, badges, views)
3. Core data (metrics, trades) should still cause a meaningful fallback (the existing `NotFound` component) if unavailable

---

## Do NOT

- Change the page layout or design
- Add new features or components
- Modify other pages
- Change function signatures in lib files
