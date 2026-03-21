"use client";

import Link from "next/link";

interface DiscoverCaller {
  handle: string;
  win_rate: number;
  avg_pnl: number;
  total_pnl: number;
  trades: number;
  best_ticker: string | null;
  alpha_score: number;
  tier: string;
  avatar_url: string | null;
  platform: string | null;
}

interface HotTake {
  handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number;
  posted_at: string;
}

interface DiscoverData {
  trending_callers: DiscoverCaller[];
  trending_tickers: Array<{ ticker: string; count: number }>;
  rising_stars: DiscoverCaller[];
  hot_takes: HotTake[];
  new_callers: DiscoverCaller[];
}

function tierColor(tier: string): string {
  switch (tier) {
    case "S": return "text-amber";
    case "A": return "text-win";
    case "B": return "text-accent";
    default: return "text-text-muted";
  }
}

function tierBg(tier: string): string {
  switch (tier) {
    case "S": return "border-amber/30";
    case "A": return "border-win/30";
    case "B": return "border-accent/30";
    default: return "border-border";
  }
}

function WinRateBar({ pct }: { pct: number }) {
  const filled = Math.round((pct / 100) * 10);
  const empty = 10 - filled;
  return (
    <span className="font-mono text-xs">
      <span className="text-win">{"\u2588".repeat(filled)}</span>
      <span className="text-text-muted">{"\u2591".repeat(empty)}</span>
    </span>
  );
}

function CallerCard({ caller }: { caller: DiscoverCaller }) {
  return (
    <Link
      href={`/${encodeURIComponent(caller.handle)}`}
      className={`bg-surface border ${tierBg(caller.tier)} rounded-lg p-4 hover:border-accent transition min-w-[220px] sm:min-w-0 flex-shrink-0 block`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-text-muted">@</span>
        <span className="text-text-primary font-mono text-sm font-bold truncate">
          {caller.handle}
        </span>
        <span className={`text-xs font-bold ml-auto ${tierColor(caller.tier)}`}>
          {caller.tier}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-xs">Win Rate</span>
          <span className={`text-sm font-mono ${caller.win_rate >= 50 ? "text-win" : "text-loss"}`}>
            {caller.win_rate.toFixed(0)}%
          </span>
        </div>
        <WinRateBar pct={caller.win_rate} />

        <div className="flex items-center justify-between">
          <span className="text-text-muted text-xs">Avg P&L</span>
          <span className={`text-sm font-mono ${caller.avg_pnl >= 0 ? "text-win" : "text-loss"}`}>
            {caller.avg_pnl > 0 ? "+" : ""}{caller.avg_pnl.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-muted text-xs">Trades</span>
          <span className="text-text-secondary text-sm font-mono">
            {caller.trades}
          </span>
        </div>

        {caller.best_ticker && (
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs">Top</span>
            <span className="text-accent text-sm font-mono">
              ${caller.best_ticker}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function TickerCard({ ticker, count }: { ticker: string; count: number }) {
  return (
    <Link
      href={`/ticker/${encodeURIComponent(ticker)}`}
      className="bg-surface border border-border rounded-lg p-4 hover:border-accent transition min-w-[150px] sm:min-w-0 flex-shrink-0 block text-center"
    >
      <div className="text-text-primary font-mono text-lg font-bold mb-1">
        ${ticker}
      </div>
      <div className="text-text-muted text-xs">
        {count} call{count !== 1 ? "s" : ""} this week
      </div>
    </Link>
  );
}

function HotTakeCard({ take }: { take: HotTake }) {
  const isWin = take.pnl_pct >= 0;
  return (
    <Link
      href={`/${encodeURIComponent(take.handle)}`}
      className="bg-surface border border-border rounded-lg p-4 hover:border-accent transition min-w-[240px] sm:min-w-0 flex-shrink-0 block"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted text-xs">@{take.handle}</span>
        <span className={`text-lg font-mono font-bold ${isWin ? "text-win" : "text-loss"}`}>
          {isWin ? "+" : ""}{take.pnl_pct.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs uppercase px-1.5 py-0.5 rounded ${
          take.direction === "long" || take.direction === "yes"
            ? "bg-win/10 text-win"
            : "bg-loss/10 text-loss"
        }`}>
          {take.direction}
        </span>
        <span className="text-text-primary font-mono text-sm font-bold">
          ${take.ticker}
        </span>
      </div>
    </Link>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-text-primary font-mono">
          {title}
        </h2>
        <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default function DiscoverClient({ data }: { data: DiscoverData }) {
  return (
    <div>
      {/* Trending Callers */}
      <Section
        title="Trending Callers"
        subtitle="Most active this week by trade count"
      >
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:overflow-visible">
          {data.trending_callers.map((c) => (
            <CallerCard key={c.handle} caller={c} />
          ))}
          {data.trending_callers.length === 0 && (
            <p className="text-text-muted text-sm col-span-full">No data available</p>
          )}
        </div>
      </Section>

      {/* Trending Tickers */}
      <Section
        title="Trending Tickers"
        subtitle="Most called tickers this week"
      >
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:overflow-visible">
          {data.trending_tickers.map((t) => (
            <TickerCard key={t.ticker} ticker={t.ticker} count={t.count} />
          ))}
          {data.trending_tickers.length === 0 && (
            <p className="text-text-muted text-sm col-span-full">No data available</p>
          )}
        </div>
      </Section>

      {/* Rising Stars */}
      <Section
        title="Rising Stars"
        subtitle="Best recent alpha score (min 5 trades)"
      >
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:overflow-visible">
          {data.rising_stars.map((c) => (
            <CallerCard key={c.handle} caller={c} />
          ))}
          {data.rising_stars.length === 0 && (
            <p className="text-text-muted text-sm col-span-full">No data available</p>
          )}
        </div>
      </Section>

      {/* Hot Takes */}
      <Section
        title="Hot Takes"
        subtitle="Most extreme P&L swings - the big wins and big losses"
      >
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:overflow-visible">
          {data.hot_takes.map((t, i) => (
            <HotTakeCard key={`${t.handle}-${t.ticker}-${i}`} take={t} />
          ))}
          {data.hot_takes.length === 0 && (
            <p className="text-text-muted text-sm col-span-full">No data available</p>
          )}
        </div>
      </Section>

      {/* New to paste.markets */}
      <Section
        title="New to paste.markets"
        subtitle="Recently added callers building their track record"
      >
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:overflow-visible">
          {data.new_callers.map((c) => (
            <CallerCard key={c.handle} caller={c} />
          ))}
          {data.new_callers.length === 0 && (
            <p className="text-text-muted text-sm col-span-full">No data available</p>
          )}
        </div>
      </Section>
    </div>
  );
}
