import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

const BG = "#0a0a1a";
const SURFACE = "#0f0f22";
const BORDER = "#1a1a2e";
const TEXT = "#f0f0f0";
const MUTED = "#555568";
const GREEN = "#2ecc71";
const RED = "#e74c3c";
const AMBER = "#f39c12";
const ACCENT = "#3b82f6";

async function loadFont(): Promise<ArrayBuffer> {
  const res = await fetch(new URL("/fonts/JetBrainsMono-Regular.ttf", baseUrl()));
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const today = new Date().toISOString().slice(0, 10);
  const date = searchParams.get("date") ?? today;

  let recap: {
    total_trades: number;
    total_callers_active: number;
    most_called_ticker: { ticker: string; count: number } | null;
    biggest_win: { handle: string; ticker: string; pnl: number } | null;
    hot_streak: { handle: string; streak: number } | null;
  } = {
    total_trades: 0,
    total_callers_active: 0,
    most_called_ticker: null,
    biggest_win: null,
    hot_streak: null,
  };

  try {
    const res = await fetch(`${baseUrl()}/api/recap?date=${date}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      recap = await res.json();
    }
  } catch {
    // Use defaults
  }

  const fontData = await loadFont();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: WIDTH,
          height: HEIGHT,
          backgroundColor: BG,
          fontFamily: "JetBrains Mono",
          padding: "48px 56px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                color: MUTED,
                fontSize: "14px",
                textTransform: "uppercase",
                letterSpacing: "3px",
                marginBottom: "8px",
              }}
            >
              Today on paste.markets
            </div>
            <div
              style={{
                color: TEXT,
                fontSize: "36px",
                fontWeight: 700,
                letterSpacing: "-0.5px",
              }}
            >
              {formatDateHeader(date)}
            </div>
          </div>
          <div
            style={{
              color: ACCENT,
              fontSize: "14px",
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              padding: "8px 16px",
              borderRadius: "6px",
            }}
          >
            paste.markets/today
          </div>
        </div>

        {/* Hero stat */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <div style={{ color: TEXT, fontSize: "80px", fontWeight: 700 }}>
            {recap.total_trades}
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: "20px",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            calls today
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            flex: 1,
          }}
        >
          {/* Most called */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <div
              style={{
                color: MUTED,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              Most Called
            </div>
            <div style={{ color: ACCENT, fontSize: "28px", fontWeight: 700 }}>
              {recap.most_called_ticker
                ? `$${recap.most_called_ticker.ticker}`
                : "--"}
            </div>
            <div style={{ color: MUTED, fontSize: "14px", marginTop: "4px" }}>
              {recap.most_called_ticker
                ? `${recap.most_called_ticker.count} calls`
                : ""}
            </div>
          </div>

          {/* Biggest win */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <div
              style={{
                color: MUTED,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              Biggest Win
            </div>
            <div style={{ color: GREEN, fontSize: "28px", fontWeight: 700 }}>
              {recap.biggest_win ? formatPnl(recap.biggest_win.pnl) : "--"}
            </div>
            <div style={{ color: MUTED, fontSize: "14px", marginTop: "4px" }}>
              {recap.biggest_win
                ? `@${recap.biggest_win.handle} on $${recap.biggest_win.ticker}`
                : ""}
            </div>
          </div>

          {/* Hot streak */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <div
              style={{
                color: MUTED,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              Hot Streak
            </div>
            <div style={{ color: AMBER, fontSize: "28px", fontWeight: 700 }}>
              {recap.hot_streak ? `${recap.hot_streak.streak} wins` : "--"}
            </div>
            <div style={{ color: MUTED, fontSize: "14px", marginTop: "4px" }}>
              {recap.hot_streak ? `@${recap.hot_streak.handle}` : ""}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ color: MUTED, fontSize: "12px" }}>
            {recap.total_callers_active} active callers
          </div>
          <div style={{ color: MUTED, fontSize: "12px" }}>
            paste.markets
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        {
          name: "JetBrains Mono",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
      headers: {
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
      },
    },
  );
}
