# Task: Playwright Tweet Scraper for Bulk Profile Scan

## Context

Repo is at `/workspaces/agent-payments-sdk/paste-dashboard/`.

The bulk profile scanner already exists at `paste-dashboard/src/app/api/scan/route.ts`. It:
1. Calls `fetchUserTweets(handle, 200)` from `paste-dashboard/src/lib/twitter-fetch.ts`
2. Runs each tweet through Claude Haiku to detect trade calls
3. Submits detected calls to `POST https://paste.trade/api/trades` to get backdated P&L

The current `fetchUserTweets` fallback chain:
1. Twitter API v2 (requires `TWITTER_BEARER_TOKEN` — we don't have it)
2. Nitter RSS (free but returns ~20 tweets max, often broken)

We need a third option: **Playwright browser scraping**. Navigate to `x.com/{handle}`, scroll the profile timeline, extract tweets — no X API key needed. Requires one saved X session cookie on the server.

There is already a working DevTools scraper script for reference at:
`/workspaces/agent-payments-sdk/xactions/browser-scripts/scrape-timeline.js`

And a working Playwright session management pattern at:
`/workspaces/agent-payments-sdk/xactions/src/x-client.ts`

---

## What to Build

### 1. Add Playwright dependency

In `paste-dashboard/package.json`, add:
```json
"playwright": "^1.44.0"
```

Also add a `postinstall` script to install the Chromium browser:
```json
"postinstall": "playwright install chromium --with-deps"
```

### 2. Add `fetchViaBrowser` to `paste-dashboard/src/lib/twitter-fetch.ts`

Add a third function `fetchViaBrowser(handle: string, maxTweets: number): Promise<Tweet[]>` that:

1. **Loads session** from `./config/x-session.json` (Playwright `storageState` format). If file doesn't exist, throw a clear error: `"No X session file found at config/x-session.json — run the session export script first"`.

2. **Launches Playwright Chromium** headless with:
   - User-agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36`
   - Viewport: `1280x800`
   - `--disable-blink-features=AutomationControlled` arg
   - Override `navigator.webdriver` to `undefined` via `addInitScript`
   - Load the session via `storageState`

3. **Navigate to** `https://x.com/${handle}` and wait for `domcontentloaded`.

4. **Check for redirect to login** — if `page.url()` includes `/login` or `/i/flow`, the session is expired. Throw: `"X session expired — re-export session using browser-scripts/export-session-devtools.js"`.

5. **Scroll and extract tweets** using this logic (port from `scrape-timeline.js`):
   - Query `article[data-testid="tweet"]` elements
   - For each: extract tweet ID from `a[href*="/status/"]`, text from `[data-testid="tweetText"]`, timestamp from `time[datetime]`
   - Skip retweets (check `[data-testid="socialContext"]` contains "reposted")
   - Build tweet URL as `https://x.com/${handle}/status/${tweetId}`
   - Deduplicate by tweet ID
   - Scroll `window.scrollBy(0, 1200)` every 800ms
   - Stop when: `maxTweets` reached, or 15 consecutive scrolls with no new tweets, or 300 scrolls total

6. **Always close the browser** in a `finally` block.

7. Return `Tweet[]` matching the existing interface:
```ts
interface Tweet {
  id: string
  text: string
  created_at: string  // ISO 8601
  url: string
}
```

### 3. Update `fetchUserTweets` fallback chain

In the existing `fetchUserTweets` function, add the browser scraper as the final fallback:

```
1. TWITTER_BEARER_TOKEN set → Twitter API v2
2. Try Nitter RSS
3. Try Playwright browser scraper
4. All failed → throw with summary of all errors
```

The browser scraper should only be attempted if `existsSync('./config/x-session.json')` — skip silently (don't throw) if the session file doesn't exist, so the existing Nitter path still works for deployments without Playwright.

---

## Session File Format

The session file `config/x-session.json` is a standard Playwright `storageState` JSON:
```json
{
  "cookies": [
    { "name": "auth_token", "value": "...", "domain": ".x.com", ... },
    ...
  ],
  "origins": []
}
```

This file is **gitignored**. Users export it once using the DevTools script at:
`xactions/browser-scripts/export-session-devtools.js`

---

## Files to Modify

- `paste-dashboard/package.json` — add playwright dep + postinstall
- `paste-dashboard/src/lib/twitter-fetch.ts` — add `fetchViaBrowser`, update fallback chain

## Files NOT to Modify

- `paste-dashboard/src/app/api/scan/route.ts` — no changes needed
- `paste-dashboard/src/lib/scan-processor.ts` — no changes needed

---

## Done When

- `fetchUserTweets("frankdegods", 200)` returns 200 tweets via Playwright when no Twitter bearer token is set and session file exists
- Graceful error messages when session file missing or session expired
- Nitter path still works as before when session file is absent
- `tsc --noEmit` passes in `paste-dashboard/`
