# Task: Sports Betting & Event Markets via Polymarket

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard already supports Polymarket as a trading venue with prediction market data at `/predictions`. The paste.trade backend routes to Polymarket contracts automatically.

Frank said: "didn't build it for sports betting initially but someone just used it for the kentucky game lol"

The platform already routes to Polymarket — but sports/event markets need dedicated UX because they have fundamentally different characteristics: binary outcomes, fixed settlement dates, implied probabilities, and a familiar "betting" mental model.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Events/Sports Market Browser — `src/app/events/page.tsx`

A dedicated page for browsing Polymarket event markets, categorized:

**Categories:**
- Sports (NBA, NFL, Soccer, UFC, etc.)
- Politics (Elections, Policy, Geopolitics)
- Crypto (ETH ETF, Bitcoin milestones, Protocol events)
- Entertainment (Oscars, Reality TV, Music)
- Science & Tech (AI milestones, Space launches)
- Economics (Fed rates, GDP, Unemployment)

**Page layout:**
```
━━━ EVENT MARKETS ━━━

[Sports] [Politics] [Crypto] [Entertainment] [All]

Trending Now:
┌──────────────────────────────────────────────┐
│ 🏀 NCAA March Madness — Kentucky vs Duke     │
│ Kentucky to win: 62% → 58% (↓4% today)      │
│ Settles: Mar 22, 2026                        │
│ Volume: $1.2M                                │
│                                              │
│ 3 callers tracking this                      │
│ @SportsCaller: YES (called at 55%)           │
│                                              │
│ [Track YES]  [Track NO]  [View Market]       │
└──────────────────────────────────────────────┘
```

### 2. Market Detail Page — `src/app/markets/[id]/page.tsx`

Enhance existing market pages with:

**Probability chart:**
- Line chart showing implied probability over time
- Mark points where callers made predictions
- Green dots for correct calls (settled), red for incorrect

**Caller consensus:**
```
━━━ WHAT CALLERS THINK ━━━

YES (4 callers):
  @frankdegods — called YES at 55% (now 62%) ✅ +7%
  @ZssBecker — called YES at 48% (now 62%) ✅ +14%
  @SportsCaller — called YES at 60% (now 62%) ✅ +2%
  @NewTrader — called YES at 58% (now 62%) ✅ +4%

NO (1 caller):
  @ContrarianGuy — called NO at 60% (now 38%) ⚠️ -22%

Consensus: 80% of callers say YES
```

**Market context card:**
- Event description
- Settlement date + time
- Current probability + 24h change
- Volume traded
- Resolution source

### 3. Sports-specific PnL display

For Polymarket positions, PnL should be shown in probability terms:

```
Called YES at 55% · Now at 62% · PnL: +12.7%
(bought $1 of YES at $0.55, now worth $0.62)
```

For settled markets:
```
Called YES at 55% · Settled YES · PnL: +81.8%
(bought $1 of YES at $0.55, settled at $1.00)

Called NO at 60% · Settled YES · PnL: -100%
(bought $1 of NO at $0.60, settled at $0.00)
```

### 4. Event Calendar — `src/app/events/calendar/page.tsx`

A calendar view showing upcoming market settlements:

```
━━━ UPCOMING SETTLEMENTS ━━━

Mar 22 (Tomorrow)
  🏀 Kentucky vs Duke — 62% YES
  ⚡ ETH Pectra upgrade live? — 78% YES

Mar 25
  🏛️ Fed rate decision — 42% CUT
  📊 Q1 GDP estimate — 55% > 2%

Mar 30
  🥊 UFC 320 Main Event — 71% Fighter A
```

Each event links to its market detail page.

### 5. Sports Leaderboard — `src/app/predictions/sports/page.tsx`

A leaderboard filtered to sports/event prediction callers:

```
━━━ SPORTS PREDICTION LEADERBOARD ━━━

#  Handle          W/L    Win%   Avg PnL   Streak
1  @SportsCaller   24/8   75%    +22.4%    W5
2  @BetKing        18/7   72%    +18.1%    W2
3  @EventTrader    15/6   71%    +15.3%    L1
```

### 6. "What's the Bet?" variant

Add a sports-specific input mode to the trade finder:

```
┌──────────────────────────────────────────────┐
│  WHAT'S THE BET?                             │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ "Will Kentucky win March Madness?"    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Find Market]                               │
└──────────────────────────────────────────────┘

Result:
  Found: "Kentucky to win NCAA Tournament"
  Current: YES at 12% ($0.12)
  Volume: $450K
  Settles: Apr 7, 2026

  [Track YES]  [Track NO]
```

### 7. Data Model

```sql
-- Extend existing markets/predictions tables
CREATE TABLE IF NOT EXISTS event_markets (
  id TEXT PRIMARY KEY,
  polymarket_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,          -- 'sports' | 'politics' | 'crypto' | etc.
  subcategory TEXT,                -- 'NBA' | 'NFL' | etc.
  description TEXT,
  current_probability REAL,
  volume REAL,
  settlement_date TEXT,
  settled INTEGER DEFAULT 0,
  outcome TEXT,                    -- 'YES' | 'NO' | null
  caller_count INTEGER DEFAULT 0,
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_event_markets_category ON event_markets(category);
CREATE INDEX idx_event_markets_settlement ON event_markets(settlement_date);
```

### 8. API Endpoints

```
GET /api/events                          — browse event markets
GET /api/events/[id]                     — market detail + caller consensus
GET /api/events/calendar                 — upcoming settlements
GET /api/events/trending                 — most-tracked event markets
GET /api/predictions/sports              — sports-only leaderboard
POST /api/events/track                   — track a YES/NO position
```

**`GET /api/events` query params:**
- `category=sports`
- `subcategory=NBA`
- `sort=trending|volume|settlement`
- `settled=false` (default: show open markets)

---

## Files to Read First
- `paste-dashboard/src/app/predictions/page.tsx` — existing predictions page
- `paste-dashboard/src/app/markets/[source_id]/page.tsx` — existing market detail
- `paste-dashboard/src/components/prediction-stats.tsx` — prediction display
- `paste-dashboard/src/components/probability-bar.tsx` — probability visualization
- `paste-dashboard/src/lib/db.ts` — SQLite schema

## Deliverable
1. `/events` page with category tabs and market cards
2. Enhanced `/markets/[id]` page with caller consensus
3. Sports-specific PnL display for probability positions
4. `/events/calendar` settlement calendar
5. `/predictions/sports` sports prediction leaderboard
6. "What's the Bet?" variant on trade finder
7. `event_markets` SQLite table
8. Event market API endpoints
9. Category-based browsing and filtering
