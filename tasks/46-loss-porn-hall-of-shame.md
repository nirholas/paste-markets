# Task 46: Loss Porn / Hall of Shame

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/hall-of-shame` page showcasing the worst trades on the platform. CT loves loss porn. The worst calls get as much engagement as the best calls — sometimes more. This is the anti-leaderboard.

## Steps

### 1. API route
Create `src/app/api/shame/route.ts`:
- `GET /api/shame?timeframe=30d&limit=20`
- Returns trades sorted by worst P&L (most negative first)
- Includes: handle, ticker, direction, entry price, current/exit price, P&L %, posted_at

### 2. Build the page
Create `src/app/hall-of-shame/page.tsx`:

Layout:
- Header: "Hall of Shame" (or "The Worst Calls on CT")
- Subtitle: "These trades didn't age well."
- Timeframe selector: 7d / 30d / All time
- List of worst trades, styled dramatically:
  ```
  #1 BIGGEST L
  @degen_trader → LONG $LUNA
  Entry: $80.00 → Current: $0.02
  P&L: -99.97%
  Called: Feb 14, 2026
  ```
- Each trade card: oversized P&L in red, details below
- "Worst Caller of the Month" spotlight section

### 3. Shame card component
Create `src/components/shame-card.tsx`:
- Big red P&L number (#e74c3c), glowing text effect
- Skull or coffin icon (CSS, not emoji)
- Caller handle + trade details
- "How it started vs how it's going" — entry price vs current
- Rank number (with red/dark gradient background)

### 4. Stats section
Aggregate "shame stats":
- Total losses tracked
- Average worst-trade P&L
- Most frequently shamed caller
- "The Absolute Worst Call Ever" (all-time biggest L)

### 5. OG image
Create `src/app/api/og/shame/route.tsx`:
- Dark, dramatic card
- "#1 Worst Call" + trade details
- Red glow aesthetic
- paste.markets branding

### 6. Design
- Darker than normal pages (#050510 bg)
- Red (#e74c3c) as primary accent everywhere
- P&L numbers: extra large, red, slight glow/text-shadow
- Rank numbers: huge, faded in background
- Slightly apocalyptic feel — this is entertainment
- Responsive: single column on mobile
