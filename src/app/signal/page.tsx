import type { Metadata } from "next";
import Link from "next/link";
import type { ConsensusPlay } from "@/app/api/consensus/route";
import type { FeedTrade } from "@/app/api/feed/route";
import { PnlDisplay } from "@/components/ui/pnl-display";

// ---------- Metadata ----------

export const metadata: Metadata = {
  title: "The Signal — paste.markets",
  description:
    "Real-time intelligence from the top CT callers. Consensus plays, fresh calls, hot tickers.",
  openGraph: {
    title: "The Signal — paste.markets",
    description:
      "Real-time intelligence from the top CT callers. Consensus plays, fresh calls, hot tickers.",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Signal — paste.markets",
  },
};

// ---------- Types ----------

interface HeatmapTicker {
  ticker: string;
  calls: number;
  longs: number;
  shorts: number;
  avgPnl: number | null;
  sentiment: "strong-bullish" | "lean-bullish" | "neutral" | "lean-bearish" | "strong-bearish";
  topCaller: string;
}

interface LeaderboardEntry {
  rank: number;
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
}

// ---------- Helpers ----------

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return `${diffDays}d ago`;
}

function formatUpdatedAt(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---------- Sentiment styles ----------

function computeSentiment(directionSplit: number): HeatmapTicker["sentiment"] {
  if (directionSplit >= 75) return "strong-bullish";
  if (directionSplit >= 60) return "lean-bullish";
  if (directionSplit >= 40) return "neutral";
  if (directionSplit >= 25) return "lean-bearish";
  return "strong-bearish";
}

const SENTIMENT_STYLES: Record<
  HeatmapTicker["sentiment"],
  { label: string; color: string }
> = {
  "strong-bullish": { label: "STRONG BULL", color: "#2ecc71" },
  "lean-bullish": { label: "LEAN BULL", color: "#27ae60" },
  neutral: { label: "NEUTRAL", color: "#f39c12" },
  "lean-bearish": { label: "LEAN BEAR", color: "#c0392b" },
  "strong-bearish": { label: "STRONG BEAR", color: "#e74c3c" },
};

// ---------- Data fetching ----------

const BASE_URL = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
const FETCH_OPTS = { next: { revalidate: 120 } } as const;

async function fetchConsensus(): Promise<ConsensusPlay[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/consensus`, FETCH_OPTS);
    if (!res.ok) return [];
    const data = (await res.json()) as { plays?: ConsensusPlay[] };
    return data.plays ?? [];
  } catch {
    return [];
  }
}

async function fetchFeed(): Promise<FeedTrade[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/feed`, FETCH_OPTS);
    if (!res.ok) return [];
    const data = (await res.json()) as { trades?: FeedTrade[] };
    return data.trades ?? [];
  } catch {
    return [];
  }
}

async function fetchHeatmap(): Promise<HeatmapTicker[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/heatmap?timeframe=7d`, FETCH_OPTS);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      tickers?: Array<{
        ticker: string;
        call_count: number;
        avg_pnl: number | null;
        direction_split: number;
        longs: number;
        shorts: number;
        topCaller: string;
      }>;
    };
    return (data.tickers ?? []).map((t) => ({
      ticker: t.ticker,
      calls: t.call_count,
      longs: t.longs,
      shorts: t.shorts,
      avgPnl: t.avg_pnl,
      sentiment: computeSentiment(t.direction_split),
      topCaller: t.topCaller,
    }));
  } catch {
    return [];
  }
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/leaderboard?limit=5&window=7d`,
      FETCH_OPTS,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { entries?: LeaderboardEntry[] };
    return data.entries ?? [];
  } catch {
    return [];
  }
}

// ---------- Sub-components ----------

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "2px",
          color: "#555568",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "#1a1a2e",
        }}
      />
    </div>
  );
}

function DirectionBadge({
  direction,
}: {
  direction: "long" | "short" | "yes" | "no";
}) {
  const isLong = direction === "long" || direction === "yes";
  return (
    <span
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "1px",
        color: isLong ? "#2ecc71" : "#e74c3c",
        border: `1px solid ${isLong ? "#2ecc71" : "#e74c3c"}`,
        padding: "1px 6px",
        borderRadius: "3px",
      }}
    >
      {isLong ? "LONG" : "SHORT"}
    </span>
  );
}

// ---------- Page ----------

export default async function SignalPage() {
  const [consensusPlays, feedTrades, heatmapTickers, leaderboardEntries] =
    await Promise.all([
      fetchConsensus(),
      fetchFeed(),
      fetchHeatmap(),
      fetchLeaderboard(),
    ]);

  // Section 2: filter to last 24h
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const recentTrades = feedTrades
    .filter((t) => new Date(t.created_at).getTime() >= cutoff24h)
    .slice(0, 10);

  // Section 3: top 6 tickers by call count
  const hotTickers = heatmapTickers.slice(0, 6);

  // Section 1: top 5 consensus plays — derive display fields from ConsensusPlay
  const topPlays = consensusPlays.slice(0, 5).map((play) => {
    const callerCount = play.long_count + play.short_count;
    const avgWinRate =
      play.callers.length > 0
        ? play.callers.reduce((s, c) => s + c.winRate, 0) / play.callers.length
        : 0;
    const isLong =
      play.consensus === "strong_long" || play.long_count > play.short_count;
    const direction: "long" | "short" = isLong ? "long" : "short";
    const currentPnl = isLong ? play.avg_pnl_long : play.avg_pnl_short;
    return { ...play, callerCount, avgWinRate, direction, currentPnl };
  });

  const updatedTime = formatUpdatedAt();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a1a",
        color: "#f0f0f0",
        fontFamily: "JetBrains Mono, monospace",
        padding: "32px 24px",
        maxWidth: "960px",
        margin: "0 auto",
      }}
    >
      {/* ── Page Header ── */}
      <header style={{ marginBottom: "48px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#f0f0f0",
            margin: 0,
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          THE SIGNAL
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#c8c8d0",
            margin: "8px 0 0",
          }}
        >
          Real-time intelligence from the top CT callers.
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "#555568",
            margin: "6px 0 0",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          Updated {updatedTime} &mdash; refreshes every 2 min
        </p>
      </header>

      {/* ── Section 1: Consensus Plays ── */}
      <section style={{ marginBottom: "48px" }}>
        <SectionHeader label="Consensus Plays" />

        {topPlays.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#555568" }}>
            No consensus plays available.
          </p>
        ) : (
          <div
            style={{
              background: "#0f0f22",
              border: "1px solid #1a1a2e",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {topPlays.map((play, i) => (
              <div
                key={`${play.ticker}-${play.direction}`}
                style={{
                  padding: "16px 20px",
                  borderBottom:
                    i < topPlays.length - 1 ? "1px solid #1a1a2e" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                {/* Ticker */}
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#f0f0f0",
                    minWidth: "80px",
                  }}
                >
                  ${play.ticker}
                </span>

                {/* Direction badge */}
                <DirectionBadge direction={play.direction} />

                {/* Stats */}
                <span style={{ fontSize: "13px", color: "#c8c8d0" }}>
                  <span style={{ color: "#f39c12", fontWeight: 700 }}>
                    {play.callerCount}
                  </span>{" "}
                  callers
                </span>

                <span style={{ fontSize: "13px", color: "#c8c8d0" }}>
                  avg WR:{" "}
                  <span style={{ color: "#f0f0f0" }}>
                    {play.avgWinRate.toFixed(0)}%
                  </span>
                </span>

                {play.currentPnl != null && (
                  <span style={{ fontSize: "13px" }}>
                    P&L:{" "}
                    <PnlDisplay value={play.currentPnl} />
                  </span>
                )}

                {/* Subtext */}
                <span
                  style={{
                    fontSize: "11px",
                    color: "#555568",
                    marginLeft: "auto",
                    letterSpacing: "0.5px",
                  }}
                >
                  {play.callerCount} elite caller
                  {play.callerCount !== 1 ? "s" : ""} agree on this trade
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "12px" }}>
          <Link
            href="/consensus"
            style={{
              fontSize: "12px",
              color: "#3b82f6",
              textDecoration: "none",
              letterSpacing: "0.5px",
            }}
          >
            View full consensus list &rarr;
          </Link>
        </div>
      </section>

      {/* ── Section 2: Fresh Calls ── */}
      <section style={{ marginBottom: "48px" }}>
        <SectionHeader label="Fresh Calls (last 24h)" />

        {recentTrades.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#555568" }}>
            No fresh calls in the last 24h.
          </p>
        ) : (
          <div
            style={{
              background: "#0f0f22",
              border: "1px solid #1a1a2e",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {recentTrades.map((trade, i) => (
              <div
                key={`${trade.author_handle}-${trade.ticker}-${trade.created_at}`}
                style={{
                  padding: "12px 20px",
                  borderBottom:
                    i < recentTrades.length - 1 ? "1px solid #1a1a2e" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                {/* Handle */}
                <Link
                  href={`/${trade.author_handle}`}
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#3b82f6",
                    textDecoration: "none",
                    minWidth: "120px",
                  }}
                >
                  @{trade.author_handle}
                </Link>

                {/* Ticker */}
                <span
                  style={{ fontSize: "13px", fontWeight: 700, color: "#f0f0f0" }}
                >
                  ${trade.ticker}
                </span>

                {/* Direction */}
                <DirectionBadge direction={trade.direction as "long" | "short" | "yes" | "no"} />

                {/* P&L */}
                {trade.pnl_pct != null ? (
                  <span style={{ fontSize: "13px" }}>
                    <PnlDisplay value={trade.pnl_pct} />
                  </span>
                ) : (
                  <span style={{ fontSize: "13px", color: "#555568" }}>—</span>
                )}

                {/* Time */}
                <span
                  style={{
                    fontSize: "11px",
                    color: "#555568",
                    marginLeft: "auto",
                    letterSpacing: "0.5px",
                  }}
                >
                  {formatTimeAgo(trade.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: Hot Tickers ── */}
      <section style={{ marginBottom: "48px" }}>
        <SectionHeader label="Hot Tickers (7d)" />

        {hotTickers.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#555568" }}>
            No ticker data available.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "12px",
            }}
          >
            {hotTickers.map((ticker) => {
              const sentiment = SENTIMENT_STYLES[ticker.sentiment];
              return (
                <Link
                  key={ticker.ticker}
                  href={`/t/${ticker.ticker.toLowerCase()}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      background: "#0f0f22",
                      border: "1px solid #1a1a2e",
                      borderRadius: "8px",
                      padding: "16px",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={undefined}
                  >
                    {/* Ticker name + sentiment badge */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "#f0f0f0",
                        }}
                      >
                        ${ticker.ticker}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          letterSpacing: "1px",
                          color: sentiment.color,
                          border: `1px solid ${sentiment.color}`,
                          padding: "2px 6px",
                          borderRadius: "3px",
                        }}
                      >
                        {sentiment.label}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        fontSize: "12px",
                        color: "#c8c8d0",
                      }}
                    >
                      <span>
                        <span style={{ color: "#555568" }}>calls </span>
                        <span style={{ color: "#f0f0f0", fontWeight: 700 }}>
                          {ticker.calls}
                        </span>
                      </span>
                      {ticker.avgPnl != null && (
                        <span>
                          <span style={{ color: "#555568" }}>avg P&L </span>
                          <PnlDisplay value={ticker.avgPnl} />
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 4: Leaderboard Leaders ── */}
      <section style={{ marginBottom: "48px" }}>
        <SectionHeader label="Leaderboard Leaders (this week)" />

        {leaderboardEntries.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#555568" }}>
            No leaderboard data available.
          </p>
        ) : (
          <div
            style={{
              background: "#0f0f22",
              border: "1px solid #1a1a2e",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                padding: "10px 20px",
                borderBottom: "1px solid #1a1a2e",
                display: "grid",
                gridTemplateColumns: "40px 1fr 100px 100px 80px",
                gap: "8px",
                fontSize: "11px",
                color: "#555568",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              <span>#</span>
              <span>Handle</span>
              <span>Win Rate</span>
              <span>Avg P&L</span>
              <span>Trades</span>
            </div>

            {leaderboardEntries.map((entry, i) => (
              <div
                key={entry.handle}
                style={{
                  padding: "12px 20px",
                  borderBottom:
                    i < leaderboardEntries.length - 1
                      ? "1px solid #1a1a2e"
                      : "none",
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 100px 100px 80px",
                  gap: "8px",
                  alignItems: "center",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "#555568", fontWeight: 700 }}>
                  {entry.rank}
                </span>
                <Link
                  href={`/${entry.handle}`}
                  style={{
                    color: "#3b82f6",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  @{entry.handle}
                </Link>
                <span style={{ color: "#f0f0f0" }}>
                  {(entry.winRate ?? 0).toFixed(0)}%
                </span>
                <span>
                  <PnlDisplay value={entry.avgPnl} />
                </span>
                <span style={{ color: "#c8c8d0" }}>{entry.totalTrades}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid #1a1a2e",
          paddingTop: "24px",
          fontSize: "11px",
          color: "#555568",
          letterSpacing: "0.5px",
        }}
      >
        Signal updates every 2 minutes. Data from paste.trade.
      </footer>
    </main>
  );
}
