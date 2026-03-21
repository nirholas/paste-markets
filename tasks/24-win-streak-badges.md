# Task 24: Win Streak Badges & Achievements

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Add a badge/achievement system to caller profiles. Badges like "5-Win Streak", "100% Week", "Degen of the Month" give callers bragging rights and reasons to share their profile.

## Steps

### 1. Badge definitions
Create `src/lib/badges.ts`:
```typescript
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or SVG path
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  condition: (stats: CallerStats) => boolean;
}
```

Badge catalog:
- **Hot Streak** (3 wins in a row) — bronze
- **On Fire** (5 wins in a row) — silver
- **Untouchable** (10 wins in a row) — gold
- **Perfect Week** (100% win rate, 5+ trades in 7 days) — gold
- **Volume King** (50+ trades) — silver
- **Sharp Shooter** (70%+ win rate, 20+ trades) — gold
- **Diamond Hands** (avg hold time > 7 days with positive P&L) — silver
- **Degen** (10+ trades in 24 hours) — bronze
- **Whale** (largest single P&L > 50%) — gold
- **Early Bird** (paste price within 1hr of author price) — bronze
- **Consistency** (positive P&L 4 weeks running) — diamond
- **CT Legend** (top 3 on leaderboard for 30d) — diamond

### 2. Badge computation
Create `src/lib/compute-badges.ts`:
- Takes a caller's full trade history
- Evaluates each badge condition
- Returns earned badges with timestamps

### 3. Display on profile
Update the author profile page (`src/app/[author]/page.tsx`) or create a component:
- Badge shelf below the caller's stats
- Each badge: icon + name + "Earned Mar 12"
- Unearned badges shown dimmed (motivates callers to trade more)
- Hover/tap for description

### 4. Badge card component
Create `src/components/badge-card.tsx`:
- Tier colors: bronze=#cd7f32, silver=#c0c0c0, gold=#f39c12, diamond=#3b82f6
- Subtle glow effect matching tier color
- Small (inline in profile) and large (detail view) variants

### 5. OG image for badge showcase
When sharing a profile, if the caller has notable badges, include them in the OG image.

### 6. API
Create `src/app/api/badges/[handle]/route.ts`:
- `GET /api/badges/{handle}` — returns all earned badges for a caller
