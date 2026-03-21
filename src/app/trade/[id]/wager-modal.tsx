"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/lib/wallet";

interface WagerModalProps {
  tradeId: string;
  authorHandle: string;
  settlementDate: string;
  callerTipBps: number;
}

type Step = "cta" | "form" | "submitting" | "success" | "error";

const MIN_WAGER = 5;
const MAX_WAGER = 500;
const VAULT_ADDRESS = process.env["NEXT_PUBLIC_WAGER_VAULT_ADDRESS"] ?? "";

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export function WagerModal({
  tradeId,
  authorHandle,
  settlementDate,
  callerTipBps,
}: WagerModalProps) {
  const wallet = useWallet();
  const isWalletConnected = wallet.connected && wallet.chain === "solana";

  const [step, setStep] = useState<Step>("cta");
  const [amount, setAmount] = useState<string>("50");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [handle, setHandle] = useState<string>("");
  const [txSignature, setTxSignature] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [successWagerId, setSuccessWagerId] = useState<string>("");

  const callerTipPct = (callerTipBps / 100).toFixed(0);

  // Auto-populate wallet address when Phantom is connected
  useEffect(() => {
    if (isWalletConnected && wallet.address) {
      setWalletAddress(wallet.address);
    }
  }, [isWalletConnected, wallet.address]);

  // Submit wager to backend (shared by both flows)
  async function submitWagerToApi(addr: string, amountNum: number, sig: string) {
    const res = await fetch("/api/wager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        tradeCardId: tradeId,
        walletAddress: addr,
        amount: amountNum,
        txSignature: sig,
        handle: handle.replace(/^@/, "") || undefined,
        currency: "USDC",
      }),
    });

    const data = (await res.json()) as { ok?: boolean; wager?: { id: string }; error?: string };

    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Failed to place wager");
    }

    return data.wager?.id ?? "";
  }

  // Auto-transfer flow: wallet connected, one-click send + submit
  async function handleAutoTransfer() {
    setError("");

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < MIN_WAGER || amountNum > MAX_WAGER) {
      setError(`Amount must be between ${MIN_WAGER} and ${MAX_WAGER} USDC`);
      return;
    }

    if (!VAULT_ADDRESS) {
      setError("Vault address not configured");
      return;
    }

    setStep("submitting");

    try {
      const result = await wallet.sendTransaction(VAULT_ADDRESS, amountNum);
      if (!result.confirmed) throw new Error("Transaction not confirmed");

      const wagerId = await submitWagerToApi(wallet.address!, amountNum, result.signature);
      setSuccessWagerId(wagerId);
      setStep("success");
    } catch (err: any) {
      setError(err.message || String(err));
      setStep("form");
    }
  }

  // Manual flow: user pastes wallet address + tx signature
  async function handleManualSubmit() {
    setError("");

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < MIN_WAGER || amountNum > MAX_WAGER) {
      setError(`Amount must be between ${MIN_WAGER} and ${MAX_WAGER} USDC`);
      return;
    }

    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      setError("Enter a valid Solana wallet address");
      return;
    }

    const trimmedSig = txSignature.trim();
    if (!trimmedSig) {
      setError("Paste your Solana transaction signature");
      return;
    }

    setStep("submitting");

    try {
      const wagerId = await submitWagerToApi(walletAddress, amountNum, trimmedSig);
      setSuccessWagerId(wagerId);
      setStep("success");
    } catch (err: any) {
      setError(err.message || String(err));
      setStep("form");
    }
  }

  // ── CTA button ─────────────────────────────────────────────────────────────
  if (step === "cta") {
    return (
      <button
        onClick={() => setStep("form")}
        className="w-full py-3 px-4 rounded-lg bg-win/10 border border-win text-win font-mono text-sm font-bold hover:bg-win/20 transition-colors"
      >
        Back This Call
      </button>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="bg-win/5 border border-win/30 rounded-lg p-4 text-center">
        <div className="text-win font-bold text-sm mb-1">You&apos;re in</div>
        <div className="text-text-muted text-xs mb-3">
          {parseFloat(amount).toFixed(0)} USDC wagered on @{authorHandle}&apos;s call
        </div>
        <div className="text-text-muted text-xs">
          Settles {settlementDate}
        </div>
        {successWagerId && (
          <div className="mt-2 text-[10px] text-text-muted font-mono">
            ID: {successWagerId.slice(0, 16)}…
          </div>
        )}
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-text-primary">Back This Call</span>
        <button
          onClick={() => setStep("cta")}
          className="text-text-muted hover:text-text-secondary text-xs rounded-lg"
        >
          Cancel
        </button>
      </div>

      {/* Amount */}
      <div className="mb-4">
        <label className="text-[11px] uppercase tracking-widest text-text-muted block mb-1">
          Amount (USDC)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={MIN_WAGER}
            max={MAX_WAGER}
            step="5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={step === "submitting"}
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono text-text-primary focus:border-accent outline-none"
          />
          <div className="flex gap-1">
            {[25, 100, 250].map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(String(preset))}
                disabled={step === "submitting"}
                className="px-2 py-1 text-[11px] border border-border rounded-lg hover:border-accent text-text-muted hover:text-text-secondary transition-colors"
              >
                ${preset}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-text-muted mt-1">
          Min ${MIN_WAGER} — Max ${MAX_WAGER} USDC
        </div>
      </div>

      {/* Optional Twitter handle */}
      <div className="mb-4">
        <label className="text-[11px] uppercase tracking-widest text-text-muted block mb-1">
          Twitter Handle (optional)
        </label>
        <input
          type="text"
          placeholder="@you"
          value={handle}
          onChange={(e) => setHandle(e.target.value.trim())}
          disabled={step === "submitting"}
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono text-text-primary focus:border-accent outline-none placeholder-text-muted"
        />
      </div>

      {isWalletConnected ? (
        <>
          {/* Connected wallet info */}
          <div className="mb-4 p-3 bg-background rounded border border-accent/30 text-[11px] text-text-muted space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-win" />
              <span className="text-text-secondary">Phantom connected</span>
            </div>
            <div className="font-mono text-text-primary break-all">
              {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-4)}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Manual wallet address */}
          <div className="mb-4">
            <label className="text-[11px] uppercase tracking-widest text-text-muted block mb-1">
              Solana Wallet Address
            </label>
            <input
              type="text"
              placeholder="Base58 address…"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value.trim())}
              disabled={step === "submitting"}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono text-text-primary focus:border-accent outline-none placeholder-text-muted"
            />
          </div>

          {/* Manual transaction signature */}
          <div className="mb-4">
            <label className="text-[11px] uppercase tracking-widest text-text-muted block mb-1">
              Transaction Signature
            </label>
            <input
              type="text"
              placeholder="Paste Solana tx signature…"
              value={txSignature}
              onChange={(e) => setTxSignature(e.target.value.trim())}
              disabled={step === "submitting"}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono text-text-primary focus:border-accent outline-none placeholder-text-muted"
            />
            <div className="text-[10px] text-text-muted mt-1">
              Transfer {amount || "0"} USDC first, then paste the tx signature here
            </div>
          </div>
        </>
      )}

      {/* Disclosure */}
      <div className="mb-4 p-3 bg-background rounded border border-border text-[11px] text-text-muted space-y-1">
        <div>Settlement: {settlementDate}</div>
        <div>{callerTipPct}% of profits go to @{authorHandle} as a tip</div>
        <div>Losses: proportional to your wager</div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 text-xs text-loss border border-loss/30 bg-loss/5 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={isWalletConnected ? handleAutoTransfer : handleManualSubmit}
        disabled={step === "submitting"}
        className="w-full py-2.5 px-4 rounded-lg bg-win/10 border border-win text-win font-mono text-sm font-bold hover:bg-win/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {step === "submitting"
          ? "Placing wager…"
          : isWalletConnected
            ? `Send ${amount || "0"} USDC & Back`
            : "Sign & Back"}
      </button>
    </div>
  );
}
