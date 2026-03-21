# Task 22: Waitlist / Join Page

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/join` page where people can drop their Twitter handle to get early access or notifications. Many replies to the announcement were "how do I use this?" and "where do I sign up?" — capture that demand.

## Steps

### 1. Database table
Add to `src/lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twitter_handle TEXT NOT NULL UNIQUE,
  email TEXT,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  position INTEGER,
  status TEXT DEFAULT 'waiting', -- waiting, invited, active
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2. API route
Create `src/app/api/join/route.ts`:
- `POST /api/join` — body: `{ handle: string, email?: string, referredBy?: string }`
- Validates handle (strips @, alphanumeric + underscore only)
- Returns position in waitlist + unique referral code
- Duplicate handle returns existing position

### 3. Build the page
Create `src/app/join/page.tsx` (client component for interactivity):

Layout:
- Large headline: "Get early access to paste.markets"
- Subtext: "Drop your Twitter handle. We'll let you in."
- Input field for @handle (auto-strips @, validates format)
- Optional email field
- Optional referral code field
- Submit button
- After submit: show position number ("You're #147 in line") + shareable referral link
- Counter: "1,247 traders waiting"

### 4. Referral mechanics
- Each signup gets a unique referral code
- Sharing the referral link (`paste.markets/join?ref=CODE`) bumps you up in line
- Show "Share to move up" CTA after signup with pre-filled tweet text:
  `"Just joined the @paste_markets waitlist. Paste a source, AI finds the trade, P&L tracks from there. Get in → paste.markets/join?ref=CODE"`

### 5. Design
- Bloomberg dark theme per CLAUDE.md
- Input: dark bg, subtle border, green focus ring
- Position number: large, green (#2ecc71), monospace
- Animated counter for total signups
- Mobile-first responsive

### 6. OG metadata
Title: "Join paste.markets"
Description: "Paste a source. AI finds the trade. P&L tracks from there."
OG image: dynamic card showing current waitlist count
