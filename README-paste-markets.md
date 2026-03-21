# paste.trade

> Paste a source. AI finds the trade, captures the price from when the author said it, tracks P&L from there.

Open source. The live platform is at [paste.trade](https://paste.trade).

---

## Why this exists

You can already ask AI "what's the trade here?" and get a decent answer. Then you close the tab and it's gone.

paste.trade is built to fix that: extract the thesis, lock the price, publish it, and let the market decide if it was right.

---

## What it does

```
 source                         trade card
┌─────────────────────┐       ┌──────────────────────────────────┐
│ @kansasangus         │       │ @kansasangus · Mar 18, 2026      │
│                      │       │                                  │
│ "Cow/calf markets    │       │ "Cow/calf is just beginning      │
│  beginning to get    │  ──>  │  to get wild"                    │
│  wild"               │       │                                  │
│                      │       │  1  Severe drought across        │
│                      │       │     Southern Plains              │
│                      │       │  2  Herd liquidation + strike    │
│                      │       │     shrink supply                │
│                      │       │  3  DBA holds cattle & grain     │
│                      │       │     exposed to same drought      │
│                      │       │                                  │
│                      │       │  DBA  LONG           +0.3%       │
│                      │       │  $26.88 → $26.97     1 day ago   │
└─────────────────────┘       └──────────────────────────────────┘
```

Two timestamps on every trade:
- **author price** — the moment the source was originally published (extracted from source metadata, not when you ran `/trade`)
- **paste price** — the moment it entered paste.trade

This distinction matters. It's the difference between "I called this" and "I called this before it moved."

---

## How it works

```
paste a URL or type a thesis
    │
    ▼
read the source ── tweet, video, article, PDF, screenshot
    │
    ▼
find tradeable ideas ── 1 to 5 per source
    │
    ▼
research each one ── web search, instrument discovery
    │
 ┌──┼──┐
 ▼  ▼  ▼
compare candidates ── stocks, perps, prediction markets
 └──┼──┘
    │
    ▼
pick best fit, explain why, lock price
    │
    ▼
post to paste.trade ── P&L tracks from here
```

---

## Quickstart

Paste the repo URL into Claude Code, Codex, or OpenClaw:

```
https://github.com/nirholas/paste-markets
```

Then run:

```
/trade https://x.com/someone/status/123456789
/trade NVDA earnings beat but guidance was light, short the pop
/trade update
```

That's it. No configuration required for the skill itself.

---

## API

The API is open. No auth required for reads.

```
GET https://paste.trade/api/search?author={handle}
GET https://paste.trade/api/search?author={handle}&top=7d
GET https://paste.trade/api/search?ticker=NVDA
```

| Param    | Values                  | Default |
|----------|-------------------------|---------|
| `author` | Twitter handle          | —       |
| `ticker` | ticker symbol           | —       |
| `top`    | `7d`, `30d`, `90d`, `all` | `all`   |
| `limit`  | integer                 | 50      |

Response shape:

```json
[
  {
    "ticker": "DBA",
    "direction": "long",
    "pnl_pct": 0.3,
    "entry_price": 26.88,
    "current_price": 26.97,
    "author_date": "2026-03-18T14:22:00Z",
    "posted_at": "2026-03-18T16:05:00Z",
    "source_url": "https://x.com/kansasangus/status/..."
  }
]
```

---

## Build on top of it

The API is designed to be built on. Here's what's already been built:

### [paste.rank](https://github.com/nirholas/paste-markets)

A full leaderboard dashboard on top of the paste.trade API:

- **Leaderboard** — CT traders ranked by real win rate and avg P&L
- **Author Scorecards** — full trade history, best call, win rate bar
- **Head-to-Head** — 1v1 any two traders
- **CT Wrapped** — Spotify-style trading report cards
- **Caller Circle** — Twitter Circle-style visualization of top callers, shareable PNG
- **What's the Trade?** — paste any URL, AI finds the trade

```
GET /api/author/{handle}
GET /api/leaderboard?timeframe=30d&sort=win_rate
GET /api/circle?timeframe=30d
```

Built with Next.js. Dark Bloomberg terminal aesthetic. Everything server-rendered and cacheable.

---

## Why it's built this way

Claude Code and OpenClaw are the tools we use every day. Making it `/trade [anything]` means zero friction — you're one command away from a tracked trade from any source.

```
┌─────────────────────────┐      ┌─────────────────────────────┐
│  the skill               │      │  paste.trade                 │
│                          │      │                              │
│  reads sources           │ ───> │  tracks P&L                  │
│  extracts theses         │ ───> │  streams progress live       │
│  researches instruments  │ ───> │  explains reasoning          │
│  explains reasoning      │ ───> │  publishes trade cards       │
│                          │      │  saves to your profile       │
│  runs in your agent      │      │                              │
└─────────────────────────┘      └─────────────────────────────┘
```

---

## Works with

```
sources:   tweets · youtube · podcasts · articles · PDFs · screenshots · typed theses
venues:    Robinhood (stocks) · Hyperliquid (perps) · Polymarket (prediction markets)
agents:    Claude Code · Codex · OpenClaw
```

---

## Prerequisites

- [Bun](https://bun.sh)
- `yt-dlp` for YouTube (skill will offer to install on first run)
- Copy [env.example](env.example) to `.env` and fill in your keys

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the skill pipeline works, how author timestamps are extracted, and how venue selection logic operates.

---

## Links

[paste.trade](https://paste.trade) · [ARCHITECTURE.md](ARCHITECTURE.md) · [Changelog](https://paste.trade/#changelog) · [@frankdegods](https://x.com/frankdegods)
