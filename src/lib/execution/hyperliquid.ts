/**
 * Hyperliquid perpetual order execution via EIP-712 signing.
 *
 * Hyperliquid uses an off-chain orderbook with EIP-712 signed messages.
 * No gas fees — just wallet signatures. Orders settle on Hyperliquid L1.
 *
 * API docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

import { signTypedData } from "../wallet";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HL_API = "https://api.hyperliquid.xyz";

// Hyperliquid EIP-712 domain
const HL_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 42161, // Arbitrum
  verifyingContract: "0x0000000000000000000000000000000000000000",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HyperliquidOrder {
  asset: string; // "BTC", "ETH", "SOL", etc.
  direction: "long" | "short";
  size: number; // in USD
  leverage: number; // 1-50x
  orderType: "market" | "limit";
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
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

interface HLAssetInfo {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

interface HLMeta {
  universe: HLAssetInfo[];
}

// ---------------------------------------------------------------------------
// Asset lookup
// ---------------------------------------------------------------------------

let cachedMeta: HLMeta | null = null;

async function fetchMeta(): Promise<HLMeta> {
  if (cachedMeta) return cachedMeta;

  const res = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
  });

  if (!res.ok) throw new Error(`Failed to fetch HL meta: ${res.status}`);
  cachedMeta = (await res.json()) as HLMeta;
  return cachedMeta;
}

async function resolveAsset(
  ticker: string
): Promise<{ index: number; info: HLAssetInfo }> {
  const meta = await fetchMeta();
  const normalized = ticker.replace(/^\$/, "").toUpperCase();

  const index = meta.universe.findIndex(
    (a) => a.name.toUpperCase() === normalized
  );

  if (index === -1) {
    throw new Error(
      `Asset "${normalized}" not found on Hyperliquid. Available: ${meta.universe
        .slice(0, 20)
        .map((a) => a.name)
        .join(", ")}...`
    );
  }

  return { index, info: meta.universe[index] };
}

// ---------------------------------------------------------------------------
// Price fetching
// ---------------------------------------------------------------------------

export async function getCurrentPrice(ticker: string): Promise<number> {
  const { info } = await resolveAsset(ticker);

  const res = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });

  if (!res.ok) throw new Error(`Failed to fetch prices: ${res.status}`);
  const mids = (await res.json()) as Record<string, string>;

  const price = parseFloat(mids[info.name]);
  if (isNaN(price)) throw new Error(`No price data for ${info.name}`);
  return price;
}

// ---------------------------------------------------------------------------
// Account info
// ---------------------------------------------------------------------------

export async function getAccountState(walletAddress: string) {
  const res = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "clearinghouseState",
      user: walletAddress,
    }),
  });

  if (!res.ok) throw new Error(`Failed to fetch account state: ${res.status}`);
  return res.json();
}

export async function getOpenPositions(walletAddress: string) {
  const state = (await getAccountState(walletAddress)) as {
    assetPositions: Array<{
      position: {
        coin: string;
        szi: string;
        entryPx: string;
        unrealizedPnl: string;
        leverage: { value: string };
      };
    }>;
  };

  return (state.assetPositions || []).map((ap) => ({
    asset: ap.position.coin,
    size: parseFloat(ap.position.szi),
    entryPrice: parseFloat(ap.position.entryPx),
    unrealizedPnl: parseFloat(ap.position.unrealizedPnl),
    leverage: parseFloat(ap.position.leverage?.value ?? "1"),
    direction: parseFloat(ap.position.szi) > 0 ? ("long" as const) : ("short" as const),
  }));
}

// ---------------------------------------------------------------------------
// Order execution
// ---------------------------------------------------------------------------

export async function executeHyperliquidOrder(
  order: HyperliquidOrder,
  walletAddress: string
): Promise<ExecutionResult> {
  try {
    // 1. Resolve asset
    const { index, info } = await resolveAsset(order.asset);

    // 2. Validate leverage
    if (order.leverage > info.maxLeverage) {
      return {
        success: false,
        error: `Max leverage for ${info.name} is ${info.maxLeverage}x, requested ${order.leverage}x`,
      };
    }

    // 3. Get current price for market orders
    const currentPrice = await getCurrentPrice(order.asset);

    // 4. Calculate order size in asset units
    const price =
      order.orderType === "limit" && order.limitPrice
        ? order.limitPrice
        : currentPrice;
    const sizeInAsset = order.size / price;

    // Round to asset's decimal precision
    const roundedSize =
      Math.round(sizeInAsset * 10 ** info.szDecimals) /
      10 ** info.szDecimals;

    if (roundedSize === 0) {
      return {
        success: false,
        error: `Order size too small for ${info.name} (min precision: ${info.szDecimals} decimals)`,
      };
    }

    // 5. Build the order action
    const isBuy = order.direction === "long";
    // For market orders: set limit far from market to ensure fill
    const limitPx =
      order.orderType === "market"
        ? isBuy
          ? Math.round(currentPrice * 1.05 * 100) / 100 // 5% slippage tolerance
          : Math.round(currentPrice * 0.95 * 100) / 100
        : order.limitPrice!;

    const nonce = Date.now();

    const orderAction = {
      type: "order" as const,
      orders: [
        {
          a: index,
          b: isBuy,
          p: String(limitPx),
          s: String(roundedSize),
          r: false, // not reduce-only
          t: order.orderType === "market"
            ? { limit: { tif: "Ioc" } } // Immediate-or-cancel for market orders
            : { limit: { tif: "Gtc" } }, // Good-til-cancel for limit orders
        },
      ],
      grouping: "na" as const,
    };

    // 6. Build EIP-712 typed data
    const types = {
      Order: [
        { name: "action", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    };

    const value = {
      action: JSON.stringify(orderAction),
      nonce,
    };

    // 7. Sign with wallet
    const signature = await signTypedData(HL_DOMAIN, types, value, walletAddress);

    // 8. Submit to Hyperliquid
    const res = await fetch(`${HL_API}/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: orderAction,
        nonce,
        signature,
      }),
    });

    const data = (await res.json()) as {
      status: string;
      response?: {
        type: string;
        data?: {
          statuses: Array<{
            resting?: { oid: number };
            filled?: { totalSz: string; avgPx: string; oid: number };
            error?: string;
          }>;
        };
      };
    };

    if (data.status !== "ok") {
      return {
        success: false,
        error: `Hyperliquid rejected order: ${JSON.stringify(data)}`,
      };
    }

    // 9. Parse response
    const statuses = data.response?.data?.statuses;
    if (!statuses || statuses.length === 0) {
      return {
        success: false,
        error: "No order status returned",
      };
    }

    const status = statuses[0];

    if (status.error) {
      return { success: false, error: status.error };
    }

    if (status.filled) {
      const estimatedFee = parseFloat(status.filled.totalSz) * parseFloat(status.filled.avgPx) * 0.0005;
      return {
        success: true,
        orderId: String(status.filled.oid),
        fillPrice: parseFloat(status.filled.avgPx),
        fillSize: parseFloat(status.filled.totalSz),
        fees: Math.round(estimatedFee * 100) / 100,
      };
    }

    if (status.resting) {
      return {
        success: true,
        orderId: String(status.resting.oid),
      };
    }

    return {
      success: true,
      orderId: "unknown",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Unknown error executing Hyperliquid order",
    };
  }
}

// ---------------------------------------------------------------------------
// Cancel order
// ---------------------------------------------------------------------------

export async function cancelHyperliquidOrder(
  asset: string,
  orderId: number,
  walletAddress: string
): Promise<ExecutionResult> {
  try {
    const { index } = await resolveAsset(asset);
    const nonce = Date.now();

    const cancelAction = {
      type: "cancel" as const,
      cancels: [{ a: index, o: orderId }],
    };

    const types = {
      Order: [
        { name: "action", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    };

    const value = {
      action: JSON.stringify(cancelAction),
      nonce,
    };

    const signature = await signTypedData(HL_DOMAIN, types, value, walletAddress);

    const res = await fetch(`${HL_API}/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: cancelAction,
        nonce,
        signature,
      }),
    });

    const data = (await res.json()) as { status: string };

    return {
      success: data.status === "ok",
      orderId: String(orderId),
      error: data.status !== "ok" ? "Cancel failed" : undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
