import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

// Design tokens
const BG = "#0a0a1a";
const SURFACE = "#0f0f22";
const BORDER = "#1a1a2e";
const TEXT = "#f0f0f0";
const MUTED = "#555568";
const GREEN = "#2ecc71";
const RED = "#e74c3c";
const AMBER = "#f39c12";
const ACCENT = "#3b82f6";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

const TRADE_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

async function loadFont(): Promise<ArrayBuffer> {
  const fontData = await fetch(
    "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff"
  ).then((res) => res.arrayBuffer());
  return fontData;
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

function formatCallDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function pnlColor(pnl: number): string {
  return pnl >= 0 ? GREEN : RED;
}

function WinRateBar({ winRate }: { winRate: number }) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: "16px",
            height: "16px",
            backgroundColor: i < Math.round(winRate / 10) ? GREEN : BORDER,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image builders
// ---------------------------------------------------------------------------

function homeImage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "60px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "64px",
            fontWeight: 700,
            color: TEXT,
            marginBottom: "16px",
          }}
        >
          paste.markets
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "22px",
            color: MUTED,
            marginBottom: "40px",
          }}
        >
          Real P&amp;L rankings for Crypto Twitter
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "18px",
            color: ACCENT,
            marginBottom: "60px",
            gap: "12px",
          }}
        >
          <span>Leaderboard</span>
          <span style={{ color: MUTED }}>·</span>
          <span>Head-to-Head</span>
          <span style={{ color: MUTED }}>·</span>
          <span>CT Wrapped</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "14px",
            color: MUTED,
          }}
        >
          Powered by paste.trade
        </div>
      </div>
    </div>
  );
}

function tradeImage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "60px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "56px",
            fontWeight: 700,
            color: TEXT,
            marginBottom: "16px",
          }}
        >
          WHAT&apos;S THE TRADE?
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "22px",
            color: MUTED,
            marginBottom: "40px",
          }}
        >
          Paste any URL. AI finds the trade.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "18px",
            color: ACCENT,
            gap: "12px",
          }}
        >
          <span>Tweets</span>
          <span style={{ color: MUTED }}>·</span>
          <span>Articles</span>
          <span style={{ color: MUTED }}>·</span>
          <span>Videos</span>
          <span style={{ color: MUTED }}>·</span>
          <span>Any thesis</span>
        </div>
      </div>
    </div>
  );
}

interface LeaderboardEntry {
  rank: number;
  handle: string;
  winRate: number;
  avgPnl: number;
}

function leaderboardImage(entries: LeaderboardEntry[]) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "48px 60px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "14px",
            color: MUTED,
            letterSpacing: "2px",
            textTransform: "uppercase" as const,
            marginBottom: "8px",
          }}
        >
          CT LEADERBOARD
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "36px",
            fontWeight: 700,
            color: TEXT,
          }}
        >
          paste.markets
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            padding: "8px 16px",
            fontSize: "12px",
            color: MUTED,
            letterSpacing: "1px",
            textTransform: "uppercase" as const,
          }}
        >
          <div style={{ display: "flex", width: "60px" }}>#</div>
          <div style={{ display: "flex", flex: 1 }}>HANDLE</div>
          <div style={{ display: "flex", width: "160px" }}>WIN RATE</div>
          <div style={{ display: "flex", width: "120px", justifyContent: "flex-end" }}>AVG P&amp;L</div>
        </div>

        {entries.map((entry) => (
          <div
            key={entry.rank}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              backgroundColor: SURFACE,
              borderRadius: "8px",
              border: `1px solid ${BORDER}`,
            }}
          >
            <div
              style={{
                display: "flex",
                width: "60px",
                fontSize: "18px",
                fontWeight: 700,
                color: entry.rank <= 3 ? AMBER : MUTED,
              }}
            >
              {entry.rank}
            </div>
            <div
              style={{
                display: "flex",
                flex: 1,
                fontSize: "18px",
                fontWeight: 700,
                color: TEXT,
              }}
            >
              @{entry.handle}
            </div>
            <div
              style={{
                display: "flex",
                width: "160px",
                fontSize: "16px",
                color: TEXT,
              }}
            >
              {entry.winRate.toFixed(0)}%
            </div>
            <div
              style={{
                display: "flex",
                width: "120px",
                justifyContent: "flex-end",
                fontSize: "16px",
                fontWeight: 700,
                color: pnlColor(entry.avgPnl),
              }}
            >
              {formatPnl(entry.avgPnl)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: "auto",
          fontSize: "12px",
          color: MUTED,
        }}
      >
        Powered by paste.trade
      </div>
    </div>
  );
}

interface AuthorData {
  handle: string;
  metrics: {
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    bestTrade?: { ticker: string; pnl: number } | null;
  };
  rank: number | null;
}

function authorImage(data: AuthorData) {
  const { handle, metrics, rank } = data;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "48px 60px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginBottom: "36px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "14px",
            color: MUTED,
            letterSpacing: "2px",
            textTransform: "uppercase" as const,
            marginBottom: "8px",
          }}
        >
          TRADE SCORECARD
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "40px",
              fontWeight: 700,
              color: TEXT,
            }}
          >
            @{handle}
          </div>
          {rank != null && (
            <div
              style={{
                display: "flex",
                fontSize: "18px",
                color: AMBER,
                border: `1px solid ${AMBER}`,
                borderRadius: "6px",
                padding: "4px 12px",
              }}
            >
              #{rank}
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          marginBottom: "36px",
        }}
      >
        {/* Win Rate */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", fontSize: "12px", color: MUTED, marginBottom: "8px", letterSpacing: "1px" }}>
            WIN RATE
          </div>
          <div style={{ display: "flex", fontSize: "36px", fontWeight: 700, color: TEXT, marginBottom: "12px" }}>
            {metrics.winRate.toFixed(0)}%
          </div>
          <WinRateBar winRate={metrics.winRate} />
        </div>

        {/* Avg P&L */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", fontSize: "12px", color: MUTED, marginBottom: "8px", letterSpacing: "1px" }}>
            AVG P&amp;L
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "36px",
              fontWeight: 700,
              color: pnlColor(metrics.avgPnl),
            }}
          >
            {formatPnl(metrics.avgPnl)}
          </div>
        </div>

        {/* Total Trades */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", fontSize: "12px", color: MUTED, marginBottom: "8px", letterSpacing: "1px" }}>
            TOTAL TRADES
          </div>
          <div style={{ display: "flex", fontSize: "36px", fontWeight: 700, color: TEXT }}>
            {metrics.totalTrades}
          </div>
        </div>
      </div>

      {/* Best Call */}
      {metrics.bestTrade && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "16px 20px",
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", fontSize: "12px", color: MUTED, letterSpacing: "1px" }}>BEST CALL</div>
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: TEXT }}>
            ${metrics.bestTrade.ticker}
          </div>
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: GREEN }}>
            {formatPnl(metrics.bestTrade.pnl)}
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          marginTop: "auto",
          fontSize: "12px",
          color: MUTED,
        }}
      >
        paste.markets — Powered by paste.trade
      </div>
    </div>
  );
}

interface VsData {
  a: { handle: string; metrics: { winRate: number; avgPnl: number; totalTrades: number } };
  b: { handle: string; metrics: { winRate: number; avgPnl: number; totalTrades: number } };
  comparison: { overallWinner: "a" | "b" | "tie" };
}

function vsImage(data: VsData) {
  const { a, b, comparison } = data;
  const winnerLabel =
    comparison.overallWinner === "a"
      ? `@${a.handle} wins`
      : comparison.overallWinner === "b"
        ? `@${b.handle} wins`
        : "TIE";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "48px 60px",
      }}
    >
      {/* Title */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          fontSize: "40px",
          fontWeight: 700,
          color: TEXT,
          marginBottom: "8px",
        }}
      >
        <span style={{ color: ACCENT }}>@{a.handle}</span>
        <span style={{ color: MUTED, margin: "0 16px" }}>VS</span>
        <span style={{ color: RED }}>@{b.handle}</span>
      </div>

      {/* Winner banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          fontSize: "16px",
          color: AMBER,
          marginBottom: "36px",
        }}
      >
        {winnerLabel}
      </div>

      {/* Comparison grid */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            padding: "0 16px",
            fontSize: "12px",
            color: MUTED,
            letterSpacing: "1px",
          }}
        >
          <div style={{ display: "flex", flex: 1 }}></div>
          <div style={{ display: "flex", width: "200px", justifyContent: "center" }}>@{a.handle}</div>
          <div style={{ display: "flex", width: "200px", justifyContent: "center" }}>@{b.handle}</div>
        </div>

        {/* Win Rate row */}
        {[
          { label: "WIN RATE", aVal: `${a.metrics.winRate.toFixed(0)}%`, bVal: `${b.metrics.winRate.toFixed(0)}%`, aNum: a.metrics.winRate, bNum: b.metrics.winRate },
          { label: "AVG P&L", aVal: formatPnl(a.metrics.avgPnl), bVal: formatPnl(b.metrics.avgPnl), aNum: a.metrics.avgPnl, bNum: b.metrics.avgPnl },
          { label: "TRADES", aVal: String(a.metrics.totalTrades), bVal: String(b.metrics.totalTrades), aNum: a.metrics.totalTrades, bNum: b.metrics.totalTrades },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "16px",
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", flex: 1, fontSize: "14px", color: MUTED, letterSpacing: "1px" }}>
              {row.label}
            </div>
            <div
              style={{
                display: "flex",
                width: "200px",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 700,
                color: row.aNum >= row.bNum ? GREEN : TEXT,
              }}
            >
              {row.aVal}
            </div>
            <div
              style={{
                display: "flex",
                width: "200px",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 700,
                color: row.bNum >= row.aNum ? GREEN : TEXT,
              }}
            >
              {row.bVal}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: "auto",
          fontSize: "12px",
          color: MUTED,
        }}
      >
        paste.markets — Powered by paste.trade
      </div>
    </div>
  );
}

interface WrappedData {
  handle: string;
  personality: { label: string; description: string; color?: string };
  grades: { overall: string };
  highlights: {
    winRate: number;
    totalTrades: number;
    avgPnl?: number;
    biggestWin?: { ticker: string; pnl: number };
    favoriteTicker?: string;
  };
}

function wrappedImage(data: WrappedData, slide?: number) {
  const { handle, personality, grades, highlights } = data;
  const pColor = personality.color ?? ACCENT;

  // Slide 1: Volume stats
  if (slide === 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: `${WIDTH}px`, height: `${HEIGHT}px`, background: `radial-gradient(ellipse at 50% 40%, ${pColor}15 0%, ${BG} 70%)`, fontFamily: "JetBrains Mono", padding: "48px 60px", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: "13px", color: MUTED, letterSpacing: "2px", textTransform: "uppercase" as const, marginBottom: "16px" }}>@{handle} · CT WRAPPED</div>
        <div style={{ display: "flex", fontSize: "18px", color: MUTED, marginBottom: "12px" }}>Made</div>
        <div style={{ display: "flex", fontSize: "80px", fontWeight: 700, color: TEXT }}>{highlights.totalTrades}</div>
        <div style={{ display: "flex", fontSize: "18px", color: MUTED, marginTop: "12px" }}>trades this year</div>
        {highlights.favoriteTicker && (
          <div style={{ display: "flex", fontSize: "16px", color: ACCENT, marginTop: "32px" }}>Favorite: ${highlights.favoriteTicker}</div>
        )}
        <div style={{ display: "flex", marginTop: "auto", fontSize: "12px", color: MUTED }}>paste.markets</div>
      </div>
    );
  }

  // Slide 2: Best trade
  if (slide === 2 && highlights.biggestWin && highlights.biggestWin.pnl > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: `${WIDTH}px`, height: `${HEIGHT}px`, background: `radial-gradient(ellipse at 50% 40%, ${GREEN}15 0%, ${BG} 70%)`, fontFamily: "JetBrains Mono", padding: "48px 60px", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: "13px", color: MUTED, letterSpacing: "2px", textTransform: "uppercase" as const, marginBottom: "16px" }}>@{handle} · Best Call</div>
        <div style={{ display: "flex", fontSize: "22px", color: MUTED, marginBottom: "16px" }}>LONG ${highlights.biggestWin.ticker}</div>
        <div style={{ display: "flex", fontSize: "80px", fontWeight: 700, color: GREEN }}>+{highlights.biggestWin.pnl.toFixed(1)}%</div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: "12px", color: MUTED }}>paste.markets</div>
      </div>
    );
  }

  // Slide 3 or default: Personality card (the main shareable one)
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        background: `radial-gradient(ellipse at 50% 40%, ${pColor}20 0%, ${BG} 70%)`,
        fontFamily: "JetBrains Mono",
        padding: "48px 60px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", marginBottom: "32px" }}>
        <div style={{ display: "flex", fontSize: "14px", color: MUTED, letterSpacing: "2px", textTransform: "uppercase" as const, marginBottom: "8px" }}>CT WRAPPED</div>
        <div style={{ display: "flex", fontSize: "40px", fontWeight: 700, color: TEXT }}>@{handle}</div>
      </div>

      {/* Personality + Grade */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "32px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "24px" }}>
          <div style={{ display: "flex", fontSize: "12px", color: MUTED, marginBottom: "8px", letterSpacing: "1px" }}>PERSONALITY</div>
          <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: pColor, marginBottom: "8px" }}>{personality.label}</div>
          <div style={{ display: "flex", fontSize: "14px", color: MUTED }}>{personality.description}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "160px", backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "24px" }}>
          <div style={{ display: "flex", fontSize: "12px", color: MUTED, marginBottom: "8px", letterSpacing: "1px" }}>GRADE</div>
          <div style={{ display: "flex", fontSize: "64px", fontWeight: 700, color: grades.overall === "S" ? AMBER : grades.overall === "A" ? GREEN : grades.overall === "F" ? RED : TEXT }}>{grades.overall}</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px" }}>
          <div style={{ display: "flex", fontSize: "12px", color: MUTED, marginBottom: "8px", letterSpacing: "1px" }}>WIN RATE</div>
          <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: TEXT, marginBottom: "10px" }}>{highlights.winRate.toFixed(0)}%</div>
          <WinRateBar winRate={highlights.winRate} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px" }}>
          <div style={{ display: "flex", fontSize: "12px", color: MUTED, marginBottom: "8px", letterSpacing: "1px" }}>TRADE COUNT</div>
          <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: TEXT }}>{highlights.totalTrades}</div>
        </div>
      </div>

      <div style={{ display: "flex", marginTop: "auto", fontSize: "12px", color: MUTED }}>paste.markets — Get yours at paste.markets/wrapped</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trade card image builders (multi-format)
// ---------------------------------------------------------------------------

interface TradeCardData {
  ticker?: string;
  direction?: string;
  pnlPct?: number | null;
  entryPrice?: number | null;
  currentPrice?: number | null;
  thesis?: string | null;
  headline_quote?: string | null;
  posted_at?: string | null;
  platform?: string | null;
  author_handle?: string | null;
}

function tradeDetailLandscapeImage(trade: TradeCardData, handle: string) {
  const direction: string = String(trade.direction ?? "").toUpperCase();
  const isUp = direction === "LONG" || direction === "YES";
  const dirColor = isUp ? GREEN : RED;
  const hasPnl = trade.pnlPct != null;
  const pnl: number = hasPnl ? Number(trade.pnlPct) : 0;
  const pnlStr = hasPnl ? formatPnl(pnl) : "";
  const rawThesis: string = trade.thesis ?? trade.headline_quote ?? "";
  const shortThesis = rawThesis.length > 100 ? rawThesis.slice(0, 97) + "..." : rawThesis;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "48px 60px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: "13px",
          color: MUTED,
          letterSpacing: "2px",
          textTransform: "uppercase" as const,
          marginBottom: "28px",
        }}
      >
        TRADE CALL
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "72px",
            fontWeight: 700,
            color: TEXT,
            lineHeight: "1",
          }}
        >
          ${trade.ticker ?? "???"}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "28px",
            fontWeight: 700,
            color: dirColor,
            border: `2px solid ${dirColor}`,
            borderRadius: "8px",
            padding: "6px 16px",
            marginBottom: "8px",
          }}
        >
          {direction}
        </div>
      </div>
      {hasPnl && (
        <div
          style={{
            display: "flex",
            fontSize: "56px",
            fontWeight: 700,
            color: pnlColor(pnl),
            marginBottom: "24px",
            lineHeight: "1",
          }}
        >
          {pnlStr}
        </div>
      )}
      {(trade.entryPrice != null || trade.currentPrice != null) && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            marginBottom: "24px",
            fontSize: "20px",
            color: MUTED,
          }}
        >
          {trade.entryPrice != null && (
            <span>Entry ${Number(trade.entryPrice).toFixed(4)}</span>
          )}
          {trade.entryPrice != null && trade.currentPrice != null && (
            <span style={{ display: "flex" }}>&rarr;</span>
          )}
          {trade.currentPrice != null && (
            <span>Now ${Number(trade.currentPrice).toFixed(4)}</span>
          )}
        </div>
      )}
      {shortThesis && (
        <div
          style={{
            display: "flex",
            fontSize: "18px",
            color: MUTED,
            fontStyle: "italic",
            borderLeft: `3px solid ${BORDER}`,
            paddingLeft: "16px",
            lineHeight: "1.5",
          }}
        >
          &ldquo;{shortThesis}&rdquo;
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "auto",
        }}
      >
        <div style={{ display: "flex", fontSize: "22px", color: TEXT, fontWeight: 700 }}>
          @{handle}
        </div>
        <div style={{ display: "flex", fontSize: "14px", color: MUTED }}>
          paste.markets
        </div>
      </div>
    </div>
  );
}

function tradeDetailSquareImage(trade: TradeCardData, handle: string) {
  const direction: string = String(trade.direction ?? "").toUpperCase();
  const isUp = direction === "LONG" || direction === "YES";
  const dirColor = isUp ? GREEN : RED;
  const hasPnl = trade.pnlPct != null;
  const pnl: number = hasPnl ? Number(trade.pnlPct) : 0;
  const pnlStr = hasPnl ? formatPnl(pnl) : "";
  const rawThesis: string = trade.thesis ?? trade.headline_quote ?? "";
  const shortThesis = rawThesis.length > 120 ? rawThesis.slice(0, 117) + "..." : rawThesis;
  const isBigWinner = hasPnl && pnl >= 50;
  const statusColor = hasPnl ? (pnl >= 0 ? GREEN : RED) : MUTED;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1080px",
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "72px",
        borderLeft: `6px solid ${statusColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "64px",
        }}
      >
        <div style={{ display: "flex", fontSize: "18px", color: MUTED, letterSpacing: "2px" }}>
          PASTE.MARKETS
        </div>
        {hasPnl && (
          <div
            style={{
              display: "flex",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: statusColor,
            }}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: "100px",
          fontWeight: 700,
          color: TEXT,
          lineHeight: "1",
          marginBottom: "20px",
        }}
      >
        ${trade.ticker ?? "???"}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          marginBottom: "48px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "28px",
            fontWeight: 700,
            color: dirColor,
            border: `2px solid ${dirColor}`,
            borderRadius: "8px",
            padding: "6px 20px",
          }}
        >
          {direction}
        </div>
        <div style={{ display: "flex", fontSize: "22px", color: MUTED }}>
          via @{handle}
        </div>
      </div>
      {(trade.entryPrice != null || trade.currentPrice != null) && (
        <div
          style={{
            display: "flex",
            gap: "40px",
            alignItems: "center",
            marginBottom: "40px",
            fontSize: "20px",
            color: MUTED,
          }}
        >
          {trade.entryPrice != null && (
            <span>Entry ${Number(trade.entryPrice).toFixed(2)}</span>
          )}
          {trade.entryPrice != null && trade.currentPrice != null && (
            <span style={{ display: "flex" }}>&rarr;</span>
          )}
          {trade.currentPrice != null && (
            <span>Now ${Number(trade.currentPrice).toFixed(2)}</span>
          )}
        </div>
      )}
      {hasPnl && (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "40px" }}>
          <div
            style={{
              display: "flex",
              fontSize: isBigWinner ? "108px" : "88px",
              fontWeight: 700,
              color: pnlColor(pnl),
              lineHeight: "1",
            }}
          >
            {pnlStr}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "14px",
              color: isBigWinner ? AMBER : MUTED,
              letterSpacing: "2px",
              marginTop: "8px",
            }}
          >
            {isBigWinner ? "TOP CALL" : "SINCE CALL"}
          </div>
        </div>
      )}
      {shortThesis && (
        <div
          style={{
            display: "flex",
            fontSize: "20px",
            color: MUTED,
            fontStyle: "italic",
            borderLeft: `3px solid ${BORDER}`,
            paddingLeft: "20px",
            lineHeight: "1.6",
            flex: 1,
          }}
        >
          &ldquo;{shortThesis}&rdquo;
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {trade.posted_at && (
            <div style={{ display: "flex", fontSize: "14px", color: MUTED }}>
              Called {formatCallDate(trade.posted_at)}
            </div>
          )}
          {trade.platform && (
            <div
              style={{
                display: "flex",
                fontSize: "12px",
                color: MUTED,
                letterSpacing: "1px",
              }}
            >
              {String(trade.platform).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: "16px", color: MUTED }}>
          paste.markets
        </div>
      </div>
    </div>
  );
}

function tradeDetailStoryImage(trade: TradeCardData, handle: string) {
  const direction: string = String(trade.direction ?? "").toUpperCase();
  const isUp = direction === "LONG" || direction === "YES";
  const dirColor = isUp ? GREEN : RED;
  const hasPnl = trade.pnlPct != null;
  const pnl: number = hasPnl ? Number(trade.pnlPct) : 0;
  const pnlStr = hasPnl ? formatPnl(pnl) : "";
  const rawThesis: string = trade.thesis ?? trade.headline_quote ?? "";
  const shortThesis = rawThesis.length > 160 ? rawThesis.slice(0, 157) + "..." : rawThesis;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1920px",
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "100px 72px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: "22px",
          color: MUTED,
          letterSpacing: "3px",
          marginBottom: "80px",
        }}
      >
        PASTE.MARKETS
      </div>
      <div
        style={{
          display: "flex",
          fontSize: "14px",
          color: MUTED,
          letterSpacing: "3px",
          textTransform: "uppercase" as const,
          marginBottom: "32px",
        }}
      >
        TRADE CALL
      </div>
      <div
        style={{
          display: "flex",
          fontSize: "140px",
          fontWeight: 700,
          color: TEXT,
          lineHeight: "1",
          marginBottom: "32px",
        }}
      >
        ${trade.ticker ?? "???"}
      </div>
      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "center",
          marginBottom: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "36px",
            fontWeight: 700,
            color: dirColor,
            border: `3px solid ${dirColor}`,
            borderRadius: "10px",
            padding: "10px 28px",
          }}
        >
          {direction}
        </div>
        <div style={{ display: "flex", fontSize: "28px", color: MUTED }}>
          @{handle}
        </div>
      </div>
      {hasPnl && (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "64px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "160px",
              fontWeight: 700,
              color: pnlColor(pnl),
              lineHeight: "1",
            }}
          >
            {pnlStr}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "18px",
              color: MUTED,
              letterSpacing: "2px",
              marginTop: "12px",
            }}
          >
            SINCE CALL
          </div>
        </div>
      )}
      {(trade.entryPrice != null || trade.currentPrice != null) && (
        <div
          style={{
            display: "flex",
            gap: "24px",
            alignItems: "center",
            marginBottom: "60px",
            fontSize: "26px",
            color: MUTED,
          }}
        >
          {trade.entryPrice != null && (
            <span>Entry ${Number(trade.entryPrice).toFixed(2)}</span>
          )}
          {trade.entryPrice != null && trade.currentPrice != null && (
            <span style={{ display: "flex" }}>&rarr;</span>
          )}
          {trade.currentPrice != null && (
            <span>Now ${Number(trade.currentPrice).toFixed(2)}</span>
          )}
        </div>
      )}
      {shortThesis && (
        <div
          style={{
            display: "flex",
            fontSize: "28px",
            color: MUTED,
            fontStyle: "italic",
            borderLeft: `4px solid ${BORDER}`,
            paddingLeft: "28px",
            lineHeight: "1.6",
            flex: 1,
          }}
        >
          &ldquo;{shortThesis}&rdquo;
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginTop: "auto",
        }}
      >
        {trade.posted_at && (
          <div style={{ display: "flex", fontSize: "22px", color: MUTED }}>
            Called {formatCallDate(trade.posted_at)}
            {trade.platform ? ` · ${String(trade.platform)}` : ""}
          </div>
        )}
        <div style={{ display: "flex", fontSize: "32px", fontWeight: 700, color: TEXT }}>
          Tracked on paste.markets
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const [type, ...rest] = slug;

  const fontData = await loadFont();
  const fonts = [
    {
      name: "JetBrains Mono",
      data: fontData,
      style: "normal" as const,
      weight: 400 as const,
    },
  ];

  const imageOptions = {
    width: WIDTH,
    height: HEIGHT,
    fonts,
    headers: CACHE_HEADERS,
  };

  try {
    switch (type) {
      case "home": {
        return new ImageResponse(homeImage(), imageOptions);
      }

      case "trade": {
        // If rest[0] is a trade ID, render trade-detail OG
        const tradeId = rest[0];
        if (tradeId) {
          const urlObj = new URL(request.url);
          const authorHint = urlObj.searchParams.get("author") ?? undefined;
          const format = urlObj.searchParams.get("format") ?? "landscape";
          try {
            const apiPath = `/api/trade/${encodeURIComponent(tradeId)}${authorHint ? `?author=${encodeURIComponent(authorHint)}` : ""}`;
            const res = await fetch(`${baseUrl()}${apiPath}`);
            if (!res.ok) throw new Error(`Trade fetch failed: ${res.status}`);
            const trade: TradeCardData = await res.json();
            const handle: string = trade.author_handle ?? authorHint ?? "unknown";

            // Determine dimensions based on format
            let tradeW = WIDTH, tradeH = HEIGHT;
            if (format === "square") { tradeW = 1080; tradeH = 1080; }
            else if (format === "story") { tradeW = 1080; tradeH = 1920; }

            const tradeImageOpts = {
              width: tradeW,
              height: tradeH,
              fonts,
              headers: TRADE_CACHE_HEADERS,
            };

            const cardJsx =
              format === "square"
                ? tradeDetailSquareImage(trade, handle)
                : format === "story"
                  ? tradeDetailStoryImage(trade, handle)
                  : tradeDetailLandscapeImage(trade, handle);

            return new ImageResponse(cardJsx, tradeImageOpts);
          } catch {
            return new ImageResponse(tradeImage(), imageOptions);
          }
        }
        // Generic trade finder OG (no ID in slug)
        return new ImageResponse(tradeImage(), imageOptions);
      }

      case "leaderboard": {
        try {
          const res = await fetch(`${baseUrl()}/api/leaderboard?limit=5`);
          if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
          const data = await res.json();
          const entries: LeaderboardEntry[] = (data.entries ?? []).slice(0, 5);
          return new ImageResponse(leaderboardImage(entries), imageOptions);
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      case "caller":
      case "author": {
        const handle = rest[0];
        if (!handle) {
          return new ImageResponse(homeImage(), imageOptions);
        }
        try {
          const res = await fetch(`${baseUrl()}/api/author/${encodeURIComponent(handle)}`);
          if (!res.ok) throw new Error(`Author fetch failed: ${res.status}`);
          const data = await res.json();
          const authorData: AuthorData = {
            handle: data.handle ?? handle,
            metrics: {
              winRate: data.metrics?.winRate ?? 0,
              avgPnl: data.metrics?.avgPnl ?? 0,
              totalTrades: data.metrics?.totalTrades ?? 0,
              bestTrade: data.metrics?.bestTrade ?? null,
            },
            rank: data.rank ?? null,
          };
          return new ImageResponse(authorImage(authorData), imageOptions);
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      case "vs": {
        const a = rest[0];
        const b = rest[1];
        if (!a || !b) {
          return new ImageResponse(homeImage(), imageOptions);
        }
        try {
          const res = await fetch(
            `${baseUrl()}/api/vs?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
          );
          if (!res.ok) throw new Error(`VS fetch failed: ${res.status}`);
          const data = await res.json();
          const vsData: VsData = {
            a: {
              handle: data.a?.handle ?? a,
              metrics: {
                winRate: data.a?.metrics?.winRate ?? 0,
                avgPnl: data.a?.metrics?.avgPnl ?? 0,
                totalTrades: data.a?.metrics?.totalTrades ?? 0,
              },
            },
            b: {
              handle: data.b?.handle ?? b,
              metrics: {
                winRate: data.b?.metrics?.winRate ?? 0,
                avgPnl: data.b?.metrics?.avgPnl ?? 0,
                totalTrades: data.b?.metrics?.totalTrades ?? 0,
              },
            },
            comparison: {
              overallWinner: data.comparison?.overallWinner ?? "tie",
            },
          };
          return new ImageResponse(vsImage(vsData), imageOptions);
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      case "circle": {
        try {
          const res = await fetch(`${baseUrl()}/api/circle?timeframe=30d&limit=50`);
          if (!res.ok) throw new Error(`Circle fetch failed: ${res.status}`);
          const data = await res.json();

          const innerCallers: Array<{ rank: number; handle: string; winRate: number; avgPnl: number; tier: string }> =
            (data.callers ?? []).filter((c: { ring: string }) => c.ring === "inner").slice(0, 5);
          const middleCallers: Array<{ rank: number; handle: string; winRate: number }> =
            (data.callers ?? []).filter((c: { ring: string }) => c.ring === "middle").slice(0, 10);
          const totalCallers = data.total ?? 0;

          const ogPnlColor = (v: number) => (v >= 0 ? GREEN : RED);
          const ogFmtPnl = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
          const ogWrColor = (wr: number) => (wr >= 65 ? GREEN : wr >= 50 ? AMBER : RED);

          return new ImageResponse(
            (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: `${WIDTH}px`,
                  height: `${HEIGHT}px`,
                  backgroundColor: BG,
                  fontFamily: "JetBrains Mono",
                  padding: "44px 56px",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                      style={{
                        display: "flex",
                        fontSize: "13px",
                        color: MUTED,
                        letterSpacing: "2px",
                        textTransform: "uppercase" as const,
                        marginBottom: "8px",
                      }}
                    >
                      CALLER CIRCLE
                    </div>
                    <div style={{ display: "flex", fontSize: "36px", fontWeight: 700, color: TEXT }}>
                      paste.markets
                    </div>
                  </div>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                  }}>
                    <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: AMBER }}>
                      Top {totalCallers}
                    </div>
                    <div style={{ display: "flex", fontSize: "12px", color: MUTED, letterSpacing: "1px" }}>
                      TRADERS BY WIN RATE
                    </div>
                  </div>
                </div>

                {/* Main content: circle + list */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "40px",
                    flex: 1,
                  }}
                >
                  {/* Circle diagram */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "320px",
                      height: "320px",
                      borderRadius: "50%",
                      border: `2px solid ${BORDER}`,
                      position: "relative",
                      flexShrink: 0,
                      backgroundColor: SURFACE,
                    }}
                  >
                    {/* Outer ring */}
                    <div
                      style={{
                        display: "flex",
                        position: "absolute",
                        width: "260px",
                        height: "260px",
                        borderRadius: "50%",
                        border: `1px dashed ${BORDER}`,
                      }}
                    />
                    {/* Middle ring */}
                    <div
                      style={{
                        display: "flex",
                        position: "absolute",
                        width: "180px",
                        height: "180px",
                        borderRadius: "50%",
                        border: `1.5px solid ${ACCENT}`,
                        opacity: 0.4,
                      }}
                    />
                    {/* Inner ring */}
                    <div
                      style={{
                        display: "flex",
                        position: "absolute",
                        width: "100px",
                        height: "100px",
                        borderRadius: "50%",
                        border: `1.5px solid ${AMBER}`,
                        opacity: 0.5,
                      }}
                    />

                    {/* Middle ring caller dots */}
                    {middleCallers.map((c: { handle: string; winRate: number }, i: number) => {
                      const angle = (2 * Math.PI * i) / middleCallers.length - Math.PI / 2;
                      const rx = 90;
                      const dotX = 160 + rx * Math.cos(angle) - 8;
                      const dotY = 160 + rx * Math.sin(angle) - 8;
                      return (
                        <div
                          key={c.handle}
                          style={{
                            display: "flex",
                            position: "absolute",
                            left: `${dotX}px`,
                            top: `${dotY}px`,
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            backgroundColor: ACCENT,
                            border: `1px solid ${ACCENT}`,
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "6px",
                            color: TEXT,
                            fontWeight: 700,
                          }}
                        >
                          {Math.round(c.winRate)}
                        </div>
                      );
                    })}

                    {/* Inner ring caller dots */}
                    {innerCallers.map((c: { handle: string; winRate: number }, i: number) => {
                      const angle = (2 * Math.PI * i) / innerCallers.length - Math.PI / 2;
                      const rx = 50;
                      const dotX = 160 + rx * Math.cos(angle) - 12;
                      const dotY = 160 + rx * Math.sin(angle) - 12;
                      return (
                        <div
                          key={c.handle}
                          style={{
                            display: "flex",
                            position: "absolute",
                            left: `${dotX}px`,
                            top: `${dotY}px`,
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            backgroundColor: AMBER,
                            border: `2px solid ${AMBER}`,
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "8px",
                            color: BG,
                            fontWeight: 800,
                          }}
                        >
                          {i + 1}
                        </div>
                      );
                    })}

                    {/* Center label */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        backgroundColor: BG,
                        border: `1px solid ${AMBER}`,
                      }}
                    >
                      <div style={{ display: "flex", fontSize: "7px", color: AMBER, letterSpacing: "1px", fontWeight: 700 }}>
                        TOP
                      </div>
                      <div style={{ display: "flex", fontSize: "10px", color: AMBER, fontWeight: 800 }}>
                        {totalCallers}
                      </div>
                    </div>
                  </div>

                  {/* Top callers list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        fontSize: "11px",
                        color: AMBER,
                        letterSpacing: "1.5px",
                        marginBottom: "2px",
                        fontWeight: 600,
                      }}
                    >
                      INNER CIRCLE (30D)
                    </div>
                    {innerCallers.map((caller: { rank: number; handle: string; winRate: number; avgPnl: number; tier: string }, i: number) => (
                      <div
                        key={caller.handle}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          backgroundColor: i === 0 ? "rgba(243,156,18,0.08)" : SURFACE,
                          border: `1px solid ${i === 0 ? AMBER : BORDER}`,
                          borderRadius: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            backgroundColor: i === 0 ? AMBER : BORDER,
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            color: i === 0 ? BG : TEXT,
                            fontWeight: 800,
                          }}
                        >
                          {caller.rank}
                        </div>
                        <div style={{ display: "flex", flex: 1, fontSize: "15px", fontWeight: 700, color: TEXT }}>
                          @{caller.handle}
                        </div>
                        <div style={{ display: "flex", fontSize: "14px", fontWeight: 700, color: ogWrColor(caller.winRate) }}>
                          {Math.round(caller.winRate)}%
                        </div>
                        <div style={{ display: "flex", fontSize: "13px", color: ogPnlColor(caller.avgPnl) }}>
                          {ogFmtPnl(caller.avgPnl)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", marginTop: "12px", fontSize: "11px", color: MUTED }}>
                  paste.markets/circle · Powered by paste.trade
                </div>
              </div>
            ),
            imageOptions,
          );
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      case "alpha": {
        try {
          const res = await fetch(`${baseUrl()}/api/alpha?limit=5&tier=smart`);
          if (!res.ok) throw new Error(`Alpha fetch failed: ${res.status}`);
          const data = await res.json();
          const trades: Array<{
            handle: string;
            ticker: string;
            direction: string;
            winRate: number;
            evScore: number;
            pnlPct: number | null;
          }> = (data.trades ?? []).slice(0, 5);

          const dColor = (d: string) => (d === "long" || d === "yes" ? GREEN : RED);
          const evCol = (ev: number) => (ev >= 10 ? GREEN : ev >= 5 ? AMBER : ev >= 2 ? ACCENT : MUTED);

          return new ImageResponse(
            (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: `${WIDTH}px`,
                  height: `${HEIGHT}px`,
                  backgroundColor: BG,
                  fontFamily: "JetBrains Mono",
                  padding: "48px 60px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", marginBottom: "28px" }}>
                  <div style={{ display: "flex", fontSize: "13px", color: MUTED, letterSpacing: "2px", textTransform: "uppercase" as const, marginBottom: "6px" }}>
                    ALPHA STREAM · paste.markets
                  </div>
                  <div style={{ display: "flex", fontSize: "34px", fontWeight: 700, color: TEXT }}>
                    Quality-filtered signals
                  </div>
                  <div style={{ display: "flex", fontSize: "15px", color: MUTED, marginTop: "6px" }}>
                    EV-sorted · Validated track records only
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                  {trades.map((t) => (
                    <div key={`${t.handle}-${t.ticker}`} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 20px", backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "72px" }}>
                        <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: evCol(t.evScore) }}>+{t.evScore.toFixed(1)}</div>
                        <div style={{ display: "flex", fontSize: "9px", color: MUTED, letterSpacing: "1px" }}>EV</div>
                      </div>
                      <div style={{ display: "flex", width: "1px", height: "32px", backgroundColor: BORDER }} />
                      <div style={{ display: "flex", flex: 1, fontSize: "16px", color: MUTED }}>@{t.handle}</div>
                      <div style={{ display: "flex", fontSize: "22px", fontWeight: 700, color: TEXT }}>${t.ticker}</div>
                      <div style={{ display: "flex", fontSize: "14px", fontWeight: 700, color: dColor(t.direction), border: `1px solid ${dColor(t.direction)}`, borderRadius: "4px", padding: "3px 8px", textTransform: "uppercase" as const }}>{t.direction}</div>
                      <div style={{ display: "flex", fontSize: "15px", fontWeight: 700, color: t.winRate >= 65 ? AMBER : t.winRate >= 55 ? ACCENT : MUTED }}>{Math.round(t.winRate)}% WR</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", marginTop: "auto", fontSize: "12px", color: MUTED }}>
                  paste.markets/alpha · Powered by paste.trade
                </div>
              </div>
            ),
            imageOptions,
          );
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      case "consensus": {
        try {
          const res = await fetch(`${baseUrl()}/api/consensus`);
          if (!res.ok) throw new Error(`Consensus fetch failed: ${res.status}`);
          const data = await res.json();
          const plays: Array<{
            ticker: string;
            direction: string;
            callerCount: number;
            avgWinRate: number;
            currentPnl: number | null;
          }> = (data.plays ?? []).slice(0, 3);

          const dirColor = (d: string) =>
            d === "long" || d === "yes" ? GREEN : RED;

          return new ImageResponse(
            (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: `${WIDTH}px`,
                  height: `${HEIGHT}px`,
                  backgroundColor: BG,
                  fontFamily: "JetBrains Mono",
                  padding: "48px 60px",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", flexDirection: "column", marginBottom: "32px" }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "13px",
                      color: MUTED,
                      letterSpacing: "2px",
                      textTransform: "uppercase" as const,
                      marginBottom: "8px",
                    }}
                  >
                    CONSENSUS PLAYS
                  </div>
                  <div style={{ display: "flex", fontSize: "36px", fontWeight: 700, color: TEXT }}>
                    paste.markets
                  </div>
                  <div style={{ display: "flex", fontSize: "16px", color: MUTED, marginTop: "8px" }}>
                    When 3+ top callers agree on the same trade
                  </div>
                </div>

                {/* Play cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
                  {plays.map((play, i) => (
                    <div
                      key={`${play.ticker}-${play.direction}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                        padding: "20px 24px",
                        backgroundColor: SURFACE,
                        border: `1px solid ${BORDER}`,
                        borderRadius: "10px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          width: "32px",
                          fontSize: "20px",
                          fontWeight: 700,
                          color: i === 0 ? AMBER : MUTED,
                        }}
                      >
                        #{i + 1}
                      </div>
                      <div style={{ display: "flex", fontSize: "26px", fontWeight: 700, color: TEXT, flex: 1 }}>
                        ${play.ticker}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          fontSize: "16px",
                          fontWeight: 700,
                          color: dirColor(play.direction),
                          border: `1px solid ${dirColor(play.direction)}`,
                          borderRadius: "6px",
                          padding: "4px 10px",
                          textTransform: "uppercase" as const,
                        }}
                      >
                        {play.direction}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          fontSize: "16px",
                          color: AMBER,
                          border: `1px solid ${AMBER}`,
                          borderRadius: "6px",
                          padding: "4px 10px",
                        }}
                      >
                        {play.callerCount} callers
                      </div>
                      <div style={{ display: "flex", fontSize: "18px", fontWeight: 700, color: TEXT }}>
                        {play.avgWinRate.toFixed(0)}% WR
                      </div>
                      {play.currentPnl != null && (
                        <div
                          style={{
                            display: "flex",
                            fontSize: "18px",
                            fontWeight: 700,
                            color: play.currentPnl >= 0 ? GREEN : RED,
                          }}
                        >
                          {play.currentPnl >= 0 ? "+" : ""}{play.currentPnl.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  ))}

                  {plays.length === 0 && (
                    <div style={{ display: "flex", fontSize: "18px", color: MUTED }}>
                      No consensus plays yet — check back soon.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", marginTop: "auto", fontSize: "12px", color: MUTED }}>
                  paste.markets/consensus · Powered by paste.trade
                </div>
              </div>
            ),
            imageOptions,
          );
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      case "feed": {
        try {
          const res = await fetch(`${baseUrl()}/api/feed`);
          if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
          const data = await res.json();

          interface FeedTrade {
            handle: string;
            winRate: number;
            ticker: string;
            direction: string;
            pnlPct: number | null;
          }

          const trades: FeedTrade[] = (data.trades ?? []).slice(0, 5);

          return new ImageResponse(
            (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: `${WIDTH}px`,
                  height: `${HEIGHT}px`,
                  backgroundColor: BG,
                  fontFamily: "JetBrains Mono",
                  padding: "48px 60px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", marginBottom: "32px" }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "13px",
                      color: MUTED,
                      letterSpacing: "2px",
                      textTransform: "uppercase" as const,
                      marginBottom: "8px",
                    }}
                  >
                    LIVE FEED
                  </div>
                  <div style={{ display: "flex", fontSize: "40px", fontWeight: 700, color: TEXT }}>
                    paste.markets
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    padding: "8px 16px",
                    fontSize: "11px",
                    color: MUTED,
                    letterSpacing: "1px",
                    textTransform: "uppercase" as const,
                  }}
                >
                  <div style={{ display: "flex", width: "160px" }}>TICKER</div>
                  <div style={{ display: "flex", flex: 1 }}>CALLER</div>
                  <div style={{ display: "flex", width: "120px", justifyContent: "flex-end" }}>P&amp;L</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {trades.map((t: FeedTrade, i: number) => {
                    const dirColor = t.direction === "long" || t.direction === "yes" ? GREEN : RED;
                    const pnlStr =
                      t.pnlPct == null
                        ? "OPEN"
                        : `${t.pnlPct >= 0 ? "+" : ""}${t.pnlPct.toFixed(1)}%`;
                    const pnlCol = t.pnlPct == null ? MUTED : t.pnlPct >= 0 ? GREEN : RED;

                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "12px 16px",
                          backgroundColor: SURFACE,
                          border: `1px solid ${BORDER}`,
                          borderRadius: "8px",
                        }}
                      >
                        <div style={{ display: "flex", width: "160px", gap: "10px", alignItems: "center" }}>
                          <div style={{ display: "flex", fontSize: "18px", fontWeight: 700, color: TEXT }}>
                            {t.ticker}
                          </div>
                          <div style={{ display: "flex", fontSize: "13px", fontWeight: 700, color: dirColor }}>
                            {t.direction.toUpperCase()}
                          </div>
                        </div>
                        <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
                          <div style={{ display: "flex", fontSize: "14px", color: TEXT }}>
                            @{t.handle}
                          </div>
                          <div style={{ display: "flex", fontSize: "12px", color: MUTED }}>
                            {Math.round(t.winRate)}% WR
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            width: "120px",
                            justifyContent: "flex-end",
                            fontSize: "18px",
                            fontWeight: 700,
                            color: pnlCol,
                          }}
                        >
                          {pnlStr}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", marginTop: "auto", fontSize: "12px", color: MUTED }}>
                  paste.markets/feed · Real-time calls from top CT callers
                </div>
              </div>
            ),
            imageOptions,
          );
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      case "wrapped": {
        const handle = rest[0];
        if (!handle) {
          return new ImageResponse(homeImage(), imageOptions);
        }
        // Support ?slide=N for per-slide OG images
        const slideParam = request.nextUrl.searchParams.get("slide");
        const slideNum = slideParam ? parseInt(slideParam, 10) : undefined;
        try {
          const res = await fetch(`${baseUrl()}/api/wrapped/${encodeURIComponent(handle)}`);
          if (!res.ok) throw new Error(`Wrapped fetch failed: ${res.status}`);
          const data = await res.json();
          const wrappedData: WrappedData = {
            handle: data.handle ?? handle,
            personality: data.personality ?? { label: "The Trader", description: "A market participant." },
            grades: { overall: data.grades?.overall ?? "C" },
            highlights: {
              winRate: data.highlights?.winRate ?? 0,
              totalTrades: data.highlights?.totalTrades ?? 0,
              avgPnl: data.highlights?.avgPnl ?? 0,
              biggestWin: data.highlights?.biggestWin ?? { ticker: "N/A", pnl: 0 },
              favoriteTicker: data.highlights?.favoriteTicker,
            },
          };
          return new ImageResponse(wrappedImage(wrappedData, slideNum), imageOptions);
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      case "fade": {
        const handle = rest[0];
        if (!handle) {
          return new ImageResponse(homeImage(), imageOptions);
        }
        try {
          const res = await fetch(
            `${baseUrl()}/api/fade/${encodeURIComponent(handle)}`
          );
          if (!res.ok) throw new Error(`Fade fetch failed: ${res.status}`);
          const data = await res.json();
          const fs = data.fadeStats;

          const ratingColor =
            fs.fadeRating === "S" ? AMBER
            : fs.fadeRating === "A" ? GREEN
            : fs.fadeRating === "B" ? ACCENT
            : MUTED;

          return new ImageResponse(
            (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: `${WIDTH}px`,
                  height: `${HEIGHT}px`,
                  backgroundColor: BG,
                  fontFamily: "JetBrains Mono",
                  padding: "48px 60px",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", fontSize: "13px", color: RED, letterSpacing: "2px", marginBottom: "8px" }}>
                      FADE ANALYSIS
                    </div>
                    <div style={{ display: "flex", fontSize: "42px", fontWeight: 700, color: TEXT }}>
                      Fade @{handle}
                    </div>
                    <div style={{ display: "flex", fontSize: "16px", color: MUTED, marginTop: "8px" }}>
                      {fs.isProfitableFade ? "PROFITABLE FADE — trade the opposite for alpha" : "Fade analysis for this caller"}
                    </div>
                  </div>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 20px",
                    border: `2px solid ${ratingColor}`,
                    borderRadius: "12px",
                  }}>
                    <div style={{ display: "flex", fontSize: "11px", color: MUTED, letterSpacing: "1px", marginBottom: "4px" }}>
                      FADE RATING
                    </div>
                    <div style={{ display: "flex", fontSize: "40px", fontWeight: 700, color: ratingColor }}>
                      {fs.fadeRating}
                    </div>
                  </div>
                </div>

                {/* Side-by-side comparison */}
                <div style={{ display: "flex", gap: "24px", flex: 1 }}>
                  {/* FOLLOW column */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: "24px",
                    backgroundColor: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: "12px",
                  }}>
                    <div style={{ display: "flex", fontSize: "12px", color: MUTED, letterSpacing: "2px", marginBottom: "20px" }}>
                      FOLLOW @{handle.toUpperCase()}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", fontSize: "15px", color: MUTED }}>Win Rate</div>
                        <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: fs.originalWinRate >= 50 ? GREEN : RED }}>
                          {Math.round(fs.originalWinRate)}%
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", fontSize: "15px", color: MUTED }}>Avg P&amp;L</div>
                        <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: fs.originalAvgPnl >= 0 ? GREEN : RED }}>
                          {formatPnl(fs.originalAvgPnl)}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", fontSize: "15px", color: MUTED }}>Total P&amp;L</div>
                        <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: fs.originalTotalPnl >= 0 ? GREEN : RED }}>
                          {formatPnl(fs.originalTotalPnl)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FADE column */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: "24px",
                    backgroundColor: SURFACE,
                    border: `2px solid ${RED}44`,
                    borderRadius: "12px",
                  }}>
                    <div style={{ display: "flex", fontSize: "12px", color: RED, letterSpacing: "2px", marginBottom: "20px" }}>
                      FADE @{handle.toUpperCase()}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", fontSize: "15px", color: MUTED }}>Win Rate</div>
                        <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: fs.fadeWinRate >= 50 ? GREEN : RED }}>
                          {Math.round(fs.fadeWinRate)}%
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", fontSize: "15px", color: MUTED }}>Avg P&amp;L</div>
                        <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: fs.fadeAvgPnl >= 0 ? GREEN : RED }}>
                          {formatPnl(fs.fadeAvgPnl)}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", fontSize: "15px", color: MUTED }}>Total P&amp;L</div>
                        <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: fs.fadeTotalPnl >= 0 ? GREEN : RED }}>
                          {formatPnl(fs.fadeTotalPnl)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px", fontSize: "12px", color: MUTED }}>
                  <div style={{ display: "flex" }}>paste.markets/fade/{handle}</div>
                  <div style={{ display: "flex" }}>
                    {fs.totalTrades} trades · Powered by paste.trade
                  </div>
                </div>
              </div>
            ),
            imageOptions,
          );
        } catch {
          return new ImageResponse(homeImage(), imageOptions);
        }
      }

      default: {
        return new ImageResponse(homeImage(), imageOptions);
      }
    }
  } catch {
    // Ultimate fallback
    return new ImageResponse(homeImage(), {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: CACHE_HEADERS,
    });
  }
}
