# Task 12: Wire Trade Submission to paste.trade API

## Goal
When a user pastes a URL on the "What's The Trade?" page and gets results, add a "Post to paste.trade" button that actually submits the trade via paste.trade's `POST /api/trades` endpoint. This turns paste.markets from a read-only dashboard into the browser-based submission layer for paste.trade.

## Context

- The "What's The Trade?" page already exists at `src/app/trade/page.tsx`
- It already calls Claude to extract trades via `POST /api/trade`
- The paste.trade submission API is at `POST https://paste.trade/api/trades`
- Auth: Bearer token via `PASTE_TRADE_KEY` env var
- Reference implementation: `/workspaces/agent-payments-sdk/paste-dashboard/scripts/post.ts` (the CLI version)
- The submission payload needs: ticker, direction, platform, instrument, thesis, source_url, author_handle, headline_quote, chain_steps, explanation

## What To Build

### 1. Server-side submission endpoint

Create `src/app/api/submit-trade/route.ts`:

```typescript
POST /api/submit-trade
Body: {
  ticker: string,
  direction: "long" | "short" | "yes" | "no",
  platform: string,        // "robinhood", "hyperliquid", "polymarket"
  instrument: string,      // "shares", "perps", "polymarket"
  thesis: string,
  source_url?: string,
  author_handle?: string,  // the twitter handle who made the call
  headline_quote?: string,
  chain_steps?: string[],
  explanation?: string
}
```

This route should:
1. Validate the payload
2. Forward it to `POST https://paste.trade/api/trades` with the Bearer token
3. Return the paste.trade response (which includes the trade_id and trade card URL)
4. Handle errors gracefully

### 2. Update the trade finder component

In `src/components/trade-finder.tsx`:
- After results are displayed, each trade card should have a "Post to paste.trade" button
- Clicking it calls `POST /api/submit-trade` with the trade data
- Show loading state while submitting
- On success: show the paste.trade link and a "View on paste.trade" button
- On error: show error message

### 3. Source URL input

The current trade finder takes a URL or text thesis. When the input is a URL:
- Extract the author handle from twitter/x.com URLs (e.g. `x.com/frankdegods/status/123` → `frankdegods`)
- Pass the source_url through to the submission

### 4. Submission confirmation

After posting, show:
- "Trade posted! P&L tracking from $XX.XX"
- Link to view on paste.trade
- The trade should now appear in the author's profile on paste.markets

## Validation

1. `cd paste-dashboard && npx next build` — clean
2. Submit a trade via the UI and verify it appears on paste.trade
3. Error handling works for invalid inputs and API failures

## Do NOT

- Skip authentication — always use PASTE_TRADE_KEY
- Allow submission without a thesis
- Auto-submit without user confirmation
- Break the existing trade finder flow
