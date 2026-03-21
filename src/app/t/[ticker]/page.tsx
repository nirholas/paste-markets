import type { Metadata } from "next";
import Link from "next/link";
import type { TickerData } from "@/app/api/ticker/[ticker]/route";

interface PageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ t?: string }>;
}

const BASE_URL = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

async function fetchTickerData(
  ticker: string,
  timeframe: string,
): Promise<TickerData | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/ticker/${encodeURIComponent(ticker)}?timeframe=${timeframe}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as TickerData;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const { t: timeframe = "30d" } = await searchParams;

  const data = await fetchTickerData(ticker, timeframe);
  const totalCalls = data?.totalCalls ?? 0;

  const title = `$${ticker} on paste.markets — ${totalCalls} tracked calls`;
  const description = data
    ? `${totalCalls} CT callers tracked on $${ticker}. Sentiment: ${data.sentiment}. Top callers by real P&L performance.`
    : `$${ticker} — Ticker intelligence on paste.markets`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${BASE_URL}/api/og/ticker/${ticker}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/api/og/ticker/${ticker}`],
    },
  };
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    "strong-bullish":  { label: "STRONG BULLISH", color: "#2ecc71", bg: "rgba(46,204,113,0.12)" },
    "lean-bullish":    { label: "LEAN BULLISH",   color: "#2ecc71", bg: "rgba(46,204,113,0.08)" },
    "neutral":         { label: "NEUTRAL",         color: "#f39c12", bg: "rgba(243,156,18,0.10)" },
    "lean-bearish":    { label: "LEAN BEARISH",    color: "#e74c3c", bg: "rgba(231,76,60,0.08)"  },
    "strong-bearish":  { label: "STRONG BEARISH",  color: "#e74c3c", bg: "rgba(231,76,60,0.12)"  },
  };
  const { label, color, bg } = config[sentiment] ?? config["neutral"]!;

  return (
    <span
      style={{
        color,
        background: bg,
        border: `1px solid ${color}33`,
        borderRadius: "4px",
        padding: "3px 10px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "1px",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function PnlDisplay({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "#555568" }}>—</span>;
  const color = value >= 0 ? "#2ecc71" : "#e74c3c";
  const sign = value >= 0 ? "+" : "";
  return <span style={{ color }}>{sign}{value.toFixed(1)}%</span>;
}

function DirectionTag({ direction }: { direction: string }) {
  const isLong = direction === "long" || direction === "yes";
  return (
    <span
      style={{
        color: isLong ? "#2ecc71" : "#e74c3c",
        fontWeight: 700,
        textTransform: "uppercase",
        fontSize: "11px",
        letterSpacing: "0.5px",
      }}
    >
      {direction === "yes" ? "LONG (YES)" : direction === "no" ? "SHORT (NO)" : direction.toUpperCase()}
    </span>
  );
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function WinRateBar({ rate }: { rate: number }) {
  const filled = Math.round(rate / 10);
  const empty = 10 - filled;
  return (
    <span style={{ color: "#3b82f6", fontSize: "11px", letterSpacing: "1px" }}>
      {"█".repeat(filled)}{"░".repeat(empty)}{" "}
      <span style={{ color: "#c8c8d0" }}>{Math.round(rate)}%</span>
    </span>
  );
}

const TIMEFRAMES = [
  { value: "7d",  label: "7D"  },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "ALL" },
];

export default async function TickerPage({ params, searchParams }: PageProps) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const { t: timeframe = "30d" } = await searchParams;

  const data = await fetchTickerData(ticker, timeframe);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a1a",
        color: "#f0f0f0",
        fontFamily: "'JetBrains Mono', monospace",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>

        {/* Back link */}
        <div style={{ marginBottom: "24px" }}>
          <Link
            href="/leaderboard"
            style={{
              color: "#555568",
              fontSize: "12px",
              textDecoration: "none",
              letterSpacing: "0.5px",
            }}
          >
            ← LEADERBOARD
          </Link>
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "8px",
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#f0f0f0",
              margin: 0,
              letterSpacing: "1px",
            }}
          >
            ${ticker}
          </h1>
          {data && <SentimentBadge sentiment={data.sentiment} />}
        </div>

        <p style={{ color: "#555568", fontSize: "11px", letterSpacing: "1px", marginBottom: "24px" }}>
          TICKER INTELLIGENCE — paste.markets
        </p>

        {/* Timeframe tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap" }}>
          {TIMEFRAMES.map((tf) => {
            const isActive = tf.value === timeframe;
            return (
              <Link
                key={tf.value}
                href={`/t/${ticker.toLowerCase()}?t=${tf.value}`}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontFamily: "'JetBrains Mono', monospace",
                  border: `1px solid ${isActive ? "#3b82f6" : "#1a1a2e"}`,
                  borderRadius: "4px",
                  background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
                  color: isActive ? "#3b82f6" : "#555568",
                  textDecoration: "none",
                  letterSpacing: "0.5px",
                  fontWeight: isActive ? 700 : 400,
                  transition: "all 0.15s",
                }}
              >
                {tf.label}
              </Link>
            );
          })}
        </div>

        {!data || data.totalCalls === 0 ? (
          /* Empty state */
          <div
            style={{
              background: "#0f0f22",
              border: "1px solid #1a1a2e",
              borderRadius: "8px",
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#555568", fontSize: "14px" }}>
              No tracked calls found for ${ticker} in this timeframe.
            </p>
            <p style={{ color: "#333348", fontSize: "12px", marginTop: "8px" }}>
              Try a longer timeframe or check back later.
            </p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              {[
                {
                  label: "TOTAL CALLS",
                  value: <span style={{ color: "#f0f0f0", fontSize: "20px", fontWeight: 700 }}>{data.totalCalls}</span>,
                },
                {
                  label: "LONG %",
                  value: (
                    <span style={{ color: "#2ecc71", fontSize: "20px", fontWeight: 700 }}>
                      {data.totalCalls > 0
                        ? Math.round((data.longCount / data.totalCalls) * 100)
                        : 0}%
                    </span>
                  ),
                },
                {
                  label: "SHORT %",
                  value: (
                    <span style={{ color: "#e74c3c", fontSize: "20px", fontWeight: 700 }}>
                      {data.totalCalls > 0
                        ? Math.round((data.shortCount / data.totalCalls) * 100)
                        : 0}%
                    </span>
                  ),
                },
                {
                  label: "AVG P&L",
                  value: <span style={{ fontSize: "20px", fontWeight: 700 }}><PnlDisplay value={data.avgPnl} /></span>,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: "#0f0f22",
                    border: "1px solid #1a1a2e",
                    borderRadius: "8px",
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#555568",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      marginBottom: "8px",
                    }}
                  >
                    {label}
                  </div>
                  {value}
                </div>
              ))}
            </div>

            {/* CT Callers table */}
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
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid #1a1a2e",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "#555568",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  CT CALLERS
                </span>
              </div>

              {/* Column headers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 90px 90px 130px",
                  padding: "10px 20px",
                  borderBottom: "1px solid #1a1a2e",
                  gap: "12px",
                }}
              >
                {["TRADER", "DIRECTION", "P&L", "POSTED", "WIN RATE"].map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: "11px",
                      color: "#555568",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {data.calls.map((call, idx) => (
                <div
                  key={`${call.handle}-${call.postedAt}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 90px 90px 130px",
                    padding: "12px 20px",
                    gap: "12px",
                    borderBottom: idx < data.calls.length - 1 ? "1px solid #1a1a2e" : "none",
                    background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                    alignItems: "center",
                  }}
                >
                  {/* Trader */}
                  <div>
                    <Link
                      href={`/@${call.handle}`}
                      style={{
                        color: "#f0f0f0",
                        textDecoration: "none",
                        fontSize: "13px",
                        fontWeight: 400,
                      }}
                    >
                      @{call.handle}
                    </Link>
                    {call.sourceUrl && (
                      <a
                        href={call.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#555568",
                          fontSize: "11px",
                          marginLeft: "8px",
                          textDecoration: "none",
                        }}
                      >
                        ↗
                      </a>
                    )}
                    {call.platform && (
                      <span
                        style={{
                          color: "#333348",
                          fontSize: "10px",
                          marginLeft: "6px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {call.platform}
                      </span>
                    )}
                  </div>

                  {/* Direction */}
                  <div>
                    <DirectionTag direction={call.direction} />
                  </div>

                  {/* P&L */}
                  <div style={{ fontSize: "13px" }}>
                    <PnlDisplay value={call.pnlPct} />
                  </div>

                  {/* Posted */}
                  <div style={{ color: "#c8c8d0", fontSize: "12px" }}>
                    {formatDate(call.postedAt)}
                  </div>

                  {/* Win rate */}
                  <div>
                    <WinRateBar rate={call.winRate} />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              style={{
                marginTop: "24px",
                textAlign: "right",
                fontSize: "11px",
                color: "#333348",
                letterSpacing: "0.5px",
              }}
            >
              Updated {formatDate(data.updatedAt)} — paste.markets
            </div>
          </>
        )}
      </div>
    </main>
  );
}
