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
- **Language:** TypeScript (strict)
- **React:** 19
- **Styling:** Tailwind CSS v3
- **Font:** JetBrains Mono (Bloomberg terminal aesthetic)
- **Database:** Neon Postgres via `@neondatabase/serverless` (serverless HTTP driver)
- **AI:** Claude Haiku via `@anthropic-ai/sdk` (trade extraction)
- **OG Images:** `@vercel/og` (Satori) for dynamic image generation
- **Deploy:** Vercel

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
Auth: Bearer token via `PASTE_TRADE_KEY` env var

### Endpoints (known)
```
GET /api/search?author={handle}&top=7d&limit=50
GET /api/search?author={handle}&ticker={ticker}&top=7d
```

### Response shape (approximate — verify against real responses)
```typescript
interface PasteTradeResult {
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform?: string;
  pnlPct?: number;
  author_date?: string;
  posted_at: string;
  // ... possibly more fields
}
```

### API Key
Stored in `.env` as `PASTE_TRADE_KEY`. Never commit this.

## Folder Structure
```
paste-markets/
├── CLAUDE.md                    ← you are here
├── .env.example                 ← env var template (no secrets)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── src/
│   ├── app/                     ← 55 page routes
│   │   ├── layout.tsx           ← root layout, fonts, metadata
│   │   ├── page.tsx             ← landing / home feed
│   │   ├── globals.css
│   │   ├── leaderboard/         ← main leaderboard
│   │   ├── [author]/            ← author profile/scorecard
│   │   ├── caller/[handle]/     ← alternate caller profile
│   │   ├── callers/             ← caller directory
│   │   ├── vs/[a]/[b]/          ← head-to-head
│   │   ├── wrapped/[author]/    ← CT wrapped report card
│   │   ├── trade/               ← "What's The Trade?" tool
│   │   ├── asset/[ticker]/      ← per-asset pages
│   │   ├── alerts/              ← notification rules
│   │   ├── backtest/            ← historical simulation
│   │   ├── wagers/              ← wagering system
│   │   ├── positions/           ← live positions
│   │   ├── wall/                ← public trade feed
│   │   ├── fade/                ← contrarian signals
│   │   ├── circle/              ← caller circle generator
│   │   ├── signals/             ← live signals
│   │   ├── simulate/            ← paper trading
│   │   ├── predictions/         ← prediction markets
│   │   ├── consensus/           ← aggregated signals
│   │   ├── events/              ← market events
│   │   ├── audit/[handle]/      ← integrity verification
│   │   ├── scan/                ← AI trade scanner
│   │   ├── heatmap/             ← ticker heatmap
│   │   ├── feed/                ← trade feed
│   │   ├── discover/            ← discovery page
│   │   ├── developer/           ← API docs
│   │   ├── v1/                  ← public API v1
│   │   ├── v2/                  ← public API v2
│   │   └── api/                 ← 56 internal API routes
│   │       ├── author/[handle]/ ← author data
│   │       ├── leaderboard/     ← rankings
│   │       ├── vs/              ← head-to-head data
│   │       ├── wrapped/[author]/← wrapped data
│   │       ├── extract/         ← AI trade extraction
│   │       ├── trade/           ← trade submission
│   │       ├── asset/[ticker]/  ← asset data
│   │       ├── og/              ← 11+ OG image routes
│   │       ├── execute/         ← trade execution
│   │       ├── alerts/          ← alert management
│   │       ├── wager/           ← wager endpoints
│   │       └── ...              ← many more
│   ├── lib/                     ← 30+ modules
│   │   ├── paste-trade.ts       ← paste.trade API client
│   │   ├── db.ts                ← Neon Postgres connection + queries
│   │   ├── schema.sql           ← database schema
│   │   ├── metrics.ts           ← P&L / win-rate calculations
│   │   ├── badges.ts            ← achievement system
│   │   ├── reputation.ts        ← reputation scoring
│   │   ├── integrity.ts         ← call timing verification
│   │   ├── personalities.ts     ← wrapped personality types
│   │   ├── consensus.ts         ← aggregated signals
│   │   ├── alpha.ts             ← alpha detection
│   │   ├── api-auth.ts          ← API authentication
│   │   ├── execution/           ← execution engine
│   │   ├── backtest-processor.ts
│   │   ├── scan-processor.ts
│   │   ├── alert-matcher.ts
│   │   └── ...
│   └── components/              ← 53 components
│       ├── ui/                  ← shared primitives (card, nav, pnl-display, etc.)
│       ├── leaderboard-table.tsx
│       ├── scorecard.tsx
│       ├── trade-history.tsx
│       ├── head-to-head-card.tsx
│       ├── wrapped-card.tsx
│       ├── wrapped-story.tsx
│       ├── trade-finder.tsx
│       ├── pnl-chart.tsx
│       ├── reputation-badge.tsx
│       ├── integrity-badge.tsx
│       ├── prediction-stats.tsx
│       ├── venue-filter.tsx
│       ├── consensus-plays.tsx
│       ├── live-signal-card.tsx
│       ├── ticker-heatmap.tsx
│       ├── wall-grid.tsx
│       ├── wager-widget.tsx
│       └── ...
├── public/
│   └── fonts/
└── tasks/                       ← agent task prompts
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
PASTE_TRADE_KEY=       # paste.trade API bearer token
ANTHROPIC_API_KEY=     # for "What's The Trade?" AI feature (Claude Haiku)
DATABASE_URL=          # Neon Postgres connection string (required)
NEXT_PUBLIC_BASE_URL=  # for OG image URLs, defaults to localhost:3000
```

## Running
```bash
cd paste-dashboard
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run db:seed      # seed database with initial tracked authors
```

## Important Notes for Agents
1. **Working directory is `/workspaces/paste-markets/`**
2. **Read this CLAUDE.md first** before starting your task
3. **This is a mature codebase** — most features are already built. Check what exists before creating new files
4. **Use the design system colors/fonts** — consistency matters for the viral/shareable aspect
5. **Every public page needs OG metadata** — twitter cards are how this spreads
6. **Follow existing patterns** — look at similar existing pages/components before building new ones
7. **Forked from [rohunvora/paste-trade](https://github.com/rohunvora/paste-trade)** — the upstream repo is the data/API layer by Rohun Vora, launched by @frankdegods
