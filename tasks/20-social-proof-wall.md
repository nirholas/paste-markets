# Task 20: Social Proof Wall

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/wall` page that displays a live, auto-updating wall of community reactions — real tweets, quote-tweets, and replies about paste.markets. This is the #1 social proof mechanism. When visitors land on the site and see hundreds of real people hyped, it converts.

## Context
From frankdegods' paste.trade announcement, ~240 replies came in. Many are extremely bullish ("this is insane", "game changer", "finally someone built this"). We want to capture and display this energy permanently.

## Steps

### 1. Create the data model
In `src/lib/schema.sql`, add a `wall_posts` table:
```sql
CREATE TABLE IF NOT EXISTS wall_posts (
  id TEXT PRIMARY KEY,
  author_handle TEXT NOT NULL,
  author_display_name TEXT,
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  tweet_url TEXT,
  posted_at TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  category TEXT DEFAULT 'reaction', -- reaction, testimonial, feature_request
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2. Create seed script
Create `src/lib/seed-wall.ts` that can ingest tweet reply data (CSV or JSON) into the wall_posts table. Support both formats:
- JSON: `{ author_handle, content, tweet_url, posted_at, likes, retweets }`
- CSV: standard Twitter export columns

### 3. Build the page
Create `src/app/wall/page.tsx`:
- Masonry-style grid layout (3 columns desktop, 2 tablet, 1 mobile)
- Each card shows: avatar, @handle, tweet text, timestamp, like/RT counts
- Cards have subtle glow animation on hover
- Featured posts (featured=1) get a gold border accent
- Infinite scroll or "Load more" pagination
- Filter tabs: All | Hype | Testimonials | Feature Requests
- Counter at top: "247 reactions and counting"

### 4. Design system compliance
- Use existing design tokens from CLAUDE.md (bg #0a0a1a, surface #0f0f22, etc.)
- JetBrains Mono font
- Dark theme Bloomberg aesthetic
- Cards: `bg-[#0f0f22] border border-[#1a1a2e] rounded-lg`

### 5. OG image
Add OG metadata for `/wall` with a dynamic card showing the reaction count.

### 6. API route
Create `src/app/api/wall/route.ts`:
- `GET /api/wall?page=1&limit=20&category=all`
- Returns paginated wall posts
- Supports category filtering
