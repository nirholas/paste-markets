# Task 40: Landing Page Revamp

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Redesign the landing page (`/`) to convert visitors into users. Current landing page exists but needs to showcase the full product. First impression determines if someone stays or bounces.

## Steps

### 1. Hero section
Update `src/app/page.tsx`:

Hero:
- Animated headline: "Paste a source. AI finds the trade. P&L tracks from there."
- Subtext: "The only platform that turns tweets into tracked trades with real P&L."
- CTA button: "Try it now →" (links to /trade)
- Secondary CTA: "See the leaderboard" (links to /leaderboard)
- Background: subtle animated grid or particle effect (CSS only, no heavy libs)

### 2. Social proof strip
Below hero:
- Scrolling ticker of real stats: "247 callers tracked · 1,892 trades · 67% avg win rate"
- Or pull from the social proof wall (Task 20)
- Logos/icons: Robinhood, Hyperliquid, Polymarket

### 3. Feature showcase
3 feature cards in a row:
1. **Track Any Caller** — "Paste a tweet. We track the P&L." + mini demo animation
2. **Real Win Rates** — "No cherry-picking. Every call counted." + mini leaderboard preview
3. **AI Trade Finder** — "Drop a URL. AI finds the optimal trade." + input preview

### 4. Live activity feed
Small section showing recent trades in real-time:
- Last 5 trades, auto-updating
- Creates sense of activity and FOMO
- Links to /live for full feed

### 5. How it works
3-step visual (reuse diagram-pipeline.svg or simplify):
1. Paste a source (tweet, article, YouTube)
2. AI extracts the trade
3. P&L tracks automatically

### 6. CTA footer
- "Join the leaderboard" or "Start tracking" button
- Links to /join (waitlist) or /trade
- "Built on paste.trade by @frankdegods" credit

### 7. Design
- Full Bloomberg dark theme
- Hero: large text, generous whitespace
- Smooth scroll between sections
- Entrance animations (fade up) as sections come into view
- Mobile-first responsive
- Fast: no heavy images, CSS animations only
