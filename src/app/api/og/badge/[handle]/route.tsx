import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BG = "#0a0a1a";
const SURFACE = "#0f0f22";
const TEXT = "#f0f0f0";
const MUTED = "#555568";
const GREEN = "#2ecc71";
const RED = "#e74c3c";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

async function loadFont(): Promise<ArrayBuffer> {
  return fetch(
    "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff",
  ).then((res) => res.arrayBuffer());
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  let winRate = 0;
  let avgPnl = 0;
  let totalTrades = 0;

  try {
    const res = await fetch(`${baseUrl()}/api/caller/${encodeURIComponent(handle)}`);
    if (res.ok) {
      const data = await res.json();
      winRate = data.stats?.winRate ?? 0;
      avgPnl = data.stats?.avgPnlPercent ?? 0;
      totalTrades = data.stats?.totalCalls ?? 0;
    }
  } catch {
    // render with zeros
  }

  const fontData = await loadFont();
  const pnlColor = avgPnl >= 0 ? GREEN : RED;
  const wrColor = winRate >= 50 ? GREEN : RED;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: BG,
          padding: "16px 24px",
          fontFamily: "JetBrains Mono",
          color: TEXT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 4,
              background: SURFACE,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {handle.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>@{handle}</span>
            <span style={{ fontSize: 12, color: MUTED }}>paste.markets</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Win Rate</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: wrColor }}>{Math.round(winRate)}%</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Avg P&L</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: pnlColor }}>{formatPnl(avgPnl)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Trades</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{totalTrades}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 500,
      height: 100,
      fonts: [{ name: "JetBrains Mono", data: fontData, style: "normal", weight: 400 }],
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
