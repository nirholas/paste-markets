<p align="center">
  <img src="public/logo.svg" alt="paste.markets" width="100%" />
</p>

<p align="center">
  <b>Paste a source. AI finds the trade. P&L tracks from there.</b>
</p>

<p align="center">
  <a href="https://paste.markets">Live</a> · <a href="https://github.com/rohunvora/paste-trade">Upstream</a> · <a href="https://x.com/frankdegods">@frankdegods</a>
</p>

---

## How it works

Drop a tweet, article, YouTube video, or just type a thesis. The pipeline reads the source, extracts tradeable ideas, researches instruments across stocks, perps, and prediction markets -- then locks the price and publishes a trade card.

<p align="center">
  <img src="public/diagram-pipeline.svg" alt="Processing pipeline" width="800" />
</p>

Every trade gets two timestamps:
- **Author price** -- when the source was originally published
- **Paste price** -- when it entered paste.markets

The gap is the head-start the author had before the market knew.

---

## Source to Trade Card

<p align="center">
  <img src="public/diagram-flow.svg" alt="Source to trade card" width="800" />
</p>

---

## Architecture

<p align="center">
  <img src="public/diagram-architecture.svg" alt="Skill to platform" width="800" />
</p>

The skill runs inside your agent (Claude Code, Codex, OpenClaw). paste.markets is the public layer -- it tracks P&L, streams progress live, publishes trade cards, and saves everything to the caller's profile.

---

## Quickstart

```
https://github.com/nirholas/paste-markets
```

Paste the repo URL into your agent, then:

```
/trade https://x.com/someone/status/123456789
/trade NVDA earnings beat but guidance was light, short the pop
/trade update
```

---

## Features

### Core

| Feature | What it does |
|---------|-------------|
| **Leaderboard** | CT traders ranked by win rate, avg P&L, total trades. Timeframe filters (24h/7d/30d/all), fade mode, streaks, venue filtering, ticker-specific boards |
| **Caller Profiles** | Full trade history, P&L chart, badges, reputation score, integrity scoring, venue breakdown, prediction stats |
| **Head-to-Head** | 1v1 comparison across 6 dimensions, shared ticker analysis |
| **CT Wrapped** | Spotify-style personality archetypes, S-F grading (timing/conviction/consistency/risk), fun facts |
| **Trade Finder** | Paste any URL or type a thesis -- AI extracts trades and routes to Robinhood/Hyperliquid/Polymarket |
| **Asset Pages** | Per-ticker view: sentiment, top callers, all calls, bull/bear ratio |
| **OG Images** | Dynamic Twitter cards for every page type (11+ routes) |
| **Public API** | V1 + V2 REST API with auth, rate limiting, pagination |

### Extended

| Feature | What it does |
|---------|-------------|
| **Alerts** | Rule-based notifications with Telegram delivery |
| **Backtest** | Historical performance simulation per caller |
| **Wagers** | Tip-based wagering on calls with Solana settlement |
| **Execution** | Robinhood, Hyperliquid, Polymarket integration with risk management |
| **Positions** | Live position tracking with P&L |
| **Wall of Trades** | Public social proof trade feed |
| **Fade Trading** | Contrarian signal tracking per caller |
| **Caller Circle** | Twitter Circle-style visualization of top callers |
| **Live Signals** | Real-time trade alerts via WebSocket |
| **Portfolio Simulation** | Paper trading with historical replay |
| **Caller Directory** | Browseable caller list with search |
| **Predictions** | Prediction market tracking including sports |
| **Consensus Plays** | Aggregated trader signals across callers |
| **Events** | Market event calendar with tracking |
| **Audit Trail** | Call integrity and timestamp verification |
| **Scanner** | AI-powered trade discovery |
| **Telegram Bot** | Alert delivery and trade notifications |
| **Widget System** | Embeddable caller widgets for external sites |
| **Alpha Detection** | Automated alpha signal identification |
| **Watchlist** | Follow callers and track their new trades |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.7 (strict) |
| UI | React 19, Tailwind CSS v3 |
| Database | Neon Postgres (`@neondatabase/serverless`) |
| AI | Claude Haiku (`@anthropic-ai/sdk`) |
| OG Images | `@vercel/og` (Satori) |
| Browser | Playwright (tweet scraping) |
| Twitter | `agent-twitter-client`, `xactions` |
| Blockchain | `@solana/web3.js` (wager settlement) |
| Real-time | WebSocket (`ws`) |
| Testing | Vitest |
| Deploy | Vercel (primary), Fly.io (alternate) |

---

## API

Open. No auth required for reads.

```
GET /api/feed?sort=new&limit=20           -- live trade feed
GET /api/feed?sort=top&window=7d          -- top trades by P&L
GET /api/search?author={handle}&top=30d   -- author trades
GET /api/search?ticker=NVDA               -- ticker trades
GET /api/leaderboard?timeframe=30d&sort=win_rate
GET /api/author/{handle}                  -- author profile data
GET /api/trades                           -- all trades, paginated
GET /api/trades/{id}                      -- full trade detail
GET /api/asset/{ticker}                   -- asset data
GET /api/circle?timeframe=30d             -- top callers
GET /api/wrapped/{handle}                 -- CT wrapped data
GET /api/vs?a={handle}&b={handle}         -- head-to-head
GET /api/stats                            -- platform-wide stats
GET /api/health                           -- health check
```

See [developer docs](/developer) for full API reference including V1/V2 endpoints.

---

## Sources & Venues

```
sources:   tweets . youtube . podcasts . articles . PDFs . screenshots . typed theses
venues:    Robinhood (stocks) . Hyperliquid (perps) . Polymarket (prediction markets)
agents:    Claude Code . Codex . OpenClaw
```

---

## Setup

```bash
cp .env.example .env   # fill in your keys
npm install
npm run dev            # http://localhost:3000
```

Required env vars: `PASTE_TRADE_KEY`, `DATABASE_URL`. See [.env.example](.env.example) for all options.

---

## Project Stats

| | Count |
|---|---|
| Page routes | 59 |
| API routes | 94 |
| Components | 58 |
| Lib modules | 54 |

---

## Docs

| File | Description |
|------|-------------|
| [SKILL.md](SKILL.md) | Skill commands and how `/trade` works |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Internal pipeline architecture |
| [CLAUDE.md](CLAUDE.md) | Agent context, design system, and codebase reference |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Fly.io deployment runbook |

---

## Credits

Built on [paste.trade](https://paste.trade) by [@frankdegods](https://x.com/frankdegods).

Dashboard by [@nichxbt](https://x.com/nichxbt).
