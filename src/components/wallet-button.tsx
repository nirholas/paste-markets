"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet, type WalletProvider } from "@/lib/wallet";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function explorerUrl(address: string, chain: "evm" | "solana" | null): string {
  if (chain === "solana") {
    return `https://solscan.io/account/${address}`;
  }
  return `https://arbiscan.io/address/${address}`;
}

export function WalletButton() {
  const wallet = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setShowProviders(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleConnect(providerId: WalletProvider) {
    setError(null);
    setConnecting(true);
    try {
      await wallet.connect(providerId);
      setShowProviders(false);
    } catch (err: any) {
      setError(err.message || "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await wallet.disconnect();
    setShowDropdown(false);
  }

  // ── Not connected ────────────────────────────────────────────────────────
  if (!wallet.connected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowProviders(!showProviders)}
          className="border border-accent text-accent px-3 py-1.5 text-xs font-bold hover:bg-accent/10 transition-colors"
        >
          Connect Wallet
        </button>

        {showProviders && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-lg shadow-xl z-50 py-2">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-text-muted">
              Select Provider
            </div>

            {wallet.providers.length === 0 && (
              <div className="px-3 py-3 text-xs text-text-muted">
                No wallet detected. Install MetaMask or Phantom.
              </div>
            )}

            {wallet.providers.map((p) => (
              <button
                key={p.id}
                onClick={() => handleConnect(p.id)}
                disabled={connecting}
                className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-background transition-colors flex items-center justify-between"
              >
                <span>{p.name}</span>
                <span className="text-[10px] text-text-muted uppercase">
                  {p.chain}
                </span>
              </button>
            ))}

            {error && (
              <div className="px-3 py-2 text-xs text-loss border-t border-border mt-1">
                {error}
              </div>
            )}

            {connecting && (
              <div className="px-3 py-2 text-xs text-text-muted animate-pulse border-t border-border mt-1">
                Connecting...
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="border border-win/40 text-win px-3 py-1.5 text-xs font-mono hover:border-win transition-colors flex items-center gap-2"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-win" />
        {shortenAddress(wallet.address!)}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-surface border border-border rounded-lg shadow-xl z-50 py-2">
          {/* Address */}
          <div className="px-3 py-2 border-b border-border">
            <div className="text-xs text-text-muted mb-1">Connected</div>
            <div className="text-sm text-text-primary font-mono truncate">
              {wallet.address}
            </div>
          </div>

          {/* Balances */}
          <div className="px-3 py-2 border-b border-border space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">USDC</span>
              <span className="text-text-primary font-mono">
                {wallet.balances.usdc.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">
                {wallet.chain === "solana" ? "SOL" : "ETH"}
              </span>
              <span className="text-text-primary font-mono">
                {wallet.balances.native.toLocaleString(undefined, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}
              </span>
            </div>
          </div>

          {/* Chain */}
          <div className="px-3 py-2 border-b border-border">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Chain</span>
              <span className="text-text-primary">
                {wallet.chain === "solana" ? "Solana" : "Arbitrum"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <a
              href={explorerUrl(wallet.address!, wallet.chain)}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-sm text-text-secondary hover:text-accent hover:bg-background transition-colors"
            >
              View on Explorer
            </a>
            <button
              onClick={() => wallet.refreshBalances()}
              className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-accent hover:bg-background transition-colors"
            >
              Refresh Balances
            </button>
            <button
              onClick={handleDisconnect}
              className="w-full text-left px-3 py-2 text-sm text-loss hover:bg-background transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
