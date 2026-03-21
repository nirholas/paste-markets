"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { checkRisk, estimateLiquidationPrice, estimateFees } from "@/lib/execution/risk";
import { getRobinhoodInstruction } from "@/lib/execution/robinhood";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradeParams {
  tradeId?: string;
  venue: "hyperliquid" | "polymarket" | "robinhood";
  asset: string;
  direction: "long" | "short" | "yes" | "no";
  currentPrice?: number;
  suggestedSize?: number;
  suggestedLeverage?: number;
  // Polymarket-specific
  conditionId?: string;
  marketQuestion?: string;
  outcomePrice?: number; // price per share (0-1)
  // Source context
  authorHandle?: string;
  thesis?: string;
}

type Step = "configure" | "confirming" | "executing" | "success" | "error";

interface Props {
  params: TradeParams;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeConfirmModal({ params, onClose, onSuccess }: Props) {
  const wallet = useWallet();

  const isPolymarket = params.venue === "polymarket";
  const isRobinhood = params.venue === "robinhood";
  const isPerps = params.venue === "hyperliquid";

  const [step, setStep] = useState<Step>("configure");
  const [size, setSize] = useState(String(params.suggestedSize ?? (isPolymarket ? 50 : 500)));
  const [leverage, setLeverage] = useState(String(params.suggestedLeverage ?? 5));
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const sizeNum = parseFloat(size) || 0;
  const levNum = parseFloat(leverage) || 1;
  const price = params.currentPrice ?? 0;
  const notional = isPerps ? sizeNum * levNum : sizeNum;

  // ── Robinhood: show instructions only ──────────────────────────────────
  if (isRobinhood) {
    const instruction = getRobinhoodInstruction(
      params.asset,
      params.direction,
      sizeNum || undefined
    );

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-4">
            Execute on Robinhood
          </div>

          <div className="text-center space-y-4">
            <div className="text-xl font-bold text-text-primary">
              {instruction.ticker} — {instruction.direction.toUpperCase()}
            </div>

            <p className="text-text-secondary text-sm">
              We can&apos;t place orders on Robinhood automatically.
              Open the app to execute:
            </p>

            <div className="flex gap-3 justify-center">
              <a
                href={instruction.deepLink}
                className="border border-[#2ecc71] text-[#2ecc71] px-4 py-2 text-sm font-bold rounded-lg hover:bg-[#2ecc71]/10 transition-colors"
              >
                Open in App
              </a>
              <a
                href={instruction.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-border text-text-secondary px-4 py-2 text-sm rounded-lg hover:border-accent transition-colors"
              >
                Open Web
              </a>
            </div>

            <p className="text-xs text-text-muted">
              Tip: Search &ldquo;{instruction.ticker}&rdquo; &rarr;{" "}
              {instruction.direction === "buy" ? "Buy" : "Sell"} &rarr; Market Order
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // ── Risk check ─────────────────────────────────────────────────────────
  const riskCheck = checkRisk(
    {
      venue: params.venue,
      asset: params.asset,
      direction: params.direction,
      size: sizeNum,
      leverage: isPerps ? levNum : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      walletBalance: wallet.balances.usdc,
    },
    wallet
  );

  // ── Execute ────────────────────────────────────────────────────────────
  async function handleExecute() {
    if (!wallet.connected) {
      setError("Connect your wallet first");
      return;
    }

    if (riskCheck.blocked) {
      setError(riskCheck.blockReason ?? "Trade blocked by risk controls");
      return;
    }

    setStep("executing");
    setError("");

    try {
      const body: Record<string, any> = {
        tradeId: params.tradeId,
        venue: params.venue,
        asset: params.asset,
        direction: params.direction,
        size: sizeNum,
        leverage: isPerps ? levNum : 1,
        orderType: "market",
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        walletAddress: wallet.address,
        conditionId: params.conditionId,
      };

      // Sign confirmation message
      const confirmMsg = `Execute ${params.direction} ${params.asset} $${sizeNum} on ${params.venue}`;
      const signature = await wallet.sign(confirmMsg);
      body.signature = signature;

      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Execution failed");
        setStep("error");
        return;
      }

      setResult(data);
      setStep("success");
      onSuccess?.(data);
    } catch (err: any) {
      setError(err.message || "Execution failed");
      setStep("error");
    }
  }

  // ── Success ────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-surface border border-win/30 rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-center space-y-4">
            <div className="text-win font-bold text-lg">Order Executed</div>
            <div className="space-y-2 text-sm">
              {result?.fillPrice && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Fill Price</span>
                  <span className="text-text-primary font-mono">${result.fillPrice.toLocaleString()}</span>
                </div>
              )}
              {result?.fees != null && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Fees</span>
                  <span className="text-text-primary font-mono">${result.fees.toFixed(2)}</span>
                </div>
              )}
              {result?.executionId && (
                <div className="text-xs text-text-muted font-mono mt-2">
                  ID: {result.executionId.slice(0, 16)}...
                </div>
              )}
            </div>
            <a
              href="/positions"
              className="block w-full py-2 text-center border border-accent text-accent text-sm font-bold rounded-lg hover:bg-accent/10 transition-colors"
            >
              View Positions
            </a>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Configure / Confirm ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-bold text-text-primary">
            {isPolymarket ? "Confirm Prediction" : "Confirm Trade"}
          </span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary text-xs"
          >
            Cancel
          </button>
        </div>

        {/* Trade summary */}
        <div className="bg-background border border-border rounded-lg p-4 mb-5 space-y-3">
          <div className="text-text-primary font-bold">
            {params.asset}{" "}
            <span className={params.direction === "long" || params.direction === "yes" ? "text-win" : "text-loss"}>
              {params.direction.toUpperCase()}
            </span>
            <span className="text-text-muted text-sm font-normal ml-2">
              on {params.venue === "hyperliquid" ? "Hyperliquid" : "Polymarket"}
            </span>
          </div>

          {/* Polymarket layout */}
          {isPolymarket && params.marketQuestion && (
            <p className="text-text-secondary text-sm italic">
              &ldquo;{params.marketQuestion}&rdquo;
            </p>
          )}

          {/* Price info */}
          {price > 0 && !isPolymarket && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Current Price</span>
              <span className="text-text-primary font-mono">${price.toLocaleString()}</span>
            </div>
          )}

          {isPolymarket && params.outcomePrice != null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Price per Share</span>
              <span className="text-text-primary font-mono">
                ${params.outcomePrice.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Size input */}
        <div className="mb-4">
          <label className="text-[11px] uppercase tracking-widest text-text-muted block mb-1">
            {isPolymarket ? "Amount (USDC)" : "Position Size (USDC)"}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              step="10"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={step === "executing"}
              className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono text-text-primary focus:border-accent outline-none"
            />
            <div className="flex gap-1">
              {(isPolymarket ? [25, 50, 100] : [100, 500, 1000]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSize(String(preset))}
                  disabled={step === "executing"}
                  className="px-2 py-1 text-[11px] border border-border rounded-lg hover:border-accent text-text-muted hover:text-text-secondary transition-colors"
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leverage (perps only) */}
        {isPerps && (
          <div className="mb-4">
            <label className="text-[11px] uppercase tracking-widest text-text-muted block mb-1">
              Leverage
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                disabled={step === "executing"}
                className="w-20 bg-background border border-border rounded px-3 py-2 text-sm font-mono text-text-primary focus:border-accent outline-none"
              />
              <span className="text-text-muted text-sm">x</span>
              <div className="flex gap-1 ml-auto">
                {[1, 3, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setLeverage(String(preset))}
                    disabled={step === "executing"}
                    className="px-2 py-1 text-[11px] border border-border rounded-lg hover:border-accent text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {preset}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Computed values */}
        <div className="bg-background border border-border rounded-lg p-3 mb-4 space-y-2 text-sm">
          {isPerps && (
            <>
              <div className="flex justify-between">
                <span className="text-text-muted">Notional</span>
                <span className="text-text-primary font-mono">${notional.toLocaleString()}</span>
              </div>
              {price > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Est. Liquidation</span>
                  <span className="text-text-primary font-mono">
                    ${estimateLiquidationPrice(
                      price,
                      levNum,
                      params.direction as "long" | "short"
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {" "}
                    <span className="text-text-muted">
                      ({((-100 / levNum)).toFixed(0)}%)
                    </span>
                  </span>
                </div>
              )}
            </>
          )}

          {isPolymarket && params.outcomePrice != null && params.outcomePrice > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-text-muted">Shares</span>
                <span className="text-text-primary font-mono">
                  ~{Math.floor(sizeNum / params.outcomePrice)}{" "}
                  {params.direction.toUpperCase()} shares
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">If {params.direction.toUpperCase()} settles</span>
                <span className="text-win font-mono">
                  +${((sizeNum / params.outcomePrice) - sizeNum).toFixed(2)}
                  {" "}(+{((1 / params.outcomePrice - 1) * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">If {params.direction === "yes" ? "NO" : "YES"} settles</span>
                <span className="text-loss font-mono">
                  -${sizeNum.toFixed(2)} (-100%)
                </span>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <span className="text-text-muted">Est. Fees</span>
            <span className="text-text-primary font-mono">
              ${estimateFees(sizeNum, params.venue as "hyperliquid" | "polymarket").toFixed(2)}
            </span>
          </div>
        </div>

        {/* Stop Loss / Take Profit (perps only) */}
        {isPerps && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-widest text-text-muted block mb-1">
                Stop Loss
              </label>
              <input
                type="number"
                placeholder="optional"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                disabled={step === "executing"}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono text-text-primary focus:border-accent outline-none placeholder-text-muted"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-widest text-text-muted block mb-1">
                Take Profit
              </label>
              <input
                type="number"
                placeholder="optional"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                disabled={step === "executing"}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono text-text-primary focus:border-accent outline-none placeholder-text-muted"
              />
            </div>
          </div>
        )}

        {/* Warnings */}
        {riskCheck.warnings.length > 0 && (
          <div className="mb-4 space-y-1">
            {riskCheck.warnings.map((w, i) => (
              <div
                key={i}
                className="text-xs text-amber border border-amber/20 bg-amber/5 rounded px-3 py-1.5"
              >
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Block reason */}
        {riskCheck.blocked && (
          <div className="mb-4 text-xs text-loss border border-loss/30 bg-loss/5 rounded px-3 py-2">
            {riskCheck.blockReason}
          </div>
        )}

        {/* Disclaimer */}
        <div className="mb-4 p-3 bg-background rounded border border-border text-[11px] text-text-muted">
          This will place a REAL order with REAL money. paste.markets is not
          responsible for losses.
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 text-xs text-loss border border-loss/30 bg-loss/5 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Wallet not connected */}
        {!wallet.connected && (
          <div className="mb-3 text-xs text-accent border border-accent/30 bg-accent/5 rounded px-3 py-2">
            Connect your wallet to execute trades
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg border border-border text-text-muted text-sm hover:border-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={
              step === "executing" ||
              !wallet.connected ||
              riskCheck.blocked ||
              sizeNum <= 0
            }
            className="flex-1 py-2.5 px-4 rounded-lg bg-win/10 border border-win text-win font-bold text-sm hover:bg-win/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === "executing"
              ? "Executing..."
              : isPolymarket
              ? `Confirm & Buy ${params.direction.toUpperCase()}`
              : "Confirm & Execute"}
          </button>
        </div>
      </div>
    </div>
  );
}
