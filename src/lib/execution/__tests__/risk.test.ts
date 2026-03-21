import { describe, it, expect } from "vitest";
import { checkRisk, estimateLiquidationPrice, estimateFees } from "../risk";
import type { WalletState } from "../../wallet";

const connectedWallet: WalletState = {
  connected: true,
  address: "0x1234567890abcdef",
  chain: "evm",
  provider: "metamask",
  balances: { usdc: 10_000, native: 1.5 },
};

const disconnectedWallet: WalletState = {
  connected: false,
  address: null,
  chain: null,
  provider: null,
  balances: { usdc: 0, native: 0 },
};

describe("checkRisk", () => {
  it("blocks when wallet is not connected", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 100 },
      disconnectedWallet
    );
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe("Wallet not connected");
  });

  it("blocks when size is 0 or negative", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 0 },
      connectedWallet
    );
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("greater than 0");
  });

  it("blocks when size exceeds max ($5,000)", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 6000 },
      connectedWallet
    );
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("exceeds maximum");
  });

  it("blocks when leverage exceeds max (20x)", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 100, leverage: 25 },
      connectedWallet
    );
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("Leverage");
  });

  it("blocks when insufficient balance", () => {
    const lowBalanceWallet = { ...connectedWallet, balances: { usdc: 50, native: 0 } };
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 100 },
      lowBalanceWallet
    );
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("Insufficient balance");
  });

  it("passes for a valid small trade", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 100, leverage: 3 },
      connectedWallet
    );
    expect(result.passed).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("warns when no stop loss on leveraged trade", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 100, leverage: 5 },
      connectedWallet
    );
    expect(result.passed).toBe(true);
    expect(result.warnings).toContain("No stop loss set on a leveraged trade");
  });

  it("does not warn about stop loss when one is set", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 100, leverage: 5, stopLoss: 80000 },
      connectedWallet
    );
    expect(result.warnings).not.toContain("No stop loss set on a leveraged trade");
  });

  it("warns when trade uses large portion of balance", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 4000, leverage: 1, stopLoss: 80000 },
      { ...connectedWallet, balances: { usdc: 5000, native: 1 } }
    );
    expect(result.warnings.some((w) => w.includes("% of your available balance"))).toBe(true);
  });

  it("warns when trade exceeds $1,000", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 1500, leverage: 1, stopLoss: 80000 },
      connectedWallet
    );
    expect(result.warnings.some((w) => w.includes("requires explicit confirmation"))).toBe(true);
  });

  it("warns about high leverage (>10x)", () => {
    const result = checkRisk(
      { venue: "hyperliquid", asset: "BTC", direction: "long", size: 100, leverage: 15, stopLoss: 80000 },
      connectedWallet
    );
    expect(result.warnings.some((w) => w.includes("High leverage"))).toBe(true);
  });
});

describe("estimateLiquidationPrice", () => {
  it("estimates long liquidation below entry", () => {
    const liq = estimateLiquidationPrice(100_000, 10, "long");
    expect(liq).toBe(90_000); // 10% below
  });

  it("estimates short liquidation above entry", () => {
    const liq = estimateLiquidationPrice(100_000, 10, "short");
    expect(liq).toBeCloseTo(110_000, 0); // 10% above
  });

  it("handles 1x leverage", () => {
    const liq = estimateLiquidationPrice(100_000, 1, "long");
    expect(liq).toBe(0); // 100% below — can't actually get liquidated at 1x
  });

  it("handles 5x leverage", () => {
    const liq = estimateLiquidationPrice(84_200, 5, "long");
    expect(liq).toBeCloseTo(67_360, 0);
  });
});

describe("estimateFees", () => {
  it("estimates Hyperliquid taker fee at 0.05%", () => {
    expect(estimateFees(1000, "hyperliquid")).toBeCloseTo(0.5, 2);
  });

  it("estimates Polymarket spread at ~2%", () => {
    expect(estimateFees(1000, "polymarket")).toBeCloseTo(20, 0);
  });
});
