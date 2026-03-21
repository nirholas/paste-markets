"use client";

import { useState, useRef, useEffect } from "react";

interface DoubleDownPopoverProps {
  tradeId: string;
  ticker: string;
  direction: string;
  authorHandle: string;
  totalWagered: number;
  backerCount: number;
  onSuccess?: () => void;
}

const PRESETS = [5, 10, 25, 50, 100] as const;

function formatUSDC(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function DoubleDownButton({
  tradeId,
  ticker,
  direction,
  authorHandle,
  totalWagered,
  backerCount,
  onSuccess,
}: DoubleDownPopoverProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "wallet" | "confirm">("select");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [handle, setHandle] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Animated counter for social proof
  const [displayCount, setDisplayCount] = useState(backerCount);
  const [displayTotal, setDisplayTotal] = useState(totalWagered);

  useEffect(() => {
    setDisplayCount(backerCount);
    setDisplayTotal(totalWagered);
  }, [backerCount, totalWagered]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        resetState();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function resetState() {
    setStep("select");
    setSelectedAmount(null);
    setTxSignature("");
    setError(null);
    setSuccess(false);
  }

  async function handleQuickWager() {
    if (!selectedAmount || !walletAddress) return;
    const trimmedSig = txSignature.trim();
    if (!trimmedSig) {
      setError("Paste your Solana transaction signature");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/wagers/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          amount: selectedAmount,
          walletAddress,
          txSignature: trimmedSig,
          handle: handle ? handle.replace(/^@/, "") : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to place wager");
        return;
      }

      setSuccess(true);
      setDisplayCount(data.backerCount ?? backerCount + 1);
      setDisplayTotal(data.totalWagered ?? totalWagered + selectedAmount);

      setTimeout(() => {
        setOpen(false);
        resetState();
        onSuccess?.();
      }, 1500);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const isLong = direction === "long" || direction === "yes";
  const accentColor = isLong ? "#2ecc71" : "#e74c3c";

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); if (!open) resetState(); }}
        className="flex items-center gap-1.5 text-[11px] font-mono border border-[#3b82f6]/50 hover:border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10 px-2.5 py-1 rounded transition-all"
      >
        <span className="text-xs">&#x2B06;</span>
        Double Down
        {displayCount > 0 && (
          <span className="text-[#555568] ml-1">
            {displayCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 bottom-full mb-2 left-0 w-72 bg-[#0f0f22] border border-[#1a1a2e] rounded-lg shadow-2xl p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#555568]">Double Down</p>
              <p className="text-sm font-bold text-[#f0f0f0]">
                ${ticker.toUpperCase()}{" "}
                <span style={{ color: accentColor }}>{direction.toUpperCase()}</span>
              </p>
            </div>
            <button
              onClick={() => { setOpen(false); resetState(); }}
              className="text-[#555568] hover:text-[#f0f0f0] text-lg leading-none"
            >
              x
            </button>
          </div>

          {/* Social proof */}
          {displayCount > 0 && (
            <div className="text-[11px] font-mono text-[#555568]">
              <span className="text-[#f0f0f0] font-bold">{displayCount}</span> backed
              <span className="mx-1">·</span>
              <span className="text-[#f0f0f0] font-bold">{formatUSDC(displayTotal)}</span> USDC
            </div>
          )}

          {success ? (
            <div className="text-center py-3">
              <p className="text-[#2ecc71] font-bold text-sm font-mono">Wager placed!</p>
              <p className="text-[11px] text-[#555568] mt-1">
                You backed @{authorHandle}&apos;s {ticker.toUpperCase()} {direction.toUpperCase()} call
              </p>
            </div>
          ) : step === "select" ? (
            <>
              {/* Amount presets */}
              <div className="grid grid-cols-5 gap-1.5">
                {PRESETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setSelectedAmount(amt); setStep("wallet"); }}
                    className={`text-xs font-mono py-2 rounded border transition-all ${
                      selectedAmount === amt
                        ? "border-[#3b82f6] bg-[#3b82f6]/20 text-[#3b82f6]"
                        : "border-[#1a1a2e] text-[#c8c8d0] hover:border-[#3b82f6]/50 hover:text-[#3b82f6]"
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#555568] text-center">Select USDC amount</p>
            </>
          ) : step === "wallet" ? (
            <div className="space-y-2">
              <p className="text-xs text-[#c8c8d0]">
                Wager <span className="text-[#f0f0f0] font-bold">{selectedAmount} USDC</span>
              </p>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value.trim())}
                placeholder="Your Solana wallet address"
                className="w-full border border-[#1a1a2e] bg-[#0a0a1a] text-[#f0f0f0] text-xs px-3 py-2 rounded focus:outline-none focus:border-[#3b82f6] transition-colors placeholder:text-[#555568] font-mono"
              />
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@handle (optional)"
                className="w-full border border-[#1a1a2e] bg-[#0a0a1a] text-[#f0f0f0] text-xs px-3 py-2 rounded focus:outline-none focus:border-[#3b82f6] transition-colors placeholder:text-[#555568] font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("select")}
                  className="flex-1 text-xs font-mono text-[#555568] hover:text-[#c8c8d0] border border-[#1a1a2e] py-1.5 rounded transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => walletAddress ? setStep("confirm") : setError("Enter wallet address")}
                  className="flex-1 text-xs font-mono border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-[#0a0a1a] py-1.5 rounded transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-[#0a0a1a] border border-[#1a1a2e] rounded p-2 text-xs font-mono space-y-1">
                <p className="text-[#555568]">
                  Amount: <span className="text-[#f0f0f0]">{selectedAmount} USDC</span>
                </p>
                <p className="text-[#555568]">
                  Wallet: <span className="text-[#c8c8d0] break-all">{walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}</span>
                </p>
                <p className="text-[#555568]">
                  Caller tip: <span className="text-[#c8c8d0]">10% of profit</span>
                </p>
              </div>

              <input
                type="text"
                value={txSignature}
                onChange={(e) => setTxSignature(e.target.value.trim())}
                placeholder="Paste Solana tx signature"
                className="w-full border border-[#1a1a2e] bg-[#0a0a1a] text-[#f0f0f0] text-xs px-3 py-2 rounded focus:outline-none focus:border-[#3b82f6] transition-colors placeholder:text-[#555568] font-mono"
              />
              <p className="text-[9px] text-[#555568]">
                Transfer {selectedAmount} USDC first, then paste the tx signature
              </p>

              {error && (
                <p className="text-[10px] text-[#e74c3c] border border-[#e74c3c]/30 rounded px-2 py-1">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("wallet")}
                  className="flex-1 text-xs font-mono text-[#555568] hover:text-[#c8c8d0] border border-[#1a1a2e] py-1.5 rounded transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleQuickWager}
                  disabled={submitting}
                  className="flex-1 text-xs font-mono border border-[#2ecc71] text-[#2ecc71] hover:bg-[#2ecc71] hover:text-[#0a0a1a] py-1.5 rounded transition-colors disabled:opacity-40"
                >
                  {submitting ? "Placing..." : "Confirm Wager"}
                </button>
              </div>
            </div>
          )}

          <p className="text-[9px] text-[#555568] text-center leading-tight">
            You earn proportional profit minus 10% caller tip. Max loss = your stake.
          </p>
        </div>
      )}
    </div>
  );
}
