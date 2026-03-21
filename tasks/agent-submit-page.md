# Agent Task: Build the Submit Page UI

## Your working directory
`/workspaces/agent-payments-sdk/paste-dashboard/`

Read `CLAUDE.md` before starting. Follow its design system and conventions exactly.

---

## What to build

Replace the current `/trade` page with a proper submission UI at `/submit`.

The `/trade` route does analysis-only (Claude extracts a trade but never posts it). This new page calls the real `POST /api/submit` pipeline, which actually posts to paste.trade and returns a source page URL.

---

## User flow

```
1. User lands on /submit
2. Pastes any URL (tweet, article, YouTube) into the input
3. Hits "Track This Trade" button
4. Loading state: "Extracting thesis..."
5. On success: show a preview trade card with TWO buttons:
   → "View Live P&L ↗" — links to https://app.paste.trade/s/{source_id} (new tab)
   → "View on paste.markets" — links to /markets/{source_id}
6. On error: show the error message clearly
```

---

## Page: `src/app/submit/page.tsx`

This must be a client component (`"use client"`).

### Layout

```
[Header / Nav — same as other pages]

[Hero — centered, top half of page]
  H1: "Track Any Trade"
  Subtitle: "Paste a tweet, article, or YouTube URL — we extract the thesis,
             lock the entry price, and track live P&L"

[Input section]
  Large URL input (full width, placeholder: "https://x.com/...")
  "Track This Trade" button (right of input or below)

[Result section — shows after successful submit]
  Trade preview card (see below)
  "View Live P&L →" button → href="/markets/[source_id]"

[Error section — shows on error]
  Error message in red
  "Try again" link
```

### Trade preview card (shown after submit)

Show these fields from the API response:
```
@{author_handle}          {platform badge}

"{headline_quote}"

Trade: {ticker} {direction_badge}    Entry: ${author_price}
Thesis: {thesis}

[View Live P&L →]
```

- `direction_badge`: "LONG" in green (`#2ecc71`) or "SHORT" in red (`#e74c3c`)
- `platform badge`: show the platform name in a small muted badge
- `author_price`: format with commas, 2 decimal places. If null, show "Price pending"
- Card style: `bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6`

### Loading states

Show these messages in sequence with a blinking cursor animation:
1. "Fetching source..." (0-1s)
2. "Extracting thesis..." (1-3s)
3. "Locking entry price..." (3-5s)
4. "Posting to paste.markets..." (5+s)

Use `setTimeout` to advance through these stages automatically. Reset on new submit.

### API call

```ts
const res = await fetch("/api/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: inputValue }),
})
const data = await res.json()

// Success: data.ok === true
// data: { ok, source_id, source_url, ticker, direction, thesis, author_handle, author_price }

// Error: data.ok === false
// data: { ok: false, error: string }
```

---

## Nav update

Add "Submit" link to the nav (`src/components/ui/nav.tsx`):
- Link: `/submit`
- Label: "Submit"
- Position: after "Leaderboard", before any other items

Also add a prominent "Track a Trade →" CTA on the home page (`src/app/page.tsx`) linking to `/submit`. Place it in the hero section.

---

## Design rules (from CLAUDE.md)

- Dark Bloomberg terminal theme: background `#0a0a1a`, cards `#0f0f22`
- Font: JetBrains Mono monospace
- Input: `bg-[#0f0f22] border border-[#1a1a2e] text-[#f0f0f0] rounded px-4 py-3 w-full`
- Input focus: `focus:border-[#3b82f6] outline-none`
- Primary button: `bg-[#3b82f6] text-white px-6 py-3 rounded hover:bg-blue-500 transition`
- Muted text: `#555568`
- No emoji anywhere

---

## Files to create/modify

- **Create**: `src/app/submit/page.tsx`
- **Modify**: `src/components/ui/nav.tsx` — add Submit link
- **Modify**: `src/app/page.tsx` — add "Track a Trade →" CTA

## Do not create

- Do not create `/app/trade/page.tsx` — leave that file alone
- Do not modify any API routes
