/**
 * Polymarket CLOB order execution.
 *
 * Polymarket uses a Central Limit Order Book (CLOB) for prediction markets.
 * Auth flow: derive API key from wallet signature, then use CLOB API.
 *
 * Docs: https://docs.polymarket.com
 */

import { signMessage } from "../wallet";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLOB_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolymarketOrder {
  conditionId: string; // Polymarket condition/market ID
  outcome: "YES" | "NO";
  amount: number; // USDC to spend
  limitPrice?: number; // max price per share (0.01-0.99)
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  fillPrice?: number;
  fillSize?: number;
  fees?: number;
  error?: string;
  txHash?: string;
}

export interface PolymarketPosition {
  conditionId: string;
  outcome: "YES" | "NO";
  size: number; // shares
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  title?: string;
}

// ---------------------------------------------------------------------------
// API Key derivation
// ---------------------------------------------------------------------------

let cachedApiKey: string | null = null;
let cachedApiSecret: string | null = null;
let cachedApiPassphrase: string | null = null;

export async function deriveApiCredentials(walletAddress: string): Promise<{
  apiKey: string;
  secret: string;
  passphrase: string;
}> {
  if (cachedApiKey && cachedApiSecret && cachedApiPassphrase) {
    return {
      apiKey: cachedApiKey,
      secret: cachedApiSecret,
      passphrase: cachedApiPassphrase,
    };
  }

  // Step 1: Sign the nonce message to derive API key
  const nonce = Date.now();
  const message = `I am signing this message to derive my Polymarket API key. Nonce: ${nonce}`;

  const signature = await signMessage(message, "metamask");

  // Step 2: Register/derive API key via CLOB
  const res = await fetch(`${CLOB_API}/auth/derive-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      signature,
      nonce,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to derive API key: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    apiKey: string;
    secret: string;
    passphrase: string;
  };

  cachedApiKey = data.apiKey;
  cachedApiSecret = data.secret;
  cachedApiPassphrase = data.passphrase;

  return data;
}

// ---------------------------------------------------------------------------
// CLOB headers
// ---------------------------------------------------------------------------

function getClobHeaders(apiKey: string, secret: string, passphrase: string) {
  return {
    "Content-Type": "application/json",
    "POLY_API_KEY": apiKey,
    "POLY_SECRET": secret,
    "POLY_PASSPHRASE": passphrase,
  };
}

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export async function getMarketInfo(conditionId: string) {
  const res = await fetch(
    `${GAMMA_API}/markets?condition_id=${conditionId}`
  );

  if (!res.ok) throw new Error(`Failed to fetch market: ${res.status}`);
  const markets = (await res.json()) as Array<{
    condition_id: string;
    question: string;
    tokens: Array<{
      token_id: string;
      outcome: string;
      price: number;
    }>;
    end_date_iso: string;
    active: boolean;
  }>;

  return markets[0] ?? null;
}

export async function getOrderbook(tokenId: string) {
  const res = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
  if (!res.ok) throw new Error(`Failed to fetch orderbook: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Order execution
// ---------------------------------------------------------------------------

export async function executePolymarketOrder(
  order: PolymarketOrder,
  walletAddress: string
): Promise<ExecutionResult> {
  try {
    // 1. Get market info to find token ID
    const market = await getMarketInfo(order.conditionId);
    if (!market) {
      return {
        success: false,
        error: `Market not found: ${order.conditionId}`,
      };
    }

    if (!market.active) {
      return {
        success: false,
        error: "Market is no longer active",
      };
    }

    // Find the token for the desired outcome
    const token = market.tokens?.find(
      (t) => t.outcome.toUpperCase() === order.outcome
    );
    if (!token) {
      return {
        success: false,
        error: `Outcome "${order.outcome}" not found in market`,
      };
    }

    // 2. Validate price
    const maxPrice = order.limitPrice ?? token.price * 1.05; // 5% slippage
    if (maxPrice <= 0 || maxPrice >= 1) {
      return {
        success: false,
        error: "Price must be between 0.01 and 0.99",
      };
    }

    // Calculate shares: amount / price
    const shares = Math.floor((order.amount / maxPrice) * 100) / 100;

    // 3. Derive API credentials
    const creds = await deriveApiCredentials(walletAddress);

    // 4. Place order via CLOB
    const orderPayload = {
      tokenID: token.token_id,
      price: String(maxPrice),
      size: String(shares),
      side: "BUY" as const,
      type: order.limitPrice ? "GTC" : "FOK", // Fill-or-kill for market, GTC for limit
      feeRateBps: "0",
    };

    const res = await fetch(`${CLOB_API}/order`, {
      method: "POST",
      headers: getClobHeaders(creds.apiKey, creds.secret, creds.passphrase),
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Polymarket order failed: ${res.status} — ${errText}`,
      };
    }

    const data = (await res.json()) as {
      orderID?: string;
      status?: string;
      transactionsHashes?: string[];
      success?: boolean;
    };

    if (data.success === false) {
      return {
        success: false,
        error: "Order was not filled",
      };
    }

    return {
      success: true,
      orderId: data.orderID,
      fillPrice: maxPrice,
      fillSize: shares,
      fees: order.amount * 0.02, // ~2% estimated
      txHash: data.transactionsHashes?.[0],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Unknown error executing Polymarket order",
    };
  }
}

// ---------------------------------------------------------------------------
// Sell shares (close position)
// ---------------------------------------------------------------------------

export async function sellPolymarketShares(
  conditionId: string,
  outcome: "YES" | "NO",
  shares: number,
  walletAddress: string
): Promise<ExecutionResult> {
  try {
    const market = await getMarketInfo(conditionId);
    if (!market) {
      return { success: false, error: "Market not found" };
    }

    const token = market.tokens?.find(
      (t) => t.outcome.toUpperCase() === outcome
    );
    if (!token) {
      return { success: false, error: `${outcome} token not found` };
    }

    const creds = await deriveApiCredentials(walletAddress);

    const sellPrice = token.price * 0.95; // 5% slippage tolerance

    const orderPayload = {
      tokenID: token.token_id,
      price: String(Math.round(sellPrice * 100) / 100),
      size: String(shares),
      side: "SELL" as const,
      type: "FOK",
      feeRateBps: "0",
    };

    const res = await fetch(`${CLOB_API}/order`, {
      method: "POST",
      headers: getClobHeaders(creds.apiKey, creds.secret, creds.passphrase),
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Sell failed: ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      orderID?: string;
      success?: boolean;
      transactionsHashes?: string[];
    };

    return {
      success: data.success !== false,
      orderId: data.orderID,
      fillPrice: sellPrice,
      fillSize: shares,
      txHash: data.transactionsHashes?.[0],
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
