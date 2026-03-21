# paste-dashboard

## What This Is
A Next.js web dashboard built on the **paste.trade API** by @frankdegods. paste.trade tracks real P&L for crypto/stock/prediction-market calls made on Twitter (CT = Crypto Twitter). This dashboard makes that data useful, visual, and viral.

**Working product name:** paste.markets (can be changed later)

## Core Features
1. **Leaderboard** — Public rankings of CT traders by real P&L performance
2. **Author Profile / Scorecard** — Individual pages with full trade history + visual scorecard
3. **Head-to-Head** — 1v1 comparison of two traders
4. **CT Wrapped / Report Card** — Spotify-Wrapped-style shareable trading personality cards
5. **"What's The Trade?"** — Paste any news URL/headline → AI finds the optimal trade
6. **OG Images** — Dynamic twitter card images for every page (sharing is the growth engine)

## Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v3
- **Font:** JetBrains Mono (Bloomberg terminal aesthetic)
- **Database:** Neon Postgres via `@neondatabase/serverless` (serverless HTTP driver)
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
