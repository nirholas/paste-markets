# Task 21: Shareable Quote Cards

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Generate beautiful, shareable image cards from individual tweet reactions. Users and the team can share these on Twitter to drive organic growth. Think "testimonial cards" but with the Bloomberg terminal aesthetic.

## Context
We have ~240 hype replies to frankdegods' paste.trade announcement. Each one is a potential shareable asset. A card showing "@cryptotrader99: this is the most insane tool I've ever seen" with paste.markets branding drives curiosity clicks.

## Steps

### 1. OG image route for quote cards
Create `src/app/api/og/quote/[id]/route.tsx` using `@vercel/og` (Satori):

Card layout (1200x630):
- Dark background (#0a0a1a)
- Left side: large quote marks, tweet text in JetBrains Mono (white, 28px)
- Below quote: @handle + avatar + timestamp
- Right side or bottom: paste.markets logo + tagline
- Subtle grid/scanline overlay for Bloomberg feel
- Green accent line on left border

### 2. Quote card page
Create `src/app/wall/[id]/page.tsx`:
- Full-screen view of a single reaction
- The tweet text prominently displayed
- "Share this" button that copies the URL
- OG tags pointing to the quote card image
- Link back to /wall

### 3. Batch generation endpoint
Create `src/app/api/wall/export/route.ts`:
- `GET /api/wall/export?featured=true` — returns URLs for all featured quote card images
- Useful for bulk downloading cards to post on Twitter

### 4. Design details
- Card background: gradient from #0a0a1a to #0f0f22
- Quote marks: large, #3b82f6 (accent blue), 60px
- Tweet text: #f0f0f0, JetBrains Mono, 24-28px depending on length
- Handle: #555568, 16px
- Brand bar at bottom: paste.markets logo, #2ecc71 accent
- Border: 1px solid #1a1a2e with subtle #3b82f6 glow
