# Task 18: Build Embeddable Scorecard Widget

## Goal
Create an embeddable widget that anyone can put on their website or Twitter bio link (linktree, etc.) showing their live trade scorecard. This drives traffic back to paste.markets and gives traders a reason to link to us.

## Context

- OG images already generate static snapshots at `/api/og/author/[handle]`
- We need a live, embeddable HTML widget that updates
- Think: GitHub contribution graph embed, or shields.io badges

## What To Build

### 1. Widget endpoint

Create `src/app/api/widget/[handle]/route.ts`:

```typescript
GET /api/widget/frankdegods?theme=dark&style=full
GET /api/widget/frankdegods?style=badge
```

Returns an SVG (not HTML) that can be embedded anywhere via `<img>` tag.

**Full style** (400x200): Shows handle, win rate bar, avg P&L, total trades, streak.

**Badge style** (200x28): Compact shields.io-style badge: `@frankdegods | 73% WR | +14.2%`

Both should:
- Fetch live data from paste.trade API (or local DB)
- Render as SVG with inline styles (no external CSS)
- Set `Cache-Control: public, max-age=3600` (1 hour cache)
- Use the Bloomberg dark theme colors

### 2. Widget page

Create `src/app/widget/page.tsx`:

A page where users can generate their embed code:
- Input: enter your handle
- Preview: shows what the widget looks like (both styles)
- Copy buttons for:
  - HTML: `<img src="https://paste.markets/api/widget/{handle}" />`
  - Markdown: `![scorecard](https://paste.markets/api/widget/{handle})`
  - URL only: `https://paste.markets/api/widget/{handle}`

### 3. OG metadata

The widget page itself should have good metadata so people share it.

## Validation

1. `cd paste-dashboard && npx next build` — clean
2. `/api/widget/frankdegods` returns a valid SVG
3. `/api/widget/frankdegods?style=badge` returns compact badge
4. SVG renders correctly when embedded via `<img>` tag
5. Widget generator page works

## Do NOT

- Use `<iframe>` (SVG via `<img>` is simpler and works everywhere)
- Include JavaScript in the SVG (security risk, won't render in `<img>`)
- Skip the cache headers
