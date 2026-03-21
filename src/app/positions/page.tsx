"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import type { Position } from "@/lib/execution/positions";
import { WalletButton } from "@/components/wallet-button";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function PnlDisplay({ pnl, pnlPct }: { pnl: number; pnlPct: number }) {
  const color = pnl >= 0 ? "text-win" : "text-loss";
  const sign = pnl >= 0 ? "+" : "";
  return (
    <span className={`font-mono font-bold ${color}`}>
      {sign}${pnl.toFixed(2)} ({sign}{pnlPct.toFixed(1)}%)
    </span>
  );
}

function PositionCard({
  position,
  onClose,
  closing,
}: {
  position: Position;
  onClose: (id: string) => void;
  closing: boolean;
}) {
  const isLong = position.direction === "long" || position.direction === "yes";
  const dirColor = isLong ? "text-win" : "text-loss";
  const isPolymarket = position.venue === "polymarket";

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-3 hover:border-accent/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-text-primary font-bold text-lg">
            {position.asset}
          </span>
          <span className={`border px-2 py-0.5 text-xs uppercase tracking-widest font-bold ${
            isLong ? "text-win border-win" : "text-loss border-loss"
          }`}>
            {position.direction.toUpperCase()}
          </span>
          <span className="text-xs text-text-muted uppercase tracking-widest border border-border px-2 py-0.5">
            {position.venue === "hyperliquid" ? "Hyperliquid" : "Polymarket"}
          </span>
          {position.leverage > 1 && (
            <span className="text-xs font-bold px-1.5 py-0.5 border border-accent text-accent rounded">
              {position.leverage}x
            </span>
          )}
        </div>
        <span className="text-xs text-text-muted">{timeAgo(position.openedAt)}</span>
      </div>

      {/* Price info */}
      {!isPolymarket && (
        <div className="flex gap-6 text-sm">
          <span>
            <span className="text-text-muted">Entry </span>
            <span className="text-text-primary font-mono">
              ${position.entryPrice.toLocaleString()}
            </span>
          </span>
          <span>
            <span className="text-text-muted">Now </span>
            <span className="text-text-primary font-mono">
              ${position.currentPrice.toLocaleString()}
            </span>
          </span>
        </div>
      )}

      {/* PnL */}
      <div className="flex items-center gap-3">
        <span className="text-text-muted text-sm">Size: ${position.size.toLocaleString()}</span>
        <span className="text-text-muted">&middot;</span>
        <span className="text-sm">
          PnL: <PnlDisplay pnl={position.unrealizedPnl} pnlPct={position.unrealizedPnlPercent} />
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          onClick={() => onClose(position.id)}
          disabled={closing}
          className="border border-loss text-loss px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-loss/10 transition-colors disabled:opacity-40"
        >
          {closing ? "Closing..." : isPolymarket ? "Sell Shares" : "Close Position"}
        </button>
        {position.tradeId && (
          <Link
            href={`/trade/${position.tradeId}`}
            className="text-xs text-text-muted hover:text-accent transition-colors"
          >
            View Trade
          </Link>
        )}
      </div>
    </div>
  );
}

function ClosedPositionRow({ position }: { position: Position }) {
  const pnl = position.closePnl ?? 0;
  const pnlColor = pnl >= 0 ? "text-win" : "text-loss";
  const sign = pnl >= 0 ? "+" : "";

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-text-primary font-bold">{position.asset}</span>
        <span className={position.direction === "long" || position.direction === "yes" ? "text-win" : "text-loss"}>
          {position.direction.toUpperCase()}
        </span>
        <span className="text-text-muted text-xs">{position.venue}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-text-muted text-xs">
          ${position.size.toLocaleString()}
        </span>
        <span className={`font-mono font-bold ${pnlColor}`}>
          {sign}${pnl.toFixed(2)}
        </span>
        <span className="text-text-muted text-xs">
          {position.closedAt ? timeAgo(position.closedAt) : ""}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PositionsPage() {
  const wallet = useWallet();
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "closed">("open");

  const fetchPositions = useCallback(async () => {
    if (!wallet.connected || !wallet.address) return;

    setLoading(true);
    try {
      const [openRes, closedRes] = await Promise.all([
        fetch(`/api/positions?wallet=${wallet.address}`),
        fetch(`/api/positions/history?wallet=${wallet.address}`),
      ]);

      if (openRes.ok) {
        const data = await openRes.json();
        setOpenPositions(data.positions ?? []);
      }
      if (closedRes.ok) {
        const data = await closedRes.json();
        setClosedPositions(data.positions ?? []);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, wallet.address]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!wallet.connected) return;
    const interval = setInterval(fetchPositions, 30_000);
    return () => clearInterval(interval);
  }, [wallet.connected, fetchPositions]);

  async function handleClose(positionId: string) {
    setClosingId(positionId);
    try {
      const res = await fetch(`/api/positions/${positionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet.address }),
      });

      if (res.ok) {
        await fetchPositions();
      }
    } catch {
      // silent fail
    } finally {
      setClosingId(null);
    }
  }

  // ── Not connected ────────────────────────────────────────────────────
  if (!wallet.connected) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Your Positions</h1>
        <div className="bg-surface border border-border rounded-lg p-8 text-center space-y-4">
          <p className="text-text-secondary">
            Connect your wallet to view positions
          </p>
          <WalletButton />
        </div>
      </main>
    );
  }

  const totalUnrealizedPnl = openPositions.reduce(
    (sum, p) => sum + p.unrealizedPnl,
    0
  );
  const totalRealizedPnl = closedPositions.reduce(
    (sum, p) => sum + (p.closePnl ?? 0),
    0
  );

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Your Positions</h1>
        <button
          onClick={fetchPositions}
          disabled={loading}
          className="text-xs text-text-muted hover:text-accent transition-colors"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
            Open Positions
          </div>
          <div className="text-xl font-bold text-text-primary">
            {openPositions.length}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
            Unrealized PnL
          </div>
          <div className={`text-xl font-bold font-mono ${totalUnrealizedPnl >= 0 ? "text-win" : "text-loss"}`}>
            {totalUnrealizedPnl >= 0 ? "+" : ""}${totalUnrealizedPnl.toFixed(2)}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
            Realized PnL
          </div>
          <div className={`text-xl font-bold font-mono ${totalRealizedPnl >= 0 ? "text-win" : "text-loss"}`}>
            {totalRealizedPnl >= 0 ? "+" : ""}${totalRealizedPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border">
        <button
          onClick={() => setTab("open")}
          className={`pb-2 text-sm font-bold transition-colors ${
            tab === "open"
              ? "text-accent border-b-2 border-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Open ({openPositions.length})
        </button>
        <button
          onClick={() => setTab("closed")}
          className={`pb-2 text-sm font-bold transition-colors ${
            tab === "closed"
              ? "text-accent border-b-2 border-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Closed ({closedPositions.length})
        </button>
      </div>

      {/* Open positions */}
      {tab === "open" && (
        <div className="space-y-4">
          {openPositions.length === 0 && !loading && (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <p className="text-text-muted text-sm">No open positions</p>
              <p className="text-text-muted text-xs mt-2">
                Execute a trade from any trade card to get started
              </p>
            </div>
          )}
          {openPositions.map((pos) => (
            <PositionCard
              key={pos.id}
              position={pos}
              onClose={handleClose}
              closing={closingId === pos.id}
            />
          ))}
        </div>
      )}

      {/* Closed positions */}
      {tab === "closed" && (
        <div>
          {closedPositions.length === 0 && (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <p className="text-text-muted text-sm">No closed positions yet</p>
            </div>
          )}
          {closedPositions.map((pos) => (
            <ClosedPositionRow key={pos.id} position={pos} />
          ))}
        </div>
      )}
    </main>
  );
}
