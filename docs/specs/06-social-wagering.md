# Feature: Social Wagering — Back a Caller's Trade

## Codebase Context
Repo: https://github.com/rohunvora/paste-trade

**Stack**: Bun, Cloudflare Workers, JSONL storage, backend DB with relational columns + JSON blobs. Trade cards live at `https://paste.trade/s/{trade_id}`. The system tracks `created_at_price`, `publish_price`, and `since_published_move_pct` per trade.

Community request (@rgvrmdya, 1 retweet): "Should be able to like a comment and wager in — I like your idea so I wager by doubling down on your strategy and pay you."

This is the monetization layer for top callers and the social hook that makes paste.trade stickier than just a tracker.

---

## What to Build

A wagering system where users can back a caller's trade with USDC. If the trade is profitable by the settlement date, wagerers share the profit proportionally and the caller earns a tip % of the profits they generated.

### Product Design

**Who can wager:**
- Anyone with a connected wallet (Phantom, MetaMask, or Coinbase Wallet)
- Callers cannot wager on their own calls (prevent self-backing)

**Wager window:**
- Open from when the trade is published until `publish_time + 24 hours`
- No new wagers accepted after the window closes

**Settlement:**
- Automatic: at the caller-set `settlementDate` (or default: 7 days from publish)
- Manual close: caller can close early, locking in current PnL for everyone

**Economics:**
- Caller tip: 10% of gross profit generated from wagers (default, configurable per trade)
- Example: 1000 USDC wagered, trade wins +20% → 200 USDC gross profit → 20 USDC to caller, 180 USDC to wagerers proportionally
- Losses: wagerers lose proportionally, caller gets nothing extra

### New API endpoints:
```
POST /api/wager                        — place a wager
GET  /api/wager/[tradeId]              — get all wagers + stats for a trade
POST /api/wager/[tradeId]/settle       — trigger settlement (caller or cron)
GET  /api/caller/[handle]/earnings     — caller's total wagering earnings
```

**`POST /api/wager`:**
```ts
// Request
{
  tradeId: string,
  amount: number,           // USDC amount
  walletAddress: string,
  signature: string,        // signed message proving wallet ownership
  handle: string | null     // optional: linked Twitter handle
}

// Response
{
  wagerId: string,
  tradeId: string,
  amount: number,
  status: "pending_tx" | "active",
  txInstructions: string    // base64-encoded transaction to sign + submit
}
```

**`GET /api/wager/[tradeId]`:**
```ts
{
  tradeId: string,
  wagerWindowOpen: boolean,
  wagerDeadline: string,
  settlementDate: string,
  totalWagered: number,
  wagerCount: number,
  callerTipBps: number,
  currentPnlPercent: number,   // live PnL of the underlying call
  status: "open" | "closed" | "settled",
  wagers: [
    {
      wagerId: string,
      handle: string | null,
      amount: number,
      placedAt: string,
      pnlAmount: number | null,   // null until settled
      status: "active" | "won" | "lost" | "refunded"
    }
  ]
}
```

### On-Chain Mechanism:
Use Solana SPL Token escrow (the on-chain infrastructure from `/src/PumpAgent.ts` is available in this monorepo but paste.trade itself may just need a simple escrow):

**Option A (simpler):** Off-chain escrow via Coinbase Commerce or a custodial USDC account
- User sends USDC to a trade-specific address
- Backend tracks balances, settles off-chain
- Good for MVP, trust requires reputation

**Option B (trustless, recommended):** On-chain PDA escrow per trade
- PDA seed: `["wager", tradeId]`
- SPL Token vault holds USDC
- Settlement instruction distributes proportionally
- No trust required from either party

For the prompt: implement Option A (simpler/faster MVP), with a clear path to Option B.

### Data Model (new tables/fields):

```ts
// New: wagers table
{
  wagerId: string,
  tradeId: string,
  walletAddress: string,
  handle: string | null,
  amount: number,
  currency: "USDC",
  status: "active" | "won" | "lost" | "refunded",
  placedAt: string,
  settledAt: string | null,
  pnlAmount: number | null,     // profit or loss amount
  txSignature: string | null    // on-chain proof if using blockchain
}

// Add to trade record:
{
  wagerEnabled: boolean,        // caller opted in at submission
  wagerDeadline: string,        // publish_time + 24h
  settlementDate: string,       // default: publish_time + 7 days
  callerTipBps: number,         // default: 1000 (10%)
  totalWagered: number,         // aggregate
  wagerCount: number,
  wagerVaultAddress: string | null  // on-chain vault if using blockchain
}
```

### UI on Trade Card:

**While wager window is open (< 24h from publish):**
- "Back This Call" button (green CTA)
- Shows: "47 USDC wagered by 8 backers | 14h left to wager"
- Clicking opens modal:
  - Amount input (min: 5 USDC, max: 500 USDC)
  - "Connect Wallet" → "Sign & Back"
  - Settlement date shown: "Settles Jan 22, 2026"
  - Caller tip disclosure: "10% of profits go to the caller"

**After wager window closes (during active tracking):**
- "47 USDC by 8 backers — currently +12.3% 🟢"
- Shows wagerer avatars (if they linked Twitter)

**After settlement:**
- "Settled — +18.2% | Wagerers earned +16.4% | Caller earned $8.46 tip"
- Each wagerer can see their individual P&L

### Caller Dashboard widget (add to profile page):
```
Tips Earned from Backers
━━━━━━━━━━━━━━━━━━━━━━━━
Total tips earned:   $124.50
From 8 trades backed
Avg per backed trade: $15.56
```

### Settlement Cron:
- Cloudflare Cron: runs every hour, checks for trades past their `settlementDate`
- Fetches current price from Hyperliquid/Robinhood/Polymarket
- Computes each wagerer's P&L
- Distributes: caller tip + wagerer returns
- Updates all wager statuses to "won" or "lost"
- Emits `wager_settled` event

### Files to read first:
- `/types.ts` — TrackedTrade type to extend
- `/references/index/trade-index.md` — DB schema
- `/shared/pnl.ts` — P&L calculation for settlement math
- `/src/PumpAgent.ts` (in the broader monorepo) — existing Solana vault patterns if going on-chain
- `/scripts/post.ts` — where trades are created, add `wagerEnabled` option

## Deliverable:
1. Wagers table/schema + trade record extensions
2. `POST /api/wager`, `GET /api/wager/[tradeId]`, `POST /api/wager/[tradeId]/settle`
3. "Back This Call" modal UI on trade cards
4. Settlement cron worker
5. Caller tips section on profile pages
6. `GET /api/caller/[handle]/earnings` endpoint
