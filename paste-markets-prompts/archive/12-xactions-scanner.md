# Task: Replace Twitter Fetching with xactions npm Package

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard has an existing Twitter scanner at `src/app/api/scan/route.ts` that calls `fetchUserTweets(handle, count)` from `src/lib/twitter-fetch.ts`. The current fallback chain is: Twitter API v2 (requires bearer token we don't have) → Nitter RSS (broken, returns ~20 tweets max) → Playwright browser scraping (requires local session file).

There is an npm package called `xactions` (v3.1.0+) that provides Twitter scraping **without API keys or browser automation**. It is MIT licensed and published on npm. It provides:

- `scrapeProfile(handle)` — get user profile data
- `scrapeTweets(handle, count)` — get recent tweets with full metadata
- `scrapeThread(tweetId)` — get full thread
- `searchTweets(query)` — search tweets
- No API key needed, no Playwright, no session cookies

This solves the community concern from @gusgonzalezs: "How does it avoid getting blocked by X when trying to read tweets?"

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Install xactions

Add to `paste-dashboard/package.json` dependencies:
```json
"xactions": "^3.1.0"
```

Run `npm install` (this is safe).

### 2. Refactor `src/lib/twitter-fetch.ts`

Add a new function `fetchViaXactions(handle: string, maxTweets: number): Promise<Tweet[]>` that:

1. Imports from `xactions`
2. Calls `scrapeTweets(handle, maxTweets)`
3. Maps the response to the existing `Tweet[]` interface:
```ts
interface Tweet {
  id: string
  text: string
  created_at: string  // ISO 8601
  url: string
  author_handle?: string
  author_name?: string
  metrics?: {
    likes: number
    retweets: number
    replies: number
  }
}
```
4. Filters out retweets (text starting with "RT @")
5. Returns sorted by `created_at` descending (newest first)

### 3. Update `fetchUserTweets` fallback chain

New priority order:
```
1. TWITTER_BEARER_TOKEN set → Twitter API v2
2. Try xactions scraper (new, default path)
3. Try Nitter RSS (legacy fallback)
4. Try Playwright browser scraper (if session file exists)
5. All failed → throw with summary of all errors
```

The xactions scraper should be the **primary path** for most deployments since it requires no configuration.

### 4. Add `fetchProfileViaXactions` helper

Add a function to fetch profile metadata (avatar, display name, bio, verified status, follower count) using xactions:

```ts
async function fetchProfileViaXactions(handle: string): Promise<TwitterProfile | null> {
  // Uses xactions scrapeProfile
  // Returns: { handle, displayName, avatarUrl, bio, verified, followers, following }
}
```

Update any existing profile-fetching code to use this as a fallback.

### 5. Add tweet search capability

Add a function for searching tweets by keyword/query:

```ts
async function searchTweetsViaXactions(query: string, maxResults?: number): Promise<Tweet[]> {
  // Uses xactions searchTweets
  // Useful for the alpha discovery pipeline later
}
```

Export this from `twitter-fetch.ts` for use by other features.

---

## Files to Read First
- `paste-dashboard/src/lib/twitter-fetch.ts` — current implementation
- `paste-dashboard/src/app/api/scan/route.ts` — main consumer of fetchUserTweets
- `paste-dashboard/src/lib/scan-processor.ts` — processes scanned tweets
- `paste-dashboard/package.json` — current dependencies

## Files to Modify
- `paste-dashboard/package.json` — add xactions dependency
- `paste-dashboard/src/lib/twitter-fetch.ts` — add xactions functions, update fallback chain

## Files NOT to Modify
- `paste-dashboard/src/app/api/scan/route.ts` — no changes needed, it calls fetchUserTweets
- `paste-dashboard/src/lib/scan-processor.ts` — no changes needed

---

## Done When
- `fetchUserTweets("frankdegods", 200)` uses xactions by default when no bearer token is set
- `fetchProfileViaXactions("frankdegods")` returns profile data
- `searchTweetsViaXactions("BTC long")` returns matching tweets
- Existing Nitter and Playwright paths still work as lower-priority fallbacks
- All new functions are properly typed and exported
- No breaking changes to existing scan pipeline
