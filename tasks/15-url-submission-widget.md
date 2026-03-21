# Task 15: Build URL Submission Widget (Homepage Hero)

## Goal
Replace the current search-only hero on the homepage with a dual-purpose input: search for a trader OR paste a URL to create a trade. This makes paste.markets the browser-based entry point for paste.trade.

## Context

- Current homepage has a search input that searches for authors
- The "What's The Trade?" page at /trade already handles URL → trade extraction
- We want the homepage hero to be the primary submission point
- paste.trade processes URLs into tracked trades with P&L

## What To Build

### 1. Smart input component

Create `src/components/smart-input.tsx` ("use client"):

A single input that auto-detects what the user typed:
- **URL detected** (starts with http/https): Show "Find the trade" button, routes to /trade?q={url}
- **@ handle detected** (starts with @): Show "View profile" button, routes to /@handle
- **Text detected**: Show two options — "Search traders" and "Find the trade"

The input should be large, prominent, centered. Placeholder cycles through examples:
- "paste a tweet URL..."
- "search @frankdegods..."
- "nvidia earnings beat, short the pop..."
- "https://x.com/..."

### 2. Update homepage

In `src/app/page.tsx`:
- Replace the current `<SearchInput size="lg" />` with `<SmartInput />`
- Update the hero subtitle to: "Paste a URL. Find the trade. Track P&L."
- Keep the feature cards, trending, leaderboard preview sections

### 3. Visual feedback

When a URL is detected:
- Input border turns accent blue
- Small label appears below: "URL detected — we'll extract the trade"
- Button text changes to "Find The Trade →"

When a handle is detected:
- Small label: "Trader detected"
- Button text: "View Profile →"

## Validation

1. `cd paste-dashboard && npx next build` — clean
2. URL input routes to /trade?q={url}
3. Handle input routes to /{handle}
4. Text input offers both search and trade options
5. Placeholder cycles through examples
6. Looks good on mobile

## Do NOT

- Remove the existing SearchInput component (other pages may use it)
- Process the URL on the homepage itself (route to /trade which handles it)
- Add animations beyond the placeholder cycling
