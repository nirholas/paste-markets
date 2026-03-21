# paste-markets

## What This Is
A Next.js web dashboard built on the **paste.trade API** by @frankdegods. paste.trade tracks real P&L for crypto/stock/prediction-market calls made on Twitter (CT = Crypto Twitter). This dashboard makes that data useful, visual, and viral.

Forked from [rohunvora/paste-trade](https://github.com/rohunvora/paste-trade) — the open-source repo by Rohun Vora. We build the public-facing dashboard, leaderboards, scorecards, and viral sharing features on top of the paste.trade API.

**Product name:** paste.markets

## Core Features (all shipped)
1. **Leaderboard** — Rankings by win rate, avg P&L, total trades. Timeframe filters (24h/7d/30d/all), fade mode, streaks, venue filtering, ticker-specific boards
2. **Author Profile / Scorecard** — Trade history, P&L chart, badges, reputation score, integrity scoring, venue breakdown, prediction stats, fade score
3. **Head-to-Head** — 1v1 comparison across 6 dimensions, shared ticker analysis
4. **CT Wrapped / Report Card** — Personality archetypes, S-F grading (timing/conviction/consistency/risk), fun facts
5. **"What's The Trade?"** — Paste URL/headline → Claude Haiku extracts trades → routes to Robinhood/Hyperliquid/Polymarket
6. **OG Images** — Dynamic Twitter cards for every page type (11+ routes)
7. **Asset Pages** — Per-ticker view: sentiment, top callers, all calls, bull/bear ratio
8. **Public API** — V1 + V2 REST API with auth, rate limiting, pagination

## Extended Features (all shipped)
- **Alerts** — Rule-based notifications
- **Backtest** — Historical performance simulation
- **Wagers** — Tip-based wagering on calls
- **Execution** — Robinhood, Hyperliquid, Polymarket integration
- **Positions** — Live position tracking
- **Wall of Trades** — Public trade feed
- **Fade Trading** — Contrarian signal tracking
- **Circle Generator** — Top callers visualization
- **Live Signals** — Real-time trade alerts
- **Portfolio Simulation** — Paper trading
- **Caller Directory** — Browseable caller list
- **Predictions** — Dedicated prediction market tracking
- **Consensus Plays** — Aggregated trader signals
- **Events** — Market event calendar
- **Audit Trail** — Call integrity verification
- **Scanner** — AI-powered trade discovery
- **Telegram Bot** — Alert delivery
- **Widget System** — Embeddable caller widgets

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5.7 (strict)
- **React:** 19
- **Styling:** Tailwind CSS v3
- **Font:** JetBrains Mono (Bloomberg terminal aesthetic)
- **Database:** Neon Postgres via `@neondatabase/serverless` (serverless HTTP driver)
- **AI:** Claude Haiku via `@anthropic-ai/sdk` (trade extraction)
- **OG Images:** `@vercel/og` (Satori) for dynamic image generation
- **Browser Automation:** Playwright (tweet scraping)
- **Twitter:** `agent-twitter-client` + `xactions` (exchange data, tweet ingestion)
- **Blockchain:** `@solana/web3.js` + `@solana/spl-token` (wager settlement)
- **WebSocket:** `ws` (real-time updates from paste.trade)
- **Testing:** Vitest
- **Deploy:** Vercel (primary), Fly.io (alternate, with Dockerfile)

## Design System
Dark theme inspired by Bloomberg terminals. Consistent across all pages.

### Colors
```
Background:    #0a0a1a (near-black with blue tint)
Surface:       #0f0f22 (cards, table rows)
Border:        #1a1a2e (dividers, card borders)
Text Primary:  #f0f0f0
Text Secondary:#c8c8d0
Text Muted:    #555568
Green (win):   #2ecc71
Red (loss):    #e74c3c
Amber (neutral):#f39c12
Accent Blue:   #3b82f6
```

### Typography
```
Font:          JetBrains Mono, monospace
H1:            28px, weight 700, color #f0f0f0
H2:            20px, weight 700
Body:          14px, weight 400, color #c8c8d0
Label:         13px, weight 400, color #555568
Small/Caption: 11px, uppercase, letter-spacing 1px, color #555568
```

### Component Patterns
- Cards: bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6
- Tables: minimal borders, #0f0f22 alternating rows, #555568 headers
- Buttons: border border-[#1a1a2e] hover:border-[#3b82f6] transition
- P&L display: green (#2ecc71) for positive, red (#e74c3c) for negative, always show +/- sign
- Win rate bar: filled blocks █ and empty blocks ░ (like Bloomberg)

## paste.trade API
Base URL: `https://paste.trade`
Auth: Bearer token via `PASTE_TRADE_KEY` env var (for auth-required endpoints)

### Currently Used
We only call `GET /api/search` today. Everything else below is available but not yet wired up.

### Public Endpoints (No Auth)
```
GET /api/feed?sort=new&limit=20            — Live trade feed (items, next_cursor, total, prices)
GET /api/feed?sort=top&window=7d           — Top trades by P&L (includes pnls)
GET /api/trades                            — All trades, paginated
GET /api/trades/{id}                       — Full trade detail (thesis, derivation, chain_steps, horizon, live price)
GET /api/sources/{id}                      — Source page with all associated trades
GET /api/prices?ids=id1,id2                — Live prices for trade IDs (polled every 10s on their frontend)
GET /api/leaderboard?window=7d&sort=avg_pnl — Ranked authors (trade_count, avg_pnl, win_rate, best_ticker)
GET /api/stats                             — Platform-wide stats (users, total_trades, profitable_trades)
GET /api/og/share/{trade_id}?format=landscape — Share card images (1200x630 or 1080x1080)
GET /api/health                            — { ok: true }
```

### Auth-Required Endpoints
```
GET  /api/search?author={handle}&top=7d&limit=50  — Our current only call
POST /api/trades                           — Submit a trade (thesis, chain_steps, derivation)
POST /api/sources                          — Create source page from tweet URL
POST /api/sources/{id}/events              — Push live processing events to source page
POST /api/keys                             — Auto-provision API key (no auth needed!)
POST /api/auth/session-link                — Browser sign-in URL
POST /api/skill/route                      — Route/price a ticker across venues
POST /api/skill/discover                   — Instrument discovery (Hyperliquid, Polymarket)
```

### Search Params We're Not Using
```
q         — full-text search on theses (e.g., q=iran oil)
direction — filter long/short
platform  — filter by venue (hyperliquid, robinhood, polymarket)
cursor    — pagination (we're capped at limit=100)
top=24h   — we only use 7d/30d/90d/all
```

### WebSocket
```
wss://paste.trade/ws — Real-time new_trade and price_update events
```

### Biggest Integration Opportunities
1. `/api/feed` + `/api/prices` — power live, real-time trade feed with updating P&L
2. `/api/leaderboard` — official rankings instead of our own computation
3. `/api/trades/{id}` — rich trade detail pages with thesis, derivation, chain steps
4. `wss://paste.trade/ws` — real-time trade alerts without polling
5. `/api/skill/discover` + `/api/skill/route` — enhance "What's The Trade?" with real venue routing

### API Key
Stored in `.env` as `PASTE_TRADE_KEY`. Never commit this.

## Folder Structure
```
paste-markets/
├── CLAUDE.md                    ← you are here
├── .env.example                 ← env var template (no secrets)
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── Dockerfile                   ← Fly.io container build
├── fly.toml                     ← Fly.io deployment config
├── vitest.config.ts             ← test config
├── src/
│   ├── app/                     ← 59 page routes
│   │   ├── layout.tsx           ← root layout, fonts, metadata
│   │   ├── page.tsx             ← landing / home feed
│   │   ├── globals.css
│   │   ├── leaderboard/         ← main leaderboard + [ticker] + platform/[platform]
│   │   ├── [author]/            ← author profile/scorecard
│   │   ├── caller/[handle]/     ← alternate caller profile
│   │   ├── callers/             ← caller directory
│   │   ├── vs/[a]/[b]/          ← head-to-head
│   │   ├── compare/             ← comparison tool
│   │   ├── wrapped/[author]/    ← CT wrapped report card
│   │   ├── trade/               ← "What's The Trade?" tool + [id] detail
│   │   ├── submit/              ← trade submission + admin
│   │   ├── asset/[ticker]/      ← per-asset pages
│   │   ├── assets/              ← asset directory
│   │   ├── ticker/              ← ticker pages + [ticker]
│   │   ├── t/[ticker]/          ← short ticker URL
│   │   ├── alerts/              ← notification rules
│   │   ├── backtest/            ← historical simulation + [handle]
│   │   ├── wagers/              ← wagering system + leaderboard
│   │   ├── positions/           ← live positions
│   │   ├── portfolio/           ← portfolio view
│   │   ├── wall/                ← public trade feed + [id]
│   │   ├── fade/                ← contrarian signals + [handle]
│   │   ├── circle/              ← caller circle generator
│   │   ├── signals/             ← live signals + live/
│   │   ├── signal/              ← signal page
│   │   ├── simulate/            ← paper trading
│   │   ├── sim/[handle]/        ← per-handle simulation
│   │   ├── predictions/         ← prediction markets + sports + leaderboard
│   │   ├── markets/[source_id]/ ← market source pages
│   │   ├── consensus/           ← aggregated signals
│   │   ├── events/              ← market events + calendar + [id]
│   │   ├── audit/[handle]/      ← integrity verification
│   │   ├── scan/                ← AI trade scanner
│   │   ├── alpha/               ← alpha detection
│   │   ├── heatmap/             ← ticker heatmap
│   │   ├── feed/                ← trade feed
│   │   ├── discover/            ← discovery page
│   │   ├── today/               ← daily view
│   │   ├── source/[id]/         ← source pages
│   │   ├── join/                ← waitlist / join
│   │   ├── embed/               ← embeddable views + [handle]
│   │   ├── widget/              ← embeddable widget
│   │   ├── telegram/            ← Telegram bot info
│   │   ├── docs/                ← documentation
│   │   ├── developer/           ← API docs
│   │   ├── v1/                  ← public API v1
│   │   ├── v2/                  ← public API v2
│   │   └── api/                 ← 94 internal API routes
│   │       ├── author/[handle]/ ← author data
│   │       ├── caller/          ← caller data + [handle]/score + earnings
│   │       ├── callers/         ← caller directory
│   │       ├── leaderboard/     ← rankings
│   │       ├── vs/              ← head-to-head data
│   │       ├── wrapped/[author]/← wrapped data
│   │       ├── extract/         ← AI trade extraction + recent
│   │       ├── trade/           ← trade submission + [id]
│   │       ├── trades/          ← trade listing
│   │       ├── feed/            ← trade feed
│   │       ├── asset/[ticker]/  ← asset data
│   │       ├── assets/          ← asset directory + [ticker]
│   │       ├── ticker/          ← ticker data + [ticker]
│   │       ├── og/              ← 11+ OG image routes
│   │       ├── execute/         ← trade execution
│   │       ├── execution/       ← execution preflight
│   │       ├── alerts/          ← alert management (rules, feed, notifications)
│   │       ├── wager/           ← wager endpoints + settle
│   │       ├── wagers/          ← wager listing + leaderboard + quick
│   │       ├── positions/       ← positions + close + history
│   │       ├── predictions/     ← prediction data + sports
│   │       ├── fade/            ← fade data + [handle]
│   │       ├── backtest/        ← backtest jobs + reports
│   │       ├── scan/            ← scan jobs
│   │       ├── signals/         ← signal data + live
│   │       ├── events/          ← events + calendar + trending + track
│   │       ├── simulate/        ← simulation
│   │       ├── sim/[handle]/    ← per-handle sim
│   │       ├── circle/          ← caller circle
│   │       ├── consensus/       ← consensus data
│   │       ├── alpha/           ← alpha detection
│   │       ├── watchlist/       ← watchlist + stats
│   │       ├── wallet/          ← wallet connect + balances
│   │       ├── source/[id]/     ← source pages
│   │       ├── markets/         ← market source data
│   │       ├── search/          ← search proxy
│   │       ├── prices/          ← live prices
│   │       ├── trending/        ← trending data
│   │       ├── discover/        ← discovery
│   │       ├── nominate/        ← caller nominations + vote + admin
│   │       ├── join/            ← waitlist
│   │       ├── widget/[handle]/ ← embeddable widget data
│   │       ├── submit-trade/    ← trade submission
│   │       ├── sync/            ← data sync
│   │       ├── recap/           ← daily recap
│   │       ├── stats/           ← platform stats
│   │       ├── health/          ← health check
│   │       ├── live/            ← live updates
│   │       ├── stream/          ← event streaming
│   │       ├── badges/[handle]/ ← badge data
│   │       ├── heatmap/         ← heatmap data
│   │       ├── telegram/        ← Telegram webhook
│   │       ├── tweet-monitor/   ← tweet monitoring
│   │       └── cron/            ← cron jobs (audit, settle-wagers, telegram-alerts)
│   ├── lib/                     ← 54 modules
│   │   ├── paste-trade.ts       ← paste.trade API client
│   │   ├── db.ts                ← Neon Postgres connection + queries
│   │   ├── schema.sql           ← database schema
│   │   ├── metrics.ts           ← P&L / win-rate calculations
│   │   ├── badges.ts            ← achievement system
│   │   ├── compute-badges.ts    ← badge computation
│   │   ├── reputation.ts        ← reputation scoring
│   │   ├── integrity.ts         ← call timing verification
│   │   ├── personalities.ts     ← wrapped personality types
│   │   ├── consensus.ts         ← aggregated signals
│   │   ├── alpha.ts             ← alpha detection
│   │   ├── api-auth.ts          ← API authentication
│   │   ├── types.ts             ← shared type definitions
│   │   ├── data.ts              ← data utilities
│   │   ├── category.ts          ← ticker categorization
│   │   ├── venues.ts            ← venue definitions
│   │   ├── completeness.ts      ← data completeness scoring
│   │   ├── watchlist.ts         ← watchlist management
│   │   ├── execution/           ← execution engine (robinhood, hyperliquid, polymarket, positions, risk)
│   │   ├── execution-db.ts      ← execution data storage
│   │   ├── execution-db-init.ts ← execution DB init
│   │   ├── backtest-processor.ts← historical simulation
│   │   ├── backtest-db.ts       ← backtest data storage
│   │   ├── scan-processor.ts    ← AI scanner logic
│   │   ├── scan-db.ts           ← scan results storage
│   │   ├── alert-matcher.ts     ← alert rule matching
│   │   ├── alert-rules.ts       ← alert rule definitions
│   │   ├── trade-extractor.ts   ← Claude AI trade extraction
│   │   ├── recap-summary.ts     ← daily recap generation
│   │   ├── wager-db.ts          ← wager data storage
│   │   ├── upstream.ts          ← upstream API utilities
│   │   ├── sync.ts              ← data synchronization
│   │   ├── v1-response.ts       ← V1 API response format
│   │   ├── v2-response.ts       ← V2 API response format
│   │   ├── webhook-dispatch.ts  ← webhook routing
│   │   ├── ws-client.ts         ← WebSocket client
│   │   ├── ws-bridge.ts         ← WebSocket bridge
│   │   ├── use-paste-ws.ts      ← React hook for WebSocket
│   │   ├── use-event-stream.ts  ← event streaming hook
│   │   ├── twitter-http-client.ts← Twitter API client
│   │   ├── twitter-fetch.ts     ← Twitter data fetching
│   │   ├── twitter-auth.ts      ← Twitter authentication
│   │   ├── tweet-poller.ts      ← polling mechanism
│   │   ├── telegram-db.ts       ← Telegram integration DB
│   │   ├── telegram-format.ts   ← Telegram message formatting
│   │   ├── solana.ts            ← Solana integration
│   │   ├── wallet.ts            ← wallet utilities
│   │   ├── seed.ts              ← database seeding
│   │   ├── seed-from-api.ts     ← seed from API data
│   │   └── seed-wall.ts         ← seed wall data
│   └── components/              ← 58 components
│       ├── ui/                  ← shared primitives (card, nav, pnl-display, search-input, win-rate-bar)
│       ├── leaderboard-table.tsx
│       ├── scorecard.tsx
│       ├── trade-history.tsx
│       ├── head-to-head-card.tsx
│       ├── wrapped-card.tsx
│       ├── wrapped-story.tsx
│       ├── trade-finder.tsx
│       ├── trade-card.tsx
│       ├── trade-feed.tsx
│       ├── feed-card.tsx
│       ├── feed-client.tsx
│       ├── home-feed.tsx
│       ├── pnl-chart.tsx
│       ├── portfolio-chart.tsx
│       ├── radar-chart.tsx
│       ├── probability-bar.tsx
│       ├── conviction-meter.tsx
│       ├── reputation-badge.tsx
│       ├── integrity-badge.tsx
│       ├── audit-badge.tsx
│       ├── badge-card.tsx
│       ├── prediction-stats.tsx
│       ├── sports-pnl.tsx
│       ├── venue-filter.tsx
│       ├── venue-breakdown.tsx
│       ├── consensus-plays.tsx
│       ├── live-signal-card.tsx
│       ├── signals-client.tsx
│       ├── trade-ticker.tsx
│       ├── alpha-stream.tsx
│       ├── ticker-heatmap.tsx
│       ├── ticker-search.tsx
│       ├── asset-live-price.tsx
│       ├── wall-grid.tsx
│       ├── wager-widget.tsx
│       ├── wagers-client.tsx
│       ├── backer-strip.tsx
│       ├── double-down-popover.tsx
│       ├── daily-top-callers.tsx
│       ├── caller-circle-generator.tsx
│       ├── caller-selector.tsx
│       ├── backtest-client.tsx
│       ├── scanner-client.tsx
│       ├── whats-the-bet.tsx
│       ├── url-submitter.tsx
│       ├── search-bar.tsx
│       ├── smart-input.tsx
│       ├── sim-timeframe-selector.tsx
│       ├── notification-bell.tsx
│       ├── wallet-button.tsx
│       ├── follow-caller-button.tsx
│       └── execution/           ← execute-button, trade-confirm-modal
├── public/
│   ├── logo.svg
│   ├── apple-icon.svg
│   ├── demo.svg
│   ├── diagram-architecture.svg
│   ├── diagram-pipeline.svg
│   ├── diagram-flow.svg
│   └── fonts/
├── docs/
│   ├── DEPLOY.md                ← deployment runbook
│   └── specs/                   ← 13 feature specifications
├── references/                  ← API & integration reference docs
├── paste-markets-prompts/       ← feature prompt archive
└── tasks/                       ← agent task prompts (50+)
```

## Key Conventions
- All pages are server components by default. Use `"use client"` only when needed (interactivity).
- API routes return JSON. All data fetching goes through `/api/` routes.
- Use `fetch()` from server components to call own API routes during SSR, or call lib functions directly.
- P&L always displayed with sign: `+12.3%` or `-5.1%`
- Dates formatted as "Mar 12" or "2026-03-12" depending on context.
- Handles displayed as `@frankdegods` (with @).
- All user input sanitized before display.
- No emoji in code or UI unless explicitly part of the design.

## Environment Variables
```
# Core (required)
PASTE_TRADE_KEY=              # paste.trade API bearer token
DATABASE_URL=                 # Neon Postgres connection string
NEXT_PUBLIC_BASE_URL=         # base URL for OG images, defaults to localhost:3000

# AI
ANTHROPIC_API_KEY=            # Claude API key for "What's The Trade?" feature

# Twitter / X
TWITTER_AUTH_TOKEN=           # auth_token cookie from x.com
TWITTER_CT0=                  # ct0 CSRF cookie from x.com
PROXY_URL=                    # optional rotating proxy
XACTIONS_SESSION_COOKIE=      # auth_token for xactions Puppeteer fallback

# Telegram Bot
TELEGRAM_BOT_TOKEN=           # Bot token from @BotFather
TELEGRAM_WEBHOOK_SECRET=      # webhook secret token
TELEGRAM_CHANNEL_ID=          # channel for auto-posting trades

# Solana (wager system)
SOLANA_RPC_URL=               # Solana RPC endpoint
SOLANA_PROGRAM_ID=            # paste_wager program ID
WAGER_VAULT_ADDRESS=          # treasury address (server-side)
TREASURY_PRIVATE_KEY=         # settlement keypair (server-side)
NEXT_PUBLIC_WAGER_VAULT_ADDRESS= # treasury address (client-side)
NEXT_PUBLIC_SOLANA_RPC_URL=   # client-side RPC endpoint

# Infrastructure
CRON_SECRET=                  # bearer token for /api/cron/* endpoints
PT_API_KEYS=                  # pre-seeded public API keys
```

## Running
```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run db:seed      # seed database with initial tracked authors
npm run db:sync      # sync data from paste.trade API
npm run lint         # ESLint
```

## Important Notes for Agents
1. **Working directory is `/workspaces/paste-markets/`**
2. **Read this CLAUDE.md first** before starting your task
3. **This is a mature codebase** — most features are already built. Check what exists before creating new files
4. **Use the design system colors/fonts** — consistency matters for the viral/shareable aspect
5. **Every public page needs OG metadata** — twitter cards are how this spreads
6. **Follow existing patterns** — look at similar existing pages/components before building new ones
7. **Forked from [rohunvora/paste-trade](https://github.com/rohunvora/paste-trade)** — the upstream repo is the data/API layer by Rohun Vora, launched by @frankdegods
