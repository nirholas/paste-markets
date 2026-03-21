# Task: Trade Execution — Actually Place Orders from paste.markets

## Context

Repo: https://github.com/nirholas/paste-markets
Working directory: `/workspaces/agent-payments-sdk/paste-dashboard/`

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind, SQLite via better-sqlite3. The dashboard already extracts trade ideas from tweets/articles (via `src/lib/trade-extractor.ts`), submits them to paste.trade (`src/app/api/submit-trade/route.ts`), and tracks PnL. Venue configuration exists in `src/lib/venues.ts` for Hyperliquid, Robinhood, and Polymarket.

The current system **tracks** trades but never **executes** them. Users see "BTC LONG on Hyperliquid" but have to manually go to Hyperliquid to place the order. The wager system (`src/lib/wager-db.ts`, `src/app/trade/[id]/wager-modal.tsx`) uses mock transaction signatures — no real wallet SDK integration.

Frank's vision: "the first person to put their wallet and let the app do the trade from the content they paste in is literally going to be making money from pasting"

This task adds real trade execution — connect wallet, confirm trade parameters, place the order on-chain, and track the position.

**IMPORTANT**: Do NOT run tests. Do NOT run `npm run build` or any terminal commands that might crash. Just write the code. Stay on the current git branch.

---

## What to Build

### 1. Wallet Connection — `src/lib/wallet.ts`

Universal wallet connection supporting multiple providers:

```ts
interface WalletState {
  connected: boolean
  address: string | null
  chain: "evm" | "solana" | null
  provider: "metamask" | "phantom" | "rabby" | "coinbase" | null
  balances: {
    usdc: number
    native: number  // ETH or SOL
  }
}

// Connect wallet
export async function connectWallet(provider: string): Promise<WalletState>

// Disconnect
export async function disconnectWallet(): Promise<void>

// Get current state
export function useWallet(): WalletState  // React hook

// Sign a message (for auth)
export async function signMessage(message: string): Promise<string>
```

**Provider detection:**
- Check `window.ethereum` for MetaMask/Rabby/Coinbase Wallet
- Check `window.solana` for Phantom
- Show available providers, don't force a specific one

### 2. Wallet Connect Button — `src/components/wallet-button.tsx`

A connect button for the nav bar:

```
Not connected:
[Connect Wallet]

Connected:
[0x1a2b...3c4d ▼]
  ├─ Balance: 1,240 USDC
  ├─ Chain: Arbitrum
  ├─ [View on Explorer]
  ├─ [Switch Chain]
  └─ [Disconnect]
```

### 3. Hyperliquid Execution — `src/lib/execution/hyperliquid.ts`

Place perpetual orders on Hyperliquid:

```ts
interface HyperliquidOrder {
  asset: string              // "BTC", "ETH", "SOL", etc.
  direction: "long" | "short"
  size: number               // in USD
  leverage: number           // 1-50x
  orderType: "market" | "limit"
  limitPrice?: number        // for limit orders
  stopLoss?: number          // optional SL price
  takeProfit?: number        // optional TP price
}

interface ExecutionResult {
  success: boolean
  orderId?: string
  fillPrice?: number
  fillSize?: number
  fees?: number
  error?: string
  txHash?: string
}

export async function executeHyperliquidOrder(
  order: HyperliquidOrder,
  walletAddress: string
): Promise<ExecutionResult>

// Hyperliquid uses EVM signing (Arbitrum)
// API: https://api.hyperliquid.xyz
// Actions: place order, cancel order, get positions
// Auth: EIP-712 typed data signing via connected wallet
```

**Key implementation details:**
- Hyperliquid uses EIP-712 signing (no gas fees, just signatures)
- Orders go through their L1 orderbook, not Arbitrum
- Need to handle: asset lookup (map ticker to HL asset index), size validation (min/max), leverage limits per asset
- Deposits: users must have USDC on Hyperliquid L1 (can bridge from Arbitrum)

### 4. Polymarket Execution — `src/lib/execution/polymarket.ts`

Buy YES/NO outcome tokens on Polymarket:

```ts
interface PolymarketOrder {
  conditionId: string        // Polymarket market ID
  outcome: "YES" | "NO"
  amount: number             // USDC to spend
  limitPrice?: number        // max price per share (0.01-0.99)
}

export async function executePolymarketOrder(
  order: PolymarketOrder,
  walletAddress: string
): Promise<ExecutionResult>

// Polymarket uses the CLOB (Central Limit Order Book) API
// Auth: API key from wallet signature + CLOB headers
// Steps:
//   1. Derive API key from wallet signature (one-time)
//   2. Get market orderbook
//   3. Place order via CLOB API
//   4. Track fill status
```

### 5. Robinhood Display — `src/lib/execution/robinhood.ts`

Robinhood doesn't have a public trading API, so show instructions:

```ts
interface RobinhoodInstruction {
  ticker: string
  direction: "buy" | "sell"
  suggestedAmount?: number
  deepLink: string           // robinhood://... deep link for mobile
  webUrl: string             // robinhood.com/stocks/TICKER
}

export function getRobinhoodInstruction(
  ticker: string,
  direction: string
): RobinhoodInstruction
```

Display as:
```
━━━ EXECUTE ON ROBINHOOD ━━━

AAPL — BUY

We can't place orders on Robinhood automatically.
Open the app to execute:

[Open in Robinhood App]  [Open Robinhood Web]

Tip: Search "AAPL" → Buy → Market Order
```

### 6. Trade Confirmation Modal — `src/components/execution/trade-confirm-modal.tsx`

A confirmation modal shown before any trade executes:

```
┌──────────────────────────────────────────────────┐
│ CONFIRM TRADE                                     │
│                                                   │
│ ┌─────────────────────────────────────────────┐  │
│ │ BTC LONG on Hyperliquid                     │  │
│ │                                              │  │
│ │ Current Price:   $84,200                     │  │
│ │ Position Size:   $500 USDC                   │  │
│ │ Leverage:        5x                          │  │
│ │ Notional:        $2,500                      │  │
│ │                                              │  │
│ │ Est. Liquidation: $67,360 (-20%)             │  │
│ │ Est. Fees:        $0.25 (0.05%)              │  │
│ │                                              │  │
│ │ Stop Loss:       [_______] (optional)        │  │
│ │ Take Profit:     [_______] (optional)        │  │
│ └─────────────────────────────────────────────┘  │
│                                                   │
│ ⚠ This will place a REAL order with REAL money.  │
│ paste.markets is not responsible for losses.      │
│                                                   │
│ [Cancel]                    [Confirm & Execute]   │
└──────────────────────────────────────────────────┘
```

**For Polymarket:**
```
┌──────────────────────────────────────────────────┐
│ CONFIRM PREDICTION                                │
│                                                   │
│ "Will BTC hit $100k by April?"                    │
│                                                   │
│ Position:   YES                                   │
│ Price:      $0.42 per share                       │
│ Amount:     $50 USDC                              │
│ Shares:     ~119 YES shares                       │
│                                                   │
│ If YES settles: +$69.05 (+138%)                   │
│ If NO settles:  -$50.00 (-100%)                   │
│                                                   │
│ [Cancel]                    [Confirm & Buy YES]   │
└──────────────────────────────────────────────────┘
```

### 7. Position Tracker — `src/lib/execution/positions.ts`

Track open positions from executed trades:

```ts
interface Position {
  id: string
  tradeId: string            // links to paste.markets trade
  venue: "hyperliquid" | "polymarket"
  asset: string
  direction: string
  entryPrice: number
  currentPrice: number
  size: number
  leverage?: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
  status: "open" | "closed" | "liquidated"
  openedAt: string
  closedAt?: string
  closePnl?: number
}

// Fetch live positions from venue APIs
export async function getOpenPositions(walletAddress: string): Promise<Position[]>

// Close a position
export async function closePosition(positionId: string): Promise<ExecutionResult>
```

### 8. Positions Page — `src/app/positions/page.tsx`

A portfolio view of all open and closed positions:

```
━━━ YOUR POSITIONS ━━━

OPEN (3)
┌──────────────────────────────────────────────────┐
│ BTC LONG · Hyperliquid · 5x                      │
│ Entry: $84,200 → Now: $85,100                    │
│ Size: $500 · PnL: +$26.75 (+5.35%)              │
│ Opened: 2h ago via @frankdegods call              │
│                                                   │
│ [Close Position]  [Add SL/TP]  [View Trade]       │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ "BTC $100k by April?" YES · Polymarket            │
│ Bought at: $0.42 → Now: $0.48                    │
│ 119 shares · PnL: +$7.14 (+14.3%)               │
│ Settles: Apr 1, 2026                              │
│                                                   │
│ [Sell Shares]  [View Market]                      │
└──────────────────────────────────────────────────┘

CLOSED (12)
[Standard history table with realized PnL]
```

### 9. One-Click Execute from Trade Cards

Add an "Execute" button to trade cards and the trade finder:

```
┌──────────────────────────────────────────────────┐
│ @frankdegods · BTC LONG · +4.2%                   │
│ "BTC looking strong, 85k floor"                   │
│                                                   │
│ [Execute Trade]  [Double Down]  [Share]            │
└──────────────────────────────────────────────────┘
```

Clicking "Execute Trade":
1. Check wallet connected → if not, prompt to connect
2. Show trade confirmation modal with pre-filled parameters
3. User adjusts size/leverage/SL/TP
4. Confirm → sign → execute → show result
5. Position appears in /positions

### 10. Risk Controls — `src/lib/execution/risk.ts`

Safety checks before any execution:

```ts
interface RiskCheck {
  passed: boolean
  warnings: string[]
  blocked: boolean
  blockReason?: string
}

export function checkRisk(order: any, wallet: WalletState): RiskCheck

// Rules:
// - Max single trade size: $5,000 (configurable)
// - Max leverage: 20x (even if venue allows more)
// - Warn if trade size > 50% of wallet balance
// - Warn if no stop loss set on leveraged trades
// - Block if insufficient balance
// - Block if wallet not connected
// - Require explicit confirmation for trades > $1,000
```

### 11. Data Model

```sql
CREATE TABLE IF NOT EXISTS executed_trades (
  id TEXT PRIMARY KEY,
  trade_id TEXT,                    -- paste.markets trade reference
  wallet_address TEXT NOT NULL,
  venue TEXT NOT NULL,              -- 'hyperliquid' | 'polymarket'
  asset TEXT NOT NULL,
  direction TEXT NOT NULL,
  order_type TEXT DEFAULT 'market',
  size_usd REAL NOT NULL,
  leverage REAL DEFAULT 1,
  entry_price REAL,
  stop_loss REAL,
  take_profit REAL,
  status TEXT DEFAULT 'pending',    -- 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed'
  fill_price REAL,
  fill_size REAL,
  fees REAL,
  tx_hash TEXT,
  venue_order_id TEXT,
  closed_at TEXT,
  close_price REAL,
  realized_pnl REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_executed_trades_wallet ON executed_trades(wallet_address);
CREATE INDEX idx_executed_trades_status ON executed_trades(status);
CREATE INDEX idx_executed_trades_trade ON executed_trades(trade_id);
```

### 12. API Endpoints

```
POST /api/execute                     — execute a trade
GET  /api/positions                   — get open positions
POST /api/positions/[id]/close        — close a position
GET  /api/positions/history           — closed position history
GET  /api/execution/preflight         — risk check before execution
POST /api/wallet/connect              — store wallet session
GET  /api/wallet/balances             — fetch wallet balances
```

**`POST /api/execute`:**
```ts
// Request
{
  tradeId?: string,            // optional link to paste.markets trade
  venue: "hyperliquid" | "polymarket",
  asset: string,
  direction: "long" | "short" | "yes" | "no",
  size: number,                // USD
  leverage?: number,           // for perps
  orderType?: "market" | "limit",
  limitPrice?: number,
  stopLoss?: number,
  takeProfit?: number,
  walletAddress: string,
  signature: string            // signed confirmation
}

// Response
{
  executionId: string,
  status: "filled" | "pending" | "failed",
  fillPrice?: number,
  fillSize?: number,
  fees?: number,
  txHash?: string,
  error?: string
}
```

**`GET /api/execution/preflight`:**
```ts
// Request query params
?venue=hyperliquid&asset=BTC&direction=long&size=500&leverage=5&wallet=0x...

// Response
{
  riskCheck: {
    passed: boolean,
    warnings: string[],
    blocked: boolean,
    blockReason?: string
  },
  estimatedFees: number,
  estimatedLiquidation?: number,
  currentPrice: number,
  availableBalance: number
}
```

---

## Files to Read First
- `paste-dashboard/src/lib/venues.ts` — existing venue configuration
- `paste-dashboard/src/app/api/submit-trade/route.ts` — current trade submission
- `paste-dashboard/src/components/trade-finder.tsx` — trade extraction UI
- `paste-dashboard/src/app/trade/[id]/wager-modal.tsx` — existing wallet input (mock)
- `paste-dashboard/src/lib/wager-db.ts` — existing wallet/transaction patterns
- `paste-dashboard/src/app/trade/[id]/page.tsx` — trade detail page to enhance
- `paste-dashboard/src/lib/db.ts` — SQLite schema

## Deliverable
1. `src/lib/wallet.ts` — universal wallet connection (MetaMask, Phantom, Rabby)
2. `src/components/wallet-button.tsx` — nav bar wallet button with dropdown
3. `src/lib/execution/hyperliquid.ts` — Hyperliquid perp order execution via EIP-712
4. `src/lib/execution/polymarket.ts` — Polymarket CLOB order execution
5. `src/lib/execution/robinhood.ts` — Robinhood deep link instructions
6. `src/components/execution/trade-confirm-modal.tsx` — confirmation modal with risk display
7. `src/lib/execution/positions.ts` — position tracking and management
8. `src/app/positions/page.tsx` — portfolio page with open/closed positions
9. "Execute Trade" button on trade cards and trade finder
10. `src/lib/execution/risk.ts` — risk controls and safety checks
11. `executed_trades` SQLite table
12. Execution + positions + wallet API endpoints
