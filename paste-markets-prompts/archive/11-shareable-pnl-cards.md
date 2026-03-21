# Feature: Shareable PnL Cards (Viral Loop Engine)

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun, Cloudflare Workers. OG share cards already exist at `GET /api/og/share/{trade_id}` (returns a 1200×630 or 1080×1080 PNG). Trade data includes: ticker, direction, author, thesis quote, prices (at tweet, at publish, current), PnL %, platform, derivation steps.

Community observations:
- "nailed the ui design" (@letrplB)
- "pnl cards look sick" (@zuckSol)
- "Turn any tweet into a pnl chart is such a degenerate and brilliant idea" (@TheHempTheory)
- Alex Becker (6 retweets): "that is incredibly clever"

The existing share cards are good. This feature makes them great — multiple formats, customizable, designed to go viral.

---

## What to Build

A polished, multi-format PnL card system that people want to share and that drives traffic back to paste.trade.

### Card Formats

**Format 1: Square (1080×1080) — "Brag Card"** (for Twitter/Instagram)
Use when the trade is profitable.

Layout:
```
┌─────────────────────────────────────┐
│  paste.trade                  🟢    │
│                                     │
│     BTC LONG                        │
│     via @zacxbt                     │
│                                     │
│     Entry:  $85,420                 │
│     Now:    $102,000                │
│                                     │
│     +19.4%                          │
│     since call  ████████████░░░░    │
│                                     │
│  "BTC breaking $88k resistance,     │
│   targeting $95k"                   │
│                                     │
│  Called Jan 15 · Hyperliquid Perp   │
│  paste.trade/s/2c9a3094             │
└─────────────────────────────────────┘
```

Design notes:
- Dark background (#0a0a0a)
- Green glow effect for profit cards
- Red glow for loss cards (different template)
- Clean sans-serif font (Inter or Geist)
- Subtle chart/sparkline showing price movement since call
- QR code or short URL in corner

**Format 2: Landscape (1200×630) — "Link Preview"** (for Twitter link cards)
- Same info, optimized for the og:image preview when sharing the URL
- Less visual flair, more readable in small preview size
- This is already partially built — improve/refine

**Format 3: Story (1080×1920) — "Instagram Stories / TikTok"** (new)
- Vertical format
- Big number at center: "+19.4%"
- Thesis quote below
- "Tracked on paste.trade" branding at bottom
- Designed for mobile share sheet

**Format 4: Mini Card (400×200) — "Embed"** (new)
- Can be embedded on any website: `<iframe src="https://paste.trade/embed/{trade_id}" />`
- Shows: ticker, direction, PnL, caller handle, live price (updates automatically)
- Useful for newsletters, Substack, personal sites

### Card Variants by State:

**Active trade (still tracking):**
- Shows current PnL prominently
- "Live tracking" badge
- "Since call: X hours ago"

**Big winner (> +50%):**
- Special gold/fire visual treatment
- "🔥 +89.2%" in extra large text
- "Best call of the week" badge if applicable

**Loser (negative PnL):**
- Tastefully designed (not embarrassing but honest)
- "Currently -12.4%" in muted red
- "Still tracking" if within settlement window

**Resolved/closed:**
- "Final PnL: +19.4%"
- "Closed Jan 22, 2026"
- Lock icon

### New API endpoints:

```
GET /api/og/share/[tradeId]?format=square|landscape|story|embed
```

Extend the existing endpoint to support all 4 formats.

New embed endpoint:
```
GET /embed/[tradeId]     — returns an HTML iframe embed
```

### Share Flow (UI)

**On every trade card page (`/s/{tradeId}`):**

"Share" button → opens share sheet modal:
```
Share This Call
━━━━━━━━━━━━━━━━━

[Preview of the card]

Format: [Square] [Landscape] [Story]

[Copy Link]  [Tweet This]  [Download Image]

— or embed this card —
<iframe src="https://paste.trade/embed/..." />
[Copy Embed Code]
```

**Pre-filled tweet text:**
- For winners: "Called it 🔥 @zacxbt nailed BTC long +19.4% on @paste_trade — paste.trade/s/2c9a3094"
- For significant moves: "Still tracking: @handle's {ticker} {direction} call is currently {pnl}% — paste.trade/s/..."

**"Tweet My P&L" button:**
When a caller views their own profile, a sticky CTA at top:
"Share your stats → Tweet your win rate + best call"
Pre-fills: "My calls on paste.trade: 68% win rate, best call +340% on BTC 📊 paste.trade/zacxbt"

### Dynamic OG tags on trade pages:

When a `/s/{tradeId}` page is shared on Twitter, the preview shows:
```
title:   "zacxbt called BTC LONG · +19.4% since call"
image:   landscape format card (auto-generated)
desc:    "Entry $85,420 → Now $102,000. Called Jan 15 on Hyperliquid. Track any trade call on paste.trade"
```

The `og:image` should update over time as PnL changes (cache for 5 min, not forever).

### Viral loop design:
1. Caller posts a good call → paste.trade auto-tracks it
2. Call moves 20%+ → paste.trade sends notification (email or browser push): "Your BTC call is up 20%! Share it?"
3. Caller clicks → share sheet → tweets the card
4. New users click the tweet → land on paste.trade → paste their own calls
5. Repeat

**Notification trigger (stretch):**
- If a tracked call hits a milestone (+10%, +25%, +50%, +100%), send an email or browser push to the caller
- "Your BTC call is up 50% 🔥 Share your call"

### Files to read first:
- The existing `/api/og/share/` implementation — understand current card renderer
- `/types.ts` — TrackedTrade for all fields available in cards
- `/shared/pnl.ts` — PnL calculation for card display
- Any existing image generation library (Satori, html2canvas, Cloudflare Image Worker, or similar)

## Deliverable:
1. 4 card formats (square, landscape, story, embed) via `?format=` param
2. State-based variants (active/winner/loser/resolved) with distinct visual treatment
3. Share sheet modal on trade pages (copy link / tweet / download / embed code)
4. Pre-filled tweet text for winners
5. "Tweet My Stats" CTA on caller profiles
6. Dynamic OG meta tags on `/s/{tradeId}` pages (5-min cache)
7. Embeddable iframe card (`/embed/{tradeId}`)
