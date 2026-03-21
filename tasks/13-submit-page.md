# Task 13: URL Submission Page — Browser Front End for paste.trade

## Goal
Replace the broken "What's The Trade?" Claude-based page with a clean URL submission form that calls paste.trade's `POST /api/sources` directly. This is the core value prop of paste.markets: anyone can submit a trade source from a browser without needing Claude Code installed.

## Context
- paste.trade is a headless backend with no consumer UI
- The `/trade` page at `src/app/trade/page.tsx` currently calls Claude to extract trades — this is wrong and redundant with paste.trade's own processing
- paste.trade exposes `POST https://paste.trade/api/sources` which handles all extraction, price locking, and P&L tracking
- Auth: `Bearer ${PASTE_TRADE_KEY}` header
- The API returns `{ source_id, source_url, status: "processing", run_id }`
- `source_url` is a paste.trade link — we'll link to it and also build our own display page later

## Submission Payload
```typescript
{
  url: string,           // the tweet/article/youtube URL
  title?: string,        // optional title if we can extract it
  platform: string,      // "twitter" | "youtube" | "web"
  source_date: string,   // ISO timestamp (use now)
  author_handle?: string // extracted from twitter URL if possible
}
```

## What To Build

### 1. Update `src/app/api/submit/route.ts` (create it)
```
POST /api/submit
Body: { url: string }
```
- Detect platform from URL (twitter/x.com → "twitter", youtube → "youtube", else "web")
- Extract author_handle from twitter URLs: `x.com/{handle}/status/...` → handle
- Call `POST https://paste.trade/api/sources` with Bearer token
- Return `{ source_id, source_url, status }` or error

### 2. Rewrite `src/app/trade/page.tsx`
Replace the current Claude-based UI with:
- Big headline: "Turn any tweet into a trade card"
- Single text input: "Paste a URL — tweet, article, or YouTube"
- "Submit" button
- Loading state: "paste.trade is processing your source..."
- Success state:
  - Show the source URL as a link: "View on paste.trade →"
  - Show a note: "Trade card will appear on the leaderboard once P&L is locked"
  - Share button to post it on X
- Error state with message

### 3. Delete / gut `src/components/trade-finder.tsx`
The Claude-based trade finder is no longer needed. Either delete it or replace its content entirely with a simple wrapper around the new flow.

### 4. Update the homepage `src/app/page.tsx`
Add a prominent CTA section above or below the leaderboard:
- "Submit a trade source" with the URL input (same component, just embedded)
- OR a big button linking to `/trade`

## URL Platform Detection
```typescript
function detectPlatform(url: string): string {
  if (/https?:\/\/(twitter\.com|x\.com)\//i.test(url)) return "twitter";
  if (/https?:\/\/(youtube\.com|youtu\.be)\//i.test(url)) return "youtube";
  return "web";
}

function extractHandle(url: string): string | undefined {
  const match = url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/i);
  return match?.[1];
}
```

## Design
Follow the existing Bloomberg terminal dark theme (see CLAUDE.md for colors).
- Input: full width, border border-[#1a1a2e] bg-[#0f0f22] text-[#f0f0f0]
- Button: border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-black
- Processing spinner: simple CSS animation, color #555568
- Success: green (#2ecc71) checkmark + source_url link

## Validation
1. `cd paste-dashboard && npx next build` — must be clean
2. Submitting a tweet URL should return a source_id and source_url
3. Error when PASTE_TRADE_KEY is not set: "Service unavailable"
4. Error for non-URL input: "Please enter a valid URL"

## Do NOT
- Call Claude or Anthropic API in this flow at all
- Use the old trade-finder component
- Break existing leaderboard, author profile, or other pages
- Auto-submit without the user clicking the button
