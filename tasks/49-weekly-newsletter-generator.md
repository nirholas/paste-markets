# Task 49: Weekly Newsletter / Report Generator

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build an auto-generated weekly report page at `/weekly` that summarizes the week's trading activity. Can be shared as a newsletter or published as a blog-style post. Content marketing that writes itself.

## Steps

### 1. Report generation
Create `src/lib/weekly-report.ts`:
```typescript
export async function generateWeeklyReport(weekStart: string): Promise<WeeklyReport> {
  return {
    week: weekStart,
    headline: "AI generated 1-line summary",
    total_trades: number,
    total_callers: number,
    top_caller: { handle, win_rate, trades },
    worst_caller: { handle, win_rate, trades },
    most_called_ticker: { ticker, count, avg_pnl },
    biggest_win: { handle, ticker, pnl },
    biggest_loss: { handle, ticker, pnl },
    new_callers: string[],
    narrative_of_the_week: string,
    consensus_plays: ConsensusPlay[],
    fun_stats: string[], // AI-generated observations
  };
}
```

### 2. API route
Create `src/app/api/weekly/route.ts`:
- `GET /api/weekly?week=2026-03-17` (Monday of the week)
- Defaults to most recent completed week
- Generates report from trade data + AI summary

### 3. Build the page
Create `src/app/weekly/page.tsx`:

Layout (newsletter/editorial style):
- Date range header: "Week of March 17-23, 2026"
- AI-written opening paragraph summarizing the week
- **Section: Top Performers** — mini leaderboard for the week
- **Section: Biggest Trades** — best win + worst loss highlighted
- **Section: Trending Tickers** — what CT was trading
- **Section: Narratives** — which themes dominated
- **Section: New Callers** — who joined the platform
- **Section: Fun Stats** — AI-generated observations like "Tuesday was the most active day" or "@frank hasn't made a losing trade in 12 days"
- Previous/next week navigation

### 4. Archive
Create `src/app/weekly/archive/page.tsx`:
- List of all past weekly reports
- Each entry: week dates + headline + key stat
- Grid or list layout

### 5. AI summary
Use Claude (haiku for cost) to generate:
- Opening paragraph
- "Fun stats" — 3-5 interesting observations from the data
- "Narrative of the week" — dominant theme

### 6. OG image
Dynamic card for each week:
- "Week of March 17" + key stat (top caller, biggest trade)
- Newsletter-style layout

### 7. Design
- Slightly different from main site — more editorial/magazine feel
- Wider text blocks, more white space
- Section headers with subtle horizontal rules
- Stats in pull-quote style callout boxes
- Still dark theme, just more spacious
