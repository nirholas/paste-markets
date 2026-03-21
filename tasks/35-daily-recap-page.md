# Task 35: Daily Recap / "Today on CT"

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/today` page that shows a daily summary of all trading activity on paste.markets. "Today on CT: 47 calls, $NVDA was the most called ticker, @frank had a 5-win streak." Gives people a reason to check the site every day.

## Steps

### 1. API route
Create `src/app/api/recap/route.ts`:
- `GET /api/recap?date=2026-03-21` (defaults to today)
- Returns:
  ```json
  {
    "date": "2026-03-21",
    "total_trades": 47,
    "total_callers_active": 12,
    "most_called_ticker": { "ticker": "NVDA", "count": 8 },
    "biggest_win": { "handle": "frank", "ticker": "SOL", "pnl": 34.2 },
    "biggest_loss": { "handle": "alex", "ticker": "BTC", "pnl": -12.5 },
    "hot_streak": { "handle": "frank", "streak": 5 },
    "new_callers": ["@newguy1", "@newguy2"],
    "venue_breakdown": { "stocks": 20, "perps": 15, "predictions": 12 },
    "consensus_play": { "ticker": "NVDA", "direction": "long", "agreement": 87 }
  }
  ```

### 2. Build the page
Create `src/app/today/page.tsx`:

Layout (newspaper/terminal style):
- Date header: "MARCH 21, 2026" in large monospace
- Hero stat: "47 calls today" big number
- Grid of stat cards:
  - Most called ticker (with mini bar chart)
  - Biggest win (with green highlight)
  - Biggest loss (with red highlight)
  - Hot streak caller
  - New callers added
  - Venue breakdown (mini pie or bar)
- Bottom: "Yesterday's recap" link, date picker for archives

### 3. Date navigation
- Left/right arrows to go to previous/next day
- Calendar picker for jumping to specific date
- URL: `/today?date=2026-03-21`

### 4. Auto-generated summary
Create `src/lib/recap-summary.ts`:
- Generates a one-paragraph natural language summary:
  "Busy day on CT. 47 calls across 12 callers. $NVDA dominated with 8 calls (87% long). @frank extended his streak to 5 wins. Two new callers joined the leaderboard."
- Display this at the top of the page as a "market brief"

### 5. OG image
Create `src/app/api/og/recap/route.tsx`:
- Shows date + key stats
- Title: "Today on paste.markets"
- Auto-shareable daily content

### 6. Design
- Newspaper/terminal hybrid aesthetic
- Date in large serif or heavy monospace
- Stats in card grid (2x3 on desktop, 1 column mobile)
- Green/red accents for wins/losses
- Subtle horizontal rules between sections
