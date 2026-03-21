# Task 45: Challenge Mode / Trading Competitions

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a system for time-limited trading challenges. "7-day challenge: best win rate wins." Gamification drives engagement and creates shareable moments. Replies showed appetite for competitions and social wagering.

## Steps

### 1. Database schema
Add to `src/lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  metric TEXT NOT NULL,          -- 'win_rate', 'total_pnl', 'best_single_trade', 'trade_count'
  min_trades INTEGER DEFAULT 3,  -- minimum trades to qualify
  status TEXT DEFAULT 'upcoming', -- upcoming, active, completed
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challenge_entries (
  challenge_id TEXT NOT NULL,
  caller_handle TEXT NOT NULL,
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (challenge_id, caller_handle),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
```

### 2. API routes
Create `src/app/api/challenges/route.ts`:
- `GET /api/challenges` — list all challenges (upcoming, active, completed)
- `GET /api/challenges/{id}` — challenge details + live standings
- `POST /api/challenges/{id}/join` — join a challenge

Challenge standings computed in real-time from trades table filtered by challenge date range.

### 3. Challenges page
Create `src/app/challenges/page.tsx`:

Layout:
- **Active Challenges** — currently running, with live standings
  - Countdown timer to end
  - Top 10 leaderboard
  - "Join this challenge" button
- **Upcoming** — starting soon
- **Completed** — past challenges with winners

### 4. Challenge detail page
Create `src/app/challenges/[id]/page.tsx`:
- Challenge title, rules, date range
- Live leaderboard specific to this challenge
- Countdown timer (or "Ended X days ago")
- Winner spotlight (for completed challenges)
- "Share challenge" button

### 5. Challenge standings component
Create `src/components/challenge-standings.tsx`:
- Compact leaderboard: Rank | Handle | Metric Value | Trades
- Top 3 get medal icons (gold/silver/bronze border)
- Live-updating (poll every 60 seconds)
- "You" row highlighted if user is participating

### 6. OG image
Dynamic card for each challenge:
- Challenge title + dates
- Current leader + their score
- "Join the challenge" CTA
- Time remaining

### 7. Design
- Active challenges: blue accent border, pulsing "LIVE" badge
- Countdown: monospace digits, ticking animation
- Winner: gold (#f39c12) accent + trophy-style layout
- Completed: dimmer styling, archived feel
