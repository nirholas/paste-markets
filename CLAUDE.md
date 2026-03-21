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
paste-dashboard/
├── CLAUDE.md                    ← you are here
├── .env.example                 ← env var template (no secrets)
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── src/
│   ├── app/
│   │   ├── layout.tsx           ← root layout, fonts, metadata
│   │   ├── page.tsx             ← landing page
│   │   ├── globals.css          ← tailwind imports + custom styles
│   │   ├── leaderboard/
│   │   │   └── page.tsx
│   │   ├── [author]/
│   │   │   └── page.tsx         ← author profile/scorecard
│   │   ├── vs/
│   │   │   └── [a]/
│   │   │       └── [b]/
│   │   │           └── page.tsx ← head-to-head
│   │   ├── wrapped/
│   │   │   └── [author]/
│   │   │       └── page.tsx     ← CT wrapped report card
│   │   ├── trade/
│   │   │   └── page.tsx         ← "What's The Trade?" tool
│   │   └── api/
│   │       ├── author/
│   │       │   └── [handle]/
│   │       │       └── route.ts
│   │       ├── leaderboard/
│   │       │   └── route.ts
│   │       ├── vs/
│   │       │   └── route.ts
│   │       ├── wrapped/
│   │       │   └── [author]/
│   │       │       └── route.ts
│   │       ├── trade/
│   │       │   └── route.ts
│   │       └── og/
│   │           └── [...slug]/
│   │               └── route.tsx  ← dynamic OG image generation
│   ├── lib/
│   │   ├── paste-trade.ts       ← API client
│   │   ├── db.ts                ← Neon Postgres connection + queries
│   │   ├── schema.sql           ← database schema
│   │   ├── metrics.ts           ← shared P&L / win-rate calculations
│   │   └── constants.ts         ← colors, labels, config
│   ├── components/
│   │   ├── ui/                  ← shared UI primitives
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── win-rate-bar.tsx
│   │   │   ├── pnl-display.tsx
│   │   │   ├── search-input.tsx
│   │   │   └── nav.tsx
│   │   ├── leaderboard-table.tsx
│   │   ├── scorecard.tsx
│   │   ├── trade-history.tsx
│   │   ├── head-to-head-card.tsx
│   │   ├── wrapped-card.tsx
│   │   └── trade-finder.tsx
│   └── data/
│       └── (database is remote Neon Postgres)
├── public/
│   └── fonts/
│       └── JetBrainsMono-*.woff2
└── tasks/                       ← agent task prompts (this folder)
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
1. **Build everything inside `/workspaces/agent-payments-sdk/paste-dashboard/`** — this will be pushed as a standalone repo
2. **Read this CLAUDE.md first** before starting your task
3. **Follow the folder structure above exactly** — multiple agents are building in parallel
4. **Use the design system colors/fonts** — consistency matters for the viral/shareable aspect
5. **Every public page needs OG metadata** — twitter cards are how this spreads
6. If your task depends on another task's output (like the API client), write your code to import from the expected path — the other agent will create it
7. Reference `/workspaces/agent-payments-sdk/xactions/src/scorecard.ts` for visual inspiration — that's the existing Bloomberg-style scorecard HTML
