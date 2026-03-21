# Task 33: Embeddable Scorecard Widget

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build an embeddable widget that callers can add to their Twitter bio link, website, or Notion page. Shows their live win rate and P&L. Creates a persistent backlink to paste.markets from every caller's profile.

## Steps

### 1. Widget route
Create `src/app/embed/[handle]/page.tsx`:
- Lightweight page designed to be iframed
- No nav, no footer, just the scorecard
- Transparent or dark background
- Responsive: works at any size from 300x100 to full width

### 2. Widget content
Compact scorecard showing:
```
@handle · paste.markets
Win Rate: 67% ████████░░░ | Avg P&L: +4.2% | 42 trades
```

Variants:
- **Mini** (300x80): handle + win rate + P&L on one line
- **Card** (400x200): handle, win rate bar, P&L, trade count, last 5 results
- **Full** (600x400): everything above + recent trades list

### 3. Widget builder page
Create `src/app/embed/page.tsx` (client component):
- Input: @handle
- Preview: live preview of the widget
- Size selector: Mini / Card / Full
- Theme: Dark / Light (dark default)
- Copy embed code button:
  ```html
  <iframe src="https://paste.markets/embed/@handle?size=card" width="400" height="200" frameborder="0"></iframe>
  ```
- Copy markdown badge:
  ```markdown
  [![paste.markets](https://paste.markets/api/og/badge/@handle)](https://paste.markets/@handle)
  ```

### 4. Badge image route
Create `src/app/api/og/badge/[handle]/route.tsx`:
- Small (500x100) OG image that works as a badge
- Shows: handle, win rate, P&L in one line
- Dark bg, green/red accent
- Can be used in GitHub READMEs, forum signatures, etc.

### 5. CORS headers
The embed route needs permissive CORS:
```typescript
headers: {
  'X-Frame-Options': 'ALLOWALL',
  'Content-Security-Policy': "frame-ancestors *",
}
```

### 6. Design
- Dark theme by default, optional light theme via `?theme=light`
- Minimal padding, no rounded corners on mini (looks better in iframes)
- Card and Full variants: rounded corners, subtle border
- "Powered by paste.markets" link at bottom (small, #555568)
- Live data: widget fetches from API on load (no SSR caching for freshness)
