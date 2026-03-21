# Task 38: "Add a Caller" Submit Flow

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a `/submit` page where users can nominate new callers to be tracked on paste.markets. Many replies were "track me!" or "can you add @someone?" — this flow captures that demand and crowdsources the caller database.

## Steps

### 1. Database table
Add to `src/lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_handle TEXT NOT NULL,
  submitted_by TEXT,
  reason TEXT,
  example_tweet_url TEXT,
  upvotes INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, tracked
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2. API routes
Create `src/app/api/submit/route.ts`:
- `POST /api/submit` — submit a caller nomination
  - Body: `{ handle, submitted_by?, reason?, example_tweet_url? }`
  - Deduplicates: if handle already submitted, increment upvotes
- `GET /api/submit?status=pending&sort=upvotes` — list submissions
- `POST /api/submit/vote` — upvote a submission
  - Body: `{ submission_id }`

### 3. Build the page
Create `src/app/submit/page.tsx` (client component):

Two sections:

**Submit a Caller:**
- Input: @handle of the caller to nominate
- Optional: your @handle (for credit)
- Optional: reason / why this caller is good
- Optional: example tweet URL showing a trade call
- Submit button

**Pending Nominations:**
- List of submitted callers, sorted by upvotes
- Each row: @handle, upvote count, reason, submitted by, time ago
- Upvote button (stores vote in localStorage to prevent spam)
- Status badges: Pending / Approved / Now Tracking
- "Already tracking" label for callers that are already in the system

### 4. After submission
- Show confirmation: "Thanks! @handle has been nominated."
- Show current upvote count
- "Share to boost" → pre-filled tweet: "I nominated @handle for @paste_markets tracking. Upvote → paste.markets/submit"

### 5. Admin view (stretch)
Create `src/app/submit/admin/page.tsx` (protected, check for admin env var):
- Review submissions
- Approve/reject buttons
- Approved callers get auto-added to the tracking system

### 6. Design
- Clean form, dark theme
- Upvote button: small, outline, turns green when voted
- Nomination list: table style matching leaderboard
- Status badges: pending=amber, approved=green, rejected=red muted
