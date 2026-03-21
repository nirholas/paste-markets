"use client";

import { useState, useEffect, useCallback } from "react";

interface WagerStats {
  trade_card_id: string;
  total_wagered: number;
  wager_count: number;
  wager_deadline: string;
  settlement_date: string;
  status: "active" | "settled" | "cancelled";
  caller_tip_earned: number | null;
  is_deadline_passed: boolean;
  is_settled: boolean;
}

interface WagerData {
  enabled: boolean;
  stats: WagerStats | null;
  wagerVaultAddress: string | null;
  wagers: Array<{
    id: string;
    handle: string | null;
    amount: number;
    currency: string;
    status: string;
    wageredAt: string;
    pnlAmount: number | null;
  }>;
}

interface WagerWidgetProps {
  tradeId: string;
  authorHandle: string;
  ticker: string;
  direction: string;
  entryPrice?: number | null;
  pnlPct?: number | null;
}

function formatUSDC(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "closed";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 3_600_000);
  if (h >= 24) return `in ${Math.floor(h / 24)}d`;
  return `in ${h}h`;
}

// ─── wager modal ──────────────────────────────────────────────────────────────

interface WagerModalProps {
  tradeId: string;
  ticker: string;
  direction: string;
  vaultAddress: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function WagerModal({ tradeId, ticker, direction, vaultAddress, onClose, onSuccess }: WagerModalProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [handle, setHandle] = useState("");
  const [amount, setAmount] = useState("");
  const [txSig, setTxSig] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "send" | "verify">("form");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amtNum = parseFloat(amount);
    if (!walletAddress || !amtNum || !txSig) {
      setError("All fields are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          tradeCardId: tradeId,
          walletAddress,
          handle: handle ? handle.replace(/^@/, "") : undefined,
          amount: amtNum,
          currency: "USDC",
          txSignature: txSig,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full border border-[#1a1a2e] bg-[#0a0a1a] text-[#f0f0f0] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#3b82f6] transition-colors placeholder:text-[#555568] font-mono";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 w-full max-w-md space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#555568] mb-1">Back This Call</p>
            <h2 className="text-lg font-bold text-[#f0f0f0]">
              ${ticker.toUpperCase()}{" "}
              <span className={direction === "long" || direction === "yes" ? "text-[#2ecc71]" : "text-[#e74c3c]"}>
                {direction.toUpperCase()}
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#555568] hover:text-[#f0f0f0] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Steps nav */}
        <div className="flex gap-4 text-xs font-mono">
          {(["form", "send", "verify"] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`${step === s ? "text-[#3b82f6]" : "text-[#555568]"}`}
            >
              {i + 1}. {s === "form" ? "Amount" : s === "send" ? "Send USDC" : "Confirm"}
            </button>
          ))}
        </div>

        {/* Step 1: enter amount + wallet */}
        {step === "form" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#555568] uppercase tracking-wider block mb-1">
                Wager Amount (USDC)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10"
                className={inputCls}
              />
              <p className="text-xs text-[#555568] mt-1">Max 500 USDC per call</p>
            </div>
            <div>
              <label className="text-xs text-[#555568] uppercase tracking-wider block mb-1">
                Your Solana Wallet
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value.trim())}
                placeholder="Base58 address"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-[#555568] uppercase tracking-wider block mb-1">
                Twitter Handle (optional)
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@yourtag"
                className={inputCls}
              />
            </div>
            <button
              onClick={() => amount && walletAddress ? setStep("send") : setError("Enter amount and wallet address")}
              className="w-full border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-[#0a0a1a] text-sm py-2 rounded transition-colors font-mono"
            >
              Next: Send USDC →
            </button>
          </div>
        )}

        {/* Step 2: send USDC to vault */}
        {step === "send" && (
          <div className="space-y-4">
            <div className="bg-[#0a0a1a] border border-[#1a1a2e] rounded p-3 space-y-2">
              <p className="text-xs uppercase tracking-widest text-[#555568]">Send exactly</p>
              <p className="text-2xl font-bold text-[#f0f0f0] font-mono">{amount} USDC</p>
              <p className="text-xs uppercase tracking-widest text-[#555568] mt-2">To vault address</p>
              <p className="text-xs text-[#c8c8d0] font-mono break-all">
                {vaultAddress ?? "vault address loading..."}
              </p>
            </div>
            <p className="text-xs text-[#555568]">
              Send USDC on Solana to the vault address above, then paste your transaction signature below.
            </p>
            <button
              onClick={() => setStep("verify")}
              className="w-full border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-[#0a0a1a] text-sm py-2 rounded transition-colors font-mono"
            >
              I&apos;ve sent it →
            </button>
          </div>
        )}

        {/* Step 3: confirm tx */}
        {step === "verify" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-[#555568] uppercase tracking-wider block mb-1">
                Transaction Signature
              </label>
              <input
                type="text"
                value={txSig}
                onChange={(e) => setTxSig(e.target.value.trim())}
                placeholder="Paste Solana tx signature"
                className={inputCls}
              />
              <p className="text-xs text-[#555568] mt-1">
                Find this in your wallet&apos;s transaction history
              </p>
            </div>

            {error && (
              <p className="text-xs text-[#e74c3c] border border-[#e74c3c]/30 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !txSig}
              className="w-full border border-[#2ecc71] text-[#2ecc71] hover:bg-[#2ecc71] hover:text-[#0a0a1a] text-sm py-2 rounded transition-colors font-mono disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Confirming..." : "Confirm Wager"}
            </button>
          </form>
        )}

        <p className="text-[11px] text-[#555568] text-center">
          If the call wins, you earn proportional profit minus 10% caller tip.
          <br />
          Max loss = your stake.
        </p>
      </div>
    </div>
  );
}

// ─── main widget ──────────────────────────────────────────────────────────────

export function WagerWidget({ tradeId, authorHandle, ticker, direction, entryPrice, pnlPct }: WagerWidgetProps) {
  const [data, setData] = useState<WagerData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/wager/${encodeURIComponent(tradeId)}`);
      if (res.ok) setData(await res.json());
    } catch {
      // non-critical
    }
  }, [tradeId]);

  useEffect(() => { load(); }, [load]);

  async function handleEnable() {
    setEnabling(true);
    try {
      await fetch("/api/wager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enable",
          tradeCardId: tradeId,
          authorHandle,
          ticker,
          direction,
          entryPrice: entryPrice ?? undefined,
        }),
      });
      await load();
    } finally {
      setEnabling(false);
    }
  }

  // Not yet enabled — show subtle "Enable wagering" for callers
  if (!data?.enabled) {
    return (
      <div className="pt-3 border-t border-[#1a1a2e]">
        <button
          onClick={handleEnable}
          disabled={enabling}
          className="text-xs text-[#555568] hover:text-[#3b82f6] transition-colors font-mono disabled:opacity-40"
        >
          {enabling ? "Enabling..." : "+ Enable wagering on this call"}
        </button>
      </div>
    );
  }

  const stats = data.stats!;

  // ── settled ──────────────────────────────────────────────────────────────
  if (stats.is_settled) {
    return (
      <div className="pt-3 border-t border-[#1a1a2e] space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest border border-[#2ecc71]/50 text-[#2ecc71] px-2 py-0.5 rounded font-mono">
            SETTLED
          </span>
          <span className="text-xs text-[#555568]">
            {stats.wager_count} backer{stats.wager_count !== 1 ? "s" : ""} ·{" "}
            {formatUSDC(stats.total_wagered)} USDC wagered
          </span>
        </div>
        {stats.caller_tip_earned !== null && stats.caller_tip_earned > 0 && (
          <p className="text-xs text-[#2ecc71] font-mono">
            Caller earned {formatUSDC(stats.caller_tip_earned)} USDC tip
          </p>
        )}
      </div>
    );
  }

  // ── deadline passed, awaiting settlement ─────────────────────────────────
  if (stats.is_deadline_passed) {
    const pnlColor = pnlPct == null ? "text-[#f39c12]" : pnlPct > 0 ? "text-[#2ecc71]" : "text-[#e74c3c]";
    return (
      <div className="pt-3 border-t border-[#1a1a2e] space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#555568]">
            {stats.wager_count} backer{stats.wager_count !== 1 ? "s" : ""} ·{" "}
            {formatUSDC(stats.total_wagered)} USDC
          </span>
          <span className="text-[#555568]">
            Settles {timeUntil(stats.settlement_date)}
          </span>
        </div>
        {pnlPct != null && (
          <p className={`text-sm font-bold font-mono ${pnlColor}`}>
            {pnlPct > 0 ? "+" : ""}{pnlPct.toFixed(1)}% · wagerers tracking
          </p>
        )}
        <p className="text-[11px] text-[#555568]">Wager window closed — awaiting settlement</p>
      </div>
    );
  }

  // ── active: accepting wagers ──────────────────────────────────────────────
  return (
    <>
      <div className="pt-3 border-t border-[#1a1a2e] space-y-3">
        {/* Stats bar */}
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3 text-[#c8c8d0]">
            {stats.total_wagered > 0 ? (
              <>
                <span>
                  <span className="text-[#f0f0f0] font-bold">{formatUSDC(stats.total_wagered)}</span>
                  <span className="text-[#555568]"> USDC</span>
                </span>
                <span className="text-[#555568]">·</span>
                <span>
                  <span className="text-[#f0f0f0] font-bold">{stats.wager_count}</span>
                  <span className="text-[#555568]"> backer{stats.wager_count !== 1 ? "s" : ""}</span>
                </span>
              </>
            ) : (
              <span className="text-[#555568]">No wagers yet — be first</span>
            )}
          </div>
          <span className="text-[#f39c12] text-[11px]">{timeLeft(stats.wager_deadline)}</span>
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowModal(true)}
          className="w-full border border-[#3b82f6]/50 hover:border-[#3b82f6] bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 text-[#3b82f6] text-sm py-2 rounded transition-colors font-mono"
        >
          Back This Call
        </button>
      </div>

      {showModal && (
        <WagerModal
          tradeId={tradeId}
          ticker={ticker}
          direction={direction}
          vaultAddress={data.wagerVaultAddress}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </>
  );
}
