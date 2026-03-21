# Feature: Smart Feed & Home Page Discovery

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun, Cloudflare Workers, backend DB + JSONL. Existing search: `GET /api/search?top_performers=true`. Trade cards at `paste.trade/s/{trade_id}`. The site already has a source page (`/sources/{source_id}`) showing live extraction. This feature is about what the **home page and main feed** should look like.

Community quotes:
- "Just realized this is a perfect way to find good accounts and clean the slop from your feed" (@Oncha1nd)
- "The wallets connecting to this are way bigger than they look. Once the smart money starts using live PnL as social proof, small traders will follow fast." (@tonitrades_)
- "financialized doomscrolling" (@ghostbladexyz) — the goal

---

## What to Build

A Twitter-feed-style home page where the content is trade calls ranked by recency, performance, and caller quality. The feed should be immediately useful for someone who visits and has no account.

### Home Page Layout (`/`)

**Hero / Above the fold:**
- Tagline: "Turn any tweet into a trade. Track your calls forever."
- Input bar: "Paste a tweet URL, YouTube link, or article..." [Submit]
- Below input: live activity ticker — "zacxbt just called BTC long +18% | @feikuu called TRUMP on Polymarket..."

**Three-column layout (desktop), single column (mobile):**

Left sidebar — "Trending Now":
- Top 5 assets with most calls in last 24h
- Each shows: ticker, # calls today, avg PnL, sentiment (% long vs short)
- Clicking → `/assets/[ticker]`

Main feed (center):
- Infinite scroll of trade cards
- Default: "Hot" — sorted by a hotness score (see below)
- Tab switcher: Hot | New | Top (all time)

Right sidebar — "Top Callers":
- Top 5 callers by reputation score (from prompt 08)
- Each: avatar, handle, score tier badge, win rate
- "View All" → `/callers`

### Feed Ranking Algorithm ("Hot" tab):

Hotness score per trade (computed and cached every 15 min):
```
hotness = recency_weight * pnl_boost * integrity_bonus * caller_score_multiplier

recency_weight = 1 / (hours_since_published + 2)^1.5   // decays over time
pnl_boost = 1 + abs(since_published_move_pct) / 100     // higher PnL = more interesting
integrity_bonus = integrity == "live" ? 1.2 : 1.0       // live calls get a boost
caller_score_multiplier = 0.8 + (caller_reputation / 500)  // 0.8 to 1.0 based on score
```

- Newly posted calls start high, fade within 48h
- A call that's +50% PnL after 6 hours is boosted above a fresh +0% call
- Verified callers with high reputation scores surface more

### Individual Feed Card (trade card redesign):

Each card in the feed shows:
```
┌────────────────────────────────────────┐
│ 🟢 LONG  BTC  [Hyperliquid]    ⚡Alpha │
│ @zacxbt                2 hours ago    │
│                                        │
│ "BTC breaking $88k resistance,         │
│  targeting $95k on the weekly close"   │
│                                        │
│ Entry: $85,420  →  Now: $87,100       │
│ +2.0% since call  |  +18% since tweet │
│                                        │
│ [View Full Card]  [Back This Call] 💰  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 8 backers · 47 USDC wagered            │
└────────────────────────────────────────┘
```

Key elements:
- Direction badge (green LONG / red SHORT)
- Ticker + Platform badge
- Caller reputation tier badge
- @handle + time since posted
- Thesis quote (headline_quote field, ≤120 chars)
- Price at tweet vs current price (both PnL lenses)
- CTA: "View Full Card" → full trade page, "Back This Call" → wagering modal (if wager feature built)
- Wager stats if any

### Feed Tabs:

**"Hot"** — hotness algorithm above, refreshes every 15 min
**"New"** — purely chronological, last 50 trades posted
**"Top"** — sort by `since_published_move_pct` desc, sub-tabs: Today | Week | All Time

### Filters (persistent, saved in localStorage):
- Platform: All | Hyperliquid | Robinhood | Polymarket
- Direction: All | Long | Short
- Min Caller Score: 0 / 45 / 60 / 75 (slider or segmented control)
- Live calls only: toggle (excludes retroactive/historical)
- Asset: text input to filter feed to one ticker

### Real-time updates:
- When a new trade is posted, it appears at the top of "New" without a page refresh
- Use the existing WebSocket event system: listen for `trade_posted` events
- Show a "New trade posted by @handle" toast notification that, when clicked, scrolls to top of New tab

### Social proof elements:
- Below the hero input: "X trades tracked | X callers | X% avg win rate this week"
- Live stats, cached 5 min
- Rolling activity ticker (marquee-style) showing recent calls

### SEO / Share:
- Home page OG image: site-wide stats (total calls, avg win rate, top caller this week)
- Each trade card has its own OG image (already exists via `/api/og/share/{id}`)

### Files to read first:
- `/references/search-api.md` — `top_performers=true` param + all filter options
- `/references/events.md` — WebSocket events to listen for in the browser
- `/shared/pnl.ts` — for computing win/loss in hotness score
- `/types.ts` — TrackedTrade shape for card rendering

## Deliverable:
1. `GET /api/feed?tab=hot|new|top&platform=...&direction=...&minScore=...` endpoint
2. Hotness score computation + caching (Cloudflare KV, 15 min TTL)
3. Home page redesign: hero + three-column layout + infinite scroll feed
4. Trade card component (feed-optimized, compact version of full card)
5. Feed tab switcher (Hot / New / Top)
6. Filter panel (persistent in localStorage)
7. Real-time "new trade" toast via WebSocket
8. Global stats bar below hero ("X trades tracked | X callers | X% win rate")
9. "Trending Assets" left sidebar + "Top Callers" right sidebar
