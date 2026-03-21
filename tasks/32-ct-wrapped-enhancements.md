# Task 32: CT Wrapped Enhancements (Spotify-Style Shareable Cards)

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Enhance the existing CT Wrapped page (`/wrapped/[author]`) to be more viral and shareable. The current version exists but needs more personality types, better visuals, and multi-slide story format like Spotify Wrapped.

## Context
This is the #1 growth feature. If a caller shares their Wrapped card on Twitter, every follower sees it and wants their own. The tweet replies show massive appetite for personality-based content.

## Steps

### 1. Expand personality types
Update personality assignment in `src/lib/metrics.ts` or create `src/lib/personalities.ts`:

Personalities (assigned based on trading patterns):
- **The Sniper** — high win rate, few trades, precise entries
- **The Degen** — many trades, high frequency, loves perps
- **Diamond Hands** — long hold times, rarely sells early
- **The Flipper** — quick in and out, short hold times
- **The Contrarian** — frequently takes opposite side of consensus
- **The Whale** — biggest P&L swings, high conviction
- **The Grinder** — consistent small wins, low variance
- **The YOLO** — concentrated bets, all-or-nothing
- **The Analyst** — trades across all venues, diversified
- **The Faded** — consistently wrong, valuable as a fade signal

Each personality needs: name, description, color, and 2-3 stat triggers.

### 2. Multi-slide story format
Update `src/app/wrapped/[author]/page.tsx`:

Create a swipeable/clickable story with 5 slides:
1. **Intro**: "@handle's CT Wrapped" with animated entrance
2. **Volume**: "You made X trades across Y tickers"
3. **Best Trade**: "Your best call: LONG $NVDA +47.2%" with chart
4. **Personality**: "You're a [Sniper]" with description + stats that earned it
5. **Final Card**: Summary stats + shareable card + "Get yours" CTA

### 3. Story component
Create `src/components/wrapped-story.tsx` (client component):
- Full-screen slides with swipe/click navigation
- Progress dots at top (like Instagram stories)
- Auto-advance option (5 seconds per slide)
- Each slide has entrance animation (fade/slide up)
- Background gradients that change per slide

### 4. OG images per slide
Update OG route for wrapped:
- Default OG shows the personality card (slide 4)
- Support `?slide=N` for sharing specific slides
- Each OG card: 1200x630, dark bg, bold stat, personality icon

### 5. "Get yours" viral loop
On the final slide:
- Big CTA: "Get your CT Wrapped → paste.markets/wrapped"
- Input field to type any @handle
- Auto-generates for any tracked caller
- If not tracked: "We don't have data for @handle yet. Submit them to the leaderboard."

### 6. Design
- Each personality gets a unique gradient/color scheme
- Sniper: dark blue + gold
- Degen: neon green + dark
- Diamond Hands: blue + silver sparkle
- Large typography, minimal text per slide
- Animated numbers counting up
