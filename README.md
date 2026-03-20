# paste.trade

Paste a source. AI finds the trade, captures the price when the author said it, tracks P&L from there.

Open source. [paste.trade](https://paste.trade) is where the trades live.

## Why this exists

You can already ask AI "what's the trade here?" and get a decent answer. Then you close the tab and it's gone.

Paste.trade is designed to improve the answers and track them against the market.


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

Two prices on every trade:
- **author price**: the moment the source was actually published (skill extracts this from source)
- **paste price**: the moment it's uploaded to paste.trade

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

## Why it's built this way

Claude Code and OpenClaw are the tools we use everyday. So, making it as simple as "/trade [anything]" makes it the easiest path to use this.

```
┌─────────────────────────┐      ┌─────────────────────────────┐
│  the skill               │      │  paste.trade                 │
│                          │      │                              │
│  reads sources           │ ───> │  tracks P&L                  │
│  extracts theses         │ ───> │  streams progress live       │
│  researches instruments  │ ───> │  publishes trade cards       │
│  explains reasoning      │ ───> │  saves to your profile       │
│                          │      │                              │
│  runs in your agent      │      │  sharable link               │
└─────────────────────────┘      └─────────────────────────────┘
```

## Install

Paste into Claude Code, Codex, or OpenClaw:

```
https://github.com/rohunvora/paste-trade
```

```
/trade https://x.com/someone/status/123456789
/trade update
```

## Works with

```
sources:   tweets · youtube · podcasts · articles · PDFs · screenshots · typed hunches
venues:    Robinhood (stocks) · Hyperliquid (perps) · Polymarket (prediction markets)
```

## Prerequisites

- [Bun](https://bun.sh)
- `yt-dlp` for YouTube (skill offers to install on first run)
- [env.example](env.example) for env vars

## Links

[paste.trade](https://paste.trade) · [ARCHITECTURE.md](ARCHITECTURE.md) · [paste.trade/#changelog](https://paste.trade/#changelog)
