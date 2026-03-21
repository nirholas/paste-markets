"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { generateRecapSummary, type RecapData } from "@/lib/recap-summary";

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export function RecapClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const dateParam = searchParams.get("date") ?? today;

  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecap = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recap?date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError("Failed to load recap data.");
      console.error("[today] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecap(dateParam);
  }, [dateParam, fetchRecap]);

  const navigateDate = (days: number) => {
    const newDate = shiftDate(dateParam, days);
    // Don't go into the future
    if (newDate > today) return;
    router.push(`/today?date=${newDate}`);
  };

  const handleDatePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val && val <= today) {
      router.push(`/today?date=${val}`);
    }
  };

  const summary = data ? generateRecapSummary(data) : "";

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {/* Date Navigation */}
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => navigateDate(-1)}
          className="text-text-muted hover:text-accent transition text-xl px-2"
          aria-label="Previous day"
        >
          &larr;
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight font-mono">
          {formatDateHeader(dateParam)}
        </h1>
        <button
          onClick={() => navigateDate(1)}
          disabled={isToday(dateParam)}
          className="text-text-muted hover:text-accent transition text-xl px-2 disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Next day"
        >
          &rarr;
        </button>
        <input
          type="date"
          value={dateParam}
          max={today}
          onChange={handleDatePicker}
          className="ml-auto bg-[#0f0f22] border border-[#1a1a2e] text-text-secondary text-sm px-3 py-1.5 rounded cursor-pointer hover:border-accent transition font-mono"
        />
      </div>

      <p className="text-text-muted text-xs uppercase tracking-widest mb-8">
        Daily Recap
      </p>

      {loading && (
        <div className="text-text-muted text-sm py-16 text-center">
          Loading recap...
        </div>
      )}

      {error && (
        <div className="text-loss text-sm py-16 text-center">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {/* Market Brief */}
          {summary && (
            <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg px-6 py-4 mb-8">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-2">
                Market Brief
              </p>
              <p className="text-text-secondary text-sm leading-relaxed">
                {summary}
              </p>
            </div>
          )}

          {/* Hero Stat */}
          <div className="mb-10 text-center">
            <p className="text-6xl md:text-7xl font-bold text-text-primary font-mono">
              {data.total_trades}
            </p>
            <p className="text-text-muted text-sm uppercase tracking-widest mt-1">
              calls today
            </p>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {/* Most Called Ticker */}
            <StatCard title="Most Called Ticker">
              {data.most_called_ticker ? (
                <div>
                  <Link
                    href={`/ticker/${data.most_called_ticker.ticker}`}
                    className="text-2xl font-bold text-accent hover:text-text-primary transition"
                  >
                    ${data.most_called_ticker.ticker}
                  </Link>
                  <p className="text-text-muted text-sm mt-1">
                    {data.most_called_ticker.count} call
                    {data.most_called_ticker.count === 1 ? "" : "s"}
                  </p>
                  {/* Mini bar */}
                  {data.total_trades > 0 && (
                    <div className="mt-3 w-full bg-[#1a1a2e] rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-accent h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((data.most_called_ticker.count / data.total_trades) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState />
              )}
            </StatCard>

            {/* Biggest Win */}
            <StatCard title="Biggest Win">
              {data.biggest_win && data.biggest_win.pnl > 0 ? (
                <div>
                  <p className="text-2xl font-bold text-[#2ecc71]">
                    {formatPnl(data.biggest_win.pnl)}
                  </p>
                  <p className="text-text-secondary text-sm mt-1">
                    <Link
                      href={`/${data.biggest_win.handle}`}
                      className="hover:text-accent transition"
                    >
                      @{data.biggest_win.handle}
                    </Link>
                    {" on "}
                    <span className="text-text-primary">
                      ${data.biggest_win.ticker}
                    </span>
                  </p>
                </div>
              ) : (
                <EmptyState />
              )}
            </StatCard>

            {/* Biggest Loss */}
            <StatCard title="Biggest Loss">
              {data.biggest_loss && data.biggest_loss.pnl < 0 ? (
                <div>
                  <p className="text-2xl font-bold text-[#e74c3c]">
                    {formatPnl(data.biggest_loss.pnl)}
                  </p>
                  <p className="text-text-secondary text-sm mt-1">
                    <Link
                      href={`/${data.biggest_loss.handle}`}
                      className="hover:text-accent transition"
                    >
                      @{data.biggest_loss.handle}
                    </Link>
                    {" on "}
                    <span className="text-text-primary">
                      ${data.biggest_loss.ticker}
                    </span>
                  </p>
                </div>
              ) : (
                <EmptyState />
              )}
            </StatCard>

            {/* Hot Streak */}
            <StatCard title="Hot Streak">
              {data.hot_streak ? (
                <div>
                  <p className="text-2xl font-bold text-[#f39c12]">
                    {data.hot_streak.streak} wins
                  </p>
                  <p className="text-text-secondary text-sm mt-1">
                    <Link
                      href={`/${data.hot_streak.handle}`}
                      className="hover:text-accent transition"
                    >
                      @{data.hot_streak.handle}
                    </Link>
                  </p>
                </div>
              ) : (
                <EmptyState />
              )}
            </StatCard>

            {/* New Callers */}
            <StatCard title="New Callers">
              {data.new_callers.length > 0 ? (
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {data.new_callers.length}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.new_callers.slice(0, 5).map((handle) => (
                      <Link
                        key={handle}
                        href={`/${handle.replace("@", "")}`}
                        className="text-xs text-text-muted bg-[#1a1a2e] px-2 py-1 rounded hover:text-accent transition"
                      >
                        {handle}
                      </Link>
                    ))}
                    {data.new_callers.length > 5 && (
                      <span className="text-xs text-text-muted px-2 py-1">
                        +{data.new_callers.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState label="No new callers" />
              )}
            </StatCard>

            {/* Venue Breakdown */}
            <StatCard title="Venue Breakdown">
              {Object.keys(data.venue_breakdown).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(data.venue_breakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([venue, count]) => (
                      <div key={venue} className="flex items-center gap-3">
                        <span className="text-text-muted text-xs uppercase w-24 truncate">
                          {venue}
                        </span>
                        <div className="flex-1 bg-[#1a1a2e] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-accent h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.round((count / data.total_trades) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-text-secondary text-xs font-mono w-8 text-right">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </StatCard>
          </div>

          {/* Consensus Play */}
          {data.consensus_play && (
            <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg px-6 py-4 mb-8">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-2">
                Consensus Play
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href={`/ticker/${data.consensus_play.ticker}`}
                  className="text-xl font-bold text-accent hover:text-text-primary transition"
                >
                  ${data.consensus_play.ticker}
                </Link>
                <span
                  className={`text-sm font-bold uppercase ${
                    data.consensus_play.direction === "long"
                      ? "text-[#2ecc71]"
                      : "text-[#e74c3c]"
                  }`}
                >
                  {data.consensus_play.direction}
                </span>
                <span className="text-text-muted text-sm">
                  {data.consensus_play.agreement}% agreement
                </span>
              </div>
            </div>
          )}

          {/* Yesterday link */}
          <div className="border-t border-[#1a1a2e] pt-6 flex items-center justify-between">
            <Link
              href={`/today?date=${shiftDate(dateParam, -1)}`}
              className="text-text-muted hover:text-accent transition text-sm"
            >
              &larr; Yesterday&apos;s recap
            </Link>
            {!isToday(dateParam) && (
              <Link
                href="/today"
                className="text-accent hover:text-text-primary transition text-sm"
              >
                Back to today
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6">
      <p className="text-text-muted text-xs uppercase tracking-widest mb-3">
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyState({ label = "No data" }: { label?: string }) {
  return <p className="text-text-muted text-sm">{label}</p>;
}
