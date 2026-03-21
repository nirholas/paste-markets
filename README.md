<p align="center">
  <img src="public/logo.svg" alt="paste.markets" width="100%" />
</p>

> Paste a source. AI finds the trade, captures the price from when the author said it, tracks P&L from there.

Open source. Live platform at [paste.markets](https://paste.markets).

---

## Why this exists

You can already ask AI "what's the trade here?" and get a decent answer. Then you close the tab and it's gone.

paste.markets fixes that: extract the thesis, lock the price, publish it, and let the market decide if it was right.

---

## What it does

<p align="center">
  <img src="public/diagram-flow.svg" alt="Source to trade card flow" width="800" />
</p>

Two timestamps on every trade:
- **author price** — when the source was originally published (extracted from metadata)
- **paste price** — when it entered paste.markets

The gap between them is the head-start the author had before the market knew.

---

## How it works

<p align="center">
  <img src="public/diagram-pipeline.svg" alt="Processing pipeline" width="800" />
</p>

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

---

## API

Open. No auth required for reads.

```
GET https://paste.markets/api/search?author={handle}&top=30d
GET https://paste.markets/api/search?ticker=NVDA
GET https://paste.markets/api/leaderboard?timeframe=30d&sort=win_rate
GET https://paste.markets/api/author/{handle}
GET https://paste.markets/api/circle?timeframe=30d
GET https://paste.markets/api/wrapped/{handle}
GET https://paste.markets/api/vs?a={handle}&b={handle}
```

Full spec: [.well-known/openapi.yaml](.well-known/openapi.yaml)

---

## Build on top of it

The API is designed to be built on. Here's an example:

### paste.markets dashboard

A full leaderboard dashboard built on the paste.trade API (this repo):

- **Leaderboard** — CT traders ranked by real win rate and avg P&L
- **Author Scorecards** — trade history, best call, win rate bar, streaks
- **Head-to-Head** — 1v1 any two traders
- **CT Wrapped** — Spotify-style trading personality report cards
- **Caller Circle** — Twitter Circle-style visualization of top callers, shareable PNG + tweet
- **What's the Trade?** — paste any URL, AI finds the optimal trade

Dark Bloomberg terminal aesthetic. Everything server-rendered, cacheable, shareable OG images on every page.

---

## Why it's built this way

Claude Code and OpenClaw are the tools we use every day. Making it `/trade [anything]` means zero friction.

<p align="center">
  <img src="public/diagram-architecture.svg" alt="Skill to platform architecture" width="800" />
</p>

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

## Docs

| File | Description |
|------|-------------|
| [SKILLS.md](SKILLS.md) | Skill commands, source types, how `/trade` works |
| [AGENTS.md](AGENTS.md) | API reference, agent patterns, MCP integration, data model |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Internal pipeline architecture |
| [.well-known/ai-plugin.json](.well-known/ai-plugin.json) | AI plugin manifest |
| [.well-known/openapi.yaml](.well-known/openapi.yaml) | Full OpenAPI spec |
| [llms.txt](llms.txt) | Plain-text summary for LLM context windows |

---

## Links

[paste.markets](https://paste.markets) · [Changelog](https://paste.markets/#changelog) · [@frankdegods](https://x.com/frankdegods)
