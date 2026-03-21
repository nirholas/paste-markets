# Task 41: Public API Documentation Page

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/docs` page documenting all public API endpoints. The API is open (no auth for reads). Making it discoverable lets developers build on top of paste.markets — bots, dashboards, integrations.

## Steps

### 1. Build the page
Create `src/app/docs/page.tsx`:

Layout (single-page docs, no framework needed):
- Left sidebar: endpoint list (sticky on desktop)
- Right content: endpoint details
- Mobile: sidebar collapses to dropdown

### 2. Document these endpoints
For each endpoint, show: method, path, parameters, example request, example response.

```
GET /api/leaderboard?timeframe=30d&sort=win_rate&limit=20
GET /api/author/{handle}
GET /api/search?q={query}
GET /api/search?author={handle}&top=30d
GET /api/search?ticker={ticker}
GET /api/vs?a={handle}&b={handle}
GET /api/wrapped/{handle}
GET /api/circle?timeframe=30d
GET /api/consensus?timeframe=7d
GET /api/heatmap?timeframe=7d
GET /api/recap?date=2026-03-21
GET /api/live?limit=50
GET /api/wall?page=1&limit=20
GET /api/fade/{handle}?timeframe=30d
GET /api/badges/{handle}
```

### 3. Interactive examples
For each endpoint:
- "Try it" button that makes a live request and shows the response
- Pre-filled with example params
- Response shown in a code block with syntax highlighting
- Copy button for the curl command

### 4. Code examples
Show usage in:
- curl
- JavaScript (fetch)
- Python (requests)

Tab switcher between languages.

### 5. Rate limits & guidelines
Section at top:
- "No auth required for read endpoints"
- Rate limits (if any)
- "Be nice — don't scrape aggressively"
- Attribution: "If you build on this, credit paste.markets"

### 6. Design
- Dark theme matching site
- Code blocks: slightly lighter bg (#0f0f22) with syntax colors
- Method badges: GET=green, POST=blue, DELETE=red
- Sticky sidebar with active section highlight
- Smooth scroll to sections
