# Task 23: Caller Circle Visualization

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/circle` page — a visual "Twitter Circle" style diagram showing the top callers in the paste.markets ecosystem. Think concentric rings: best performers in the center, arranged by win rate and volume. Highly shareable.

## Context
Multiple replies mentioned wanting to see who the best callers are. A visual circle (like Spotify's artist circles or Twitter's close friends) makes this instantly graspable and shareable.

## Steps

### 1. API route
Create `src/app/api/circle/route.ts`:
- `GET /api/circle?timeframe=30d&limit=50`
- Fetches leaderboard data from existing `/api/leaderboard` or directly from db
- Returns callers with: handle, avatar_url, win_rate, total_trades, avg_pnl, tier
- Tier calculation: inner (top 5), middle (6-15), outer (16-50)

### 2. Build the page
Create `src/app/circle/page.tsx`:

Visual layout:
- Large circular visualization (SVG or Canvas)
- 3 concentric rings:
  - **Inner ring** (gold border): Top 5 callers — large avatars with handles
  - **Middle ring** (blue border): #6-15 — medium avatars
  - **Outer ring** (dim border): #16-50 — small avatars
- Each avatar is clickable → links to `/[author]` profile page
- Hover shows: handle, win rate, avg P&L
- Center: paste.markets logo or "Top 50" label
- Timeframe selector: 7d / 30d / All time

### 3. Implementation approach
Use SVG for the visualization (works better for OG images):
- Calculate positions using polar coordinates
- Avatars as `<image>` elements in SVG circles
- Smooth hover animations with CSS transitions
- Responsive: scales down on mobile, maybe switches to list view on very small screens

### 4. Design
- Background: #0a0a1a
- Ring borders: inner=#f39c12 (gold), middle=#3b82f6 (blue), outer=#1a1a2e (dim)
- Avatar borders match ring color
- Connecting lines between rings (subtle, #1a1a2e)
- Stats tooltip: dark card with win rate in green/red

### 5. OG image
Create `src/app/api/og/circle/route.tsx`:
- Shows the circle visualization as a static image
- Title: "paste.markets Caller Circle"
- Subtitle: "Top 50 traders by win rate"

### 6. Fallback for no-JS / loading
- Server-render a simple ranked list as fallback
- Loading skeleton: pulsing concentric circles
