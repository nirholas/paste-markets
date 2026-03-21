# Task 43: "Roast My Portfolio" Feature

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Build a viral `/roast/[handle]` page that uses AI to generate a brutally honest (but funny) roast of a caller's trading history. CT loves trash talk — this is Wrapped but mean. Extremely shareable.

## Steps

### 1. Roast generation
Create `src/lib/roast.ts`:
```typescript
export async function generateRoast(handle: string, stats: CallerStats, trades: Trade[]): Promise<string> {
  // Send stats + recent trades to Claude
  // Prompt: roast this trader's performance in 3-4 sentences
  // Rules: funny, brutally honest, reference specific bad trades
  // Never be actually mean/personal — roast the trades, not the person
}
```

Use `claude-haiku-4-5-20251001` for speed. Prompt guidelines:
- Reference specific bad trades: "You went long $SOL right before it cratered 20%. Bold."
- Mock bad patterns: "Your strategy seems to be: buy high, sell low, repeat."
- Acknowledge good trades backhanded: "You nailed $NVDA once. Broken clock energy."
- Keep it CT-native: use degen, ape, rekt, ngmi, etc.
- End with one genuine compliment (makes it shareable — people share roasts that have a kernel of truth)

### 2. API route
Create `src/app/api/roast/[handle]/route.ts`:
- `GET /api/roast/{handle}`
- Fetches caller stats + recent trades
- Generates roast via AI
- Caches roast for 24 hours (don't regenerate on every request)
- Returns: roast text + stats used

### 3. Build the page
Create `src/app/roast/[handle]/page.tsx`:

Layout:
- Dark, dramatic background
- @handle at top
- Roast text in large, slightly italic JetBrains Mono
- Key stats below the roast (win rate, worst trade, biggest L)
- "Share this roast" button → copies URL
- "Roast another caller" → input field
- "Get your own roast" CTA → links to /roast with handle input

### 4. Roast OG image
Create `src/app/api/og/roast/[handle]/route.tsx`:
- Shows the first 2 sentences of the roast
- @handle prominently displayed
- Red/fire accent theme
- "paste.markets/roast" branding

### 5. Roast input page
Create `src/app/roast/page.tsx`:
- Simple page with input: "Enter a @handle to roast"
- Submit → redirects to /roast/[handle]
- List of "Recently roasted" callers

### 6. Design
- Darker than normal: maybe #050510 background
- Text: slightly warm white or amber tint
- Red accent (#e74c3c) instead of green
- Fire emoji or flame icon (only exception to no-emoji rule — it fits the feature)
- Dramatic typography: larger than normal, maybe slight text-shadow
