"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BackerStrip } from "@/components/backer-strip";

type Tab = "active" | "settled" | "my";

interface WagerConfig {
  trade_card_id: string;
  author_handle: string;
  ticker: string;
  direction: string;
  entry_price: number | null;
  wager_deadline: string;
  settlement_date: string;
  caller_tip_bps: number;
  total_wagered: number;
  wager_count: number;
  status: "active" | "settled" | "cancelled";
  settled_at: string | null;
  caller_tip_earned: number | null;
  created_at: string;
  // Extended fields from API
  current_pnl?: number | null;
}

interface WagerEvent {
  id: string;
  type: string;
  trade_id: string;
  caller_handle: string;
  backer_handle: string | null;
  amount: number | null;
  pnl_percent: number | null;
  tip_amount: number | null;
  created_at: string;
}

interface WagersData {
  active: WagerConfig[];
  settled: WagerConfig[];
  events: WagerEvent[];
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Active wager card ─────────────────────────────────────────────────────

function ActiveWagerCard({ config }: { config: WagerConfig }) {
  const isLong = config.direction === "long" || config.direction === "yes";
  const dirColor = isLong ? "text-[#2ecc71]" : "text-[#e74c3c]";
  const tipPct = config.caller_tip_bps / 100;

  return (
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-5 space-y-3 hover:border-[#3b82f6]/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/${config.author_handle}`}
            className="text-[#c8c8d0] hover:text-[#3b82f6] transition-colors text-sm font-mono"
          >
            @{config.author_handle}
          </Link>
          <span className="text-[#555568]">·</span>
          <span className="text-[#f0f0f0] font-bold text-sm">${config.ticker.toUpperCase()}</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
            isLong ? "text-[#2ecc71] border-[#2ecc71]/50" : "text-[#e74c3c] border-[#e74c3c]/50"
          }`}>
            {config.direction}
          </span>
        </div>
      </div>

      {/* Current PnL if available */}
      {config.current_pnl != null && (
        <p className={`text-sm font-bold font-mono ${config.current_pnl >= 0 ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
          Currently: {config.current_pnl >= 0 ? "+" : ""}{config.current_pnl.toFixed(1)}%
        </p>
      )}

      {/* Stats */}
      <div className="space-y-1 text-xs font-mono text-[#c8c8d0]">
        <p>
          <span className="text-[#f0f0f0] font-bold">{formatUSDC(config.total_wagered)}</span>
          <span className="text-[#555568]"> USDC wagered by </span>
          <span className="text-[#f0f0f0] font-bold">{config.wager_count}</span>
          <span className="text-[#555568]"> backers</span>
        </p>
        <p className="text-[#555568]">
          Wager window {timeLeft(config.wager_deadline) === "closed" ? "closed" : `closes ${timeLeft(config.wager_deadline)}`}
        </p>
        <p className="text-[#555568]">
          Settles: {formatDate(config.settlement_date)}
        </p>
      </div>

      {/* Backer strip */}
      {config.wager_count > 0 && (
        <BackerStrip
          tradeId={config.trade_card_id}
          totalWagered={config.total_wagered}
          backerCount={config.wager_count}
        />
      )}

    </div>
  );
}

// ─── Settled wager card ─────────────────────────────────────────────────────

function SettledWagerCard({ config }: { config: WagerConfig }) {
  const isLong = config.direction === "long" || config.direction === "yes";
  const tipPct = config.caller_tip_bps / 100;

  return (
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/${config.author_handle}`}
            className="text-[#c8c8d0] hover:text-[#3b82f6] transition-colors text-sm font-mono"
          >
            @{config.author_handle}
          </Link>
          <span className="text-[#555568]">·</span>
          <span className="text-[#f0f0f0] font-bold text-sm">${config.ticker.toUpperCase()}</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
            isLong ? "text-[#2ecc71] border-[#2ecc71]/50" : "text-[#e74c3c] border-[#e74c3c]/50"
          }`}>
            {config.direction}
          </span>
          <span className="text-[10px] uppercase tracking-widest border border-[#2ecc71]/50 text-[#2ecc71] px-2 py-0.5 rounded font-mono">
            SETTLED
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-1 text-xs font-mono">
        <p>
          <span className="text-[#f0f0f0] font-bold">{formatUSDC(config.total_wagered)}</span>
          <span className="text-[#555568]"> USDC wagered by </span>
          <span className="text-[#f0f0f0] font-bold">{config.wager_count}</span>
          <span className="text-[#555568]"> backers</span>
        </p>
        {config.caller_tip_earned != null && config.caller_tip_earned > 0 && (
          <p className="text-[#2ecc71]">
            Caller earned: ${formatUSDC(config.caller_tip_earned)} in tips
          </p>
        )}
      </div>

      {/* Backer strip */}
      {config.wager_count > 0 && (
        <BackerStrip
          tradeId={config.trade_card_id}
          totalWagered={config.total_wagered}
          backerCount={config.wager_count}
        />
      )}

      {/* View results link */}
      <div className="pt-1">
        <Link
          href={`/trade/${config.trade_card_id}`}
          className="text-[11px] text-[#555568] hover:text-[#3b82f6] transition-colors font-mono"
        >
          View Full Results →
        </Link>
      </div>
    </div>
  );
}

// ─── Event feed item ────────────────────────────────────────────────────────

function EventItem({ event }: { event: WagerEvent }) {
  let message = "";
  if (event.type === "new_wager") {
    const backer = event.backer_handle ? `@${event.backer_handle}` : "Someone";
    message = `${backer} backed @${event.caller_handle}'s trade with ${event.amount ?? 0} USDC`;
  } else if (event.type === "settled") {
    message = `@${event.caller_handle}'s trade settled at ${event.pnl_percent != null ? `${event.pnl_percent > 0 ? "+" : ""}${event.pnl_percent.toFixed(1)}%` : "N/A"}`;
  } else if (event.type === "tip_earned") {
    message = `@${event.caller_handle} earned $${(event.tip_amount ?? 0).toFixed(2)} in tips`;
  }

  const typeColors: Record<string, string> = {
    new_wager: "text-[#3b82f6]",
    settled: "text-[#2ecc71]",
    tip_earned: "text-[#f39c12]",
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1a1a2e] last:border-0">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] uppercase tracking-widest font-bold ${typeColors[event.type] ?? "text-[#555568]"}`}>
          {event.type.replace("_", " ")}
        </span>
        <span className="text-xs text-[#c8c8d0] font-mono">{message}</span>
      </div>
      <span className="text-[10px] text-[#555568] font-mono shrink-0 ml-2">
        {timeAgo(event.created_at)}
      </span>
    </div>
  );
}

// ─── My Wagers (placeholder for wallet connection) ──────────────────────────

function MyWagersPanel() {
  const [wallet, setWallet] = useState("");
  const [wagers, setWagers] = useState<Array<{
    id: string;
    trade_card_id: string;
    amount: number;
    status: string;
    wagered_at: string;
    pnl_amount: number | null;
    author_handle: string;
    ticker: string;
    direction: string;
  }>>([]);
  const [loading, setLoading] = useState(false);

  async function loadMyWagers() {
    if (!wallet) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wagers?wallet=${encodeURIComponent(wallet)}`);
      if (res.ok) {
        const data = await res.json();
        setWagers(data.wagers ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (!wallet || wagers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-[#c8c8d0]">Enter your wallet address to see your wagers</p>
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value.trim())}
            placeholder="Solana wallet address"
            className="w-full max-w-md mx-auto border border-[#1a1a2e] bg-[#0a0a1a] text-[#f0f0f0] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#3b82f6] transition-colors placeholder:text-[#555568] font-mono"
          />
          <button
            onClick={loadMyWagers}
            disabled={!wallet || loading}
            className="border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-[#0a0a1a] text-sm px-6 py-2 rounded transition-colors font-mono disabled:opacity-40"
          >
            {loading ? "Loading..." : "View My Wagers"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#555568] font-mono">
        Showing wagers for {wallet.slice(0, 8)}...{wallet.slice(-4)}
      </p>
      {wagers.map((w) => {
        const isLong = w.direction === "long" || w.direction === "yes";
        return (
          <div key={w.id} className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#f0f0f0]">${w.ticker.toUpperCase()}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                  isLong ? "text-[#2ecc71] border-[#2ecc71]/50" : "text-[#e74c3c] border-[#e74c3c]/50"
                }`}>
                  {w.direction}
                </span>
                <span className="text-xs text-[#555568] font-mono">by @{w.author_handle}</span>
              </div>
              <span className={`text-xs font-mono font-bold ${
                w.status === "won" ? "text-[#2ecc71]" : w.status === "lost" ? "text-[#e74c3c]" : "text-[#f39c12]"
              }`}>
                {w.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-[#555568]">
              <span>Wagered: <span className="text-[#f0f0f0]">{w.amount} USDC</span></span>
              {w.pnl_amount != null && (
                <span className={w.pnl_amount >= 0 ? "text-[#2ecc71]" : "text-[#e74c3c]"}>
                  {w.pnl_amount >= 0 ? "+" : ""}{w.pnl_amount.toFixed(2)} USDC
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main client component ──────────────────────────────────────────────────

export function WagersClient() {
  const [tab, setTab] = useState<Tab>("active");
  const [data, setData] = useState<WagersData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/wagers");
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "settled", label: "Settled" },
    { key: "my", label: "My Wagers" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#1a1a2e]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-mono transition-colors border-b-2 ${
              tab === t.key
                ? "border-[#3b82f6] text-[#f0f0f0]"
                : "border-transparent text-[#555568] hover:text-[#c8c8d0]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-sm text-[#555568] font-mono">Loading wagers...</p>
        </div>
      ) : (
        <>
          {/* Active tab */}
          {tab === "active" && (
            <div className="space-y-4">
              {(!data?.active || data.active.length === 0) ? (
                <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-8 text-center">
                  <p className="text-sm text-[#555568]">No active wagers right now</p>
                  <p className="text-xs text-[#555568] mt-1">
                    Find a trade in the{" "}
                    <Link href="/feed" className="text-[#3b82f6] hover:underline">feed</Link>
                    {" "}and Double Down!
                  </p>
                </div>
              ) : (
                data.active.map((config) => (
                  <ActiveWagerCard key={config.trade_card_id} config={config} />
                ))
              )}
            </div>
          )}

          {/* Settled tab */}
          {tab === "settled" && (
            <div className="space-y-4">
              {(!data?.settled || data.settled.length === 0) ? (
                <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-8 text-center">
                  <p className="text-sm text-[#555568]">No settled wagers yet</p>
                </div>
              ) : (
                data.settled.map((config) => (
                  <SettledWagerCard key={config.trade_card_id} config={config} />
                ))
              )}
            </div>
          )}

          {/* My Wagers tab */}
          {tab === "my" && <MyWagersPanel />}

          {/* Event feed */}
          {tab !== "my" && data?.events && data.events.length > 0 && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-[#555568] mb-3">Recent Activity</p>
              <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
                {data.events.slice(0, 20).map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
