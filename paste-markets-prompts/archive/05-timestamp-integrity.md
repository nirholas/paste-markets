# Feature: Timestamp Integrity & Anti-Cherry-Picking

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun, Cloudflare Workers. The system already records two prices per trade: `created_at_price` (price when the original content was published/tweeted) and `publish_price` (price when submitted to paste.trade). The DB already has `source_date` (when the content was originally posted). Trade pipeline in `/scripts/post.ts` and `/scripts/route.ts`.

The community flagged this risk: "faking tweet activity entered the chat" — people will submit old tweets retroactively after the trade already worked.

---

## What to Build
A trust layer that classifies every call by how close the submission was to the original tweet, and surfaces this transparently on every trade card and profile.

### Core Rules Engine

Add a field `integrity` to every trade, computed at submission time:

```ts
type IntegrityTier =
  | "live"        // submitted within 1 hour of source_date
  | "same_day"    // submitted 1-24 hours after source_date
  | "historical"  // submitted 1-7 days after source_date — shown but not in leaderboards
  | "retroactive" // submitted > 7 days after source_date — analysis only, excluded from all stats

// Derived field:
delayMinutes: number  // (submit_time - source_date) in minutes
```

**Leaderboard & stats rules:**
- `live` + `same_day` → counted in all leaderboards and win rate calculations
- `historical` → visible on profiles and asset pages, labeled "Historical Call", not counted in leaderboard standings
- `retroactive` → visible with a "Retroactive" label, never counted in any stats

### Tweet Verification at Submission

When a tweet URL is submitted:
1. Fetch the tweet directly from Twitter API (already done in `/scripts/extract.ts`) — record the `created_at` from the API response, not from the URL or user input
2. Store a `tweet_content_hash: sha256(tweet.text + tweet.created_at)` at submission time
3. If tweet can't be fetched (deleted before submission), reject the submission or mark as `unverifiable`
4. Record `tweet_verified_at` timestamp

### Ongoing Tweet Health Monitoring

Background job (runs hourly via Cloudflare Cron):
- For all tracked trades with a tweet source, periodically re-fetch the tweet
- If 404 (deleted): set `tweet_status: "deleted"`, record `tweet_deleted_at`
- If content changed (hash mismatch): flag as `tweet_edited`
- Deleted tweets still count toward stats (prevent gaming by deleting bad calls) but show a "Tweet deleted" indicator on the card

```ts
// New fields added to trade record:
{
  integrity: IntegrityTier,
  delayMinutes: number,
  tweetVerifiedAt: string,
  tweetContentHash: string,
  tweetStatus: "live" | "deleted" | "edited" | "unverifiable",
  tweetDeletedAt: string | null,
  countedInStats: boolean         // false if historical or retroactive
}
```

### UI Changes

**On every trade card:**
Add a small integrity badge in the corner:
- 🟢 "Live Call" — submitted within 1h
- 🟡 "Same Day" — submitted 1-24h after tweet
- 🟠 "Historical" — 1-7 days later (not in leaderboard)
- 🔴 "Retroactive" — > 7 days later (not in stats)
- ⚫ "Tweet Deleted" — source tweet no longer exists

On hover/click, show a tooltip:
> "This call was submitted 2 hours after the original tweet was posted.
> Source tweet: @zacxbt on Jan 15, 2026 at 10:23 AM
> Price at tweet: $85,420 | Price at submission: $86,100"

**On caller profiles:**
Add an "Integrity Score" stat:
```
Integrity: 87% live calls
Live: 41 | Same Day: 4 | Historical: 2 | Retroactive: 0
```

Show a badge:
- 90%+ live: ⚡ "Live Caller"
- 70-89%: ✓ "Mostly Live"
- 50-69%: ⏱ "Mixed"
- < 50%: "Cherry Picker" (shown neutrally, with explanation)

**On leaderboards:**
- Add "Live Only" toggle filter (shows only calls where `integrity = "live" OR "same_day"`)
- Default view already excludes historical/retroactive from calculations, but toggle makes it explicit

### API Changes

**`POST /api/skill/post`** (submission endpoint) — add validation:
- Compute `delayMinutes = now() - source_date`
- Assign `integrity` tier
- Set `countedInStats = integrity !== "historical" && integrity !== "retroactive"`
- Return integrity classification in response so the UI can show it immediately

**`GET /api/search`** — add filter:
- `?integrity=live` — only live calls
- `?counted_in_stats=true` — only calls that count toward leaderboards

**`GET /api/cron/tweet-health`** — Cloudflare cron endpoint:
- Re-check all tweet statuses
- Update `tweet_status` and `tweet_deleted_at` where needed
- Run: every hour

### Files to read first:
- `/scripts/extract.ts` — existing tweet fetch to extend with hash + timestamp recording
- `/scripts/post.ts` — where trades are published, add integrity computation here
- `/references/index/trade-index.md` — DB schema to extend
- `/types.ts` — add `IntegrityTier` type

## Deliverable:
1. `IntegrityTier` type + `integrity`, `delayMinutes`, `tweetContentHash`, `tweetStatus` fields in schema
2. Integrity computation in `/scripts/post.ts` at submission time
3. Tweet hash recording in `/scripts/extract.ts`
4. Cloudflare Cron worker for hourly tweet health check
5. Integrity badge component on all trade cards (with tooltip)
6. Integrity score section on caller profiles
7. "Live Only" filter toggle on leaderboards
8. Filter support in `/api/search` for `integrity=` and `counted_in_stats=`
