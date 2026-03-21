import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { getCachedBacktestReport } from "@/lib/backtest-db";
import type { BacktestReport } from "@/lib/backtest-processor";

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

async function loadFont(): Promise<ArrayBuffer> {
  return await fetch(
    "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff",
  ).then((res) => res.arrayBuffer());
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "S": return AMBER;
    case "A": return GREEN;
    case "B": return "#3b82f6";
    case "D":
    case "F": return RED;
    default: return MUTED;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const normalized = handle.toLowerCase().replace(/^@/, "");

  let report: BacktestReport | null = null;
  try {
    const job = getCachedBacktestReport(normalized);
    if (job?.result_json) {
      report = JSON.parse(job.result_json) as BacktestReport;
    }
  } catch {
    // render fallback
  }

  const fontData = await loadFont();

  const element = report ? (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        backgroundColor: BG,
        fontFamily: "JetBrains Mono",
        padding: "50px 60px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "40px", fontWeight: 700, color: TEXT }}>
            @{report.handle}
          </div>
          <div style={{ display: "flex", fontSize: "16px", color: MUTED, marginTop: "8px" }}>
            {report.gradeLabel}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            border: `2px solid ${gradeColor(report.grade)}`,
            borderRadius: "12px",
            padding: "12px 24px",
          }}
        >
          <div style={{ display: "flex", fontSize: "14px", color: gradeColor(report.grade), fontWeight: 700 }}>
            GRADE
          </div>
          <div style={{ display: "flex", fontSize: "56px", fontWeight: 700, color: gradeColor(report.grade) }}>
            {report.grade}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: "40px",
          marginTop: "40px",
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: "12px",
          padding: "24px 32px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "13px", color: MUTED }}>Win Rate</div>
          <div
            style={{
              display: "flex",
              fontSize: "32px",
              fontWeight: 700,
              color: report.follow.winRate >= 50 ? GREEN : RED,
            }}
          >
            {report.follow.winRate.toFixed(0)}%
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "13px", color: MUTED }}>Calls</div>
          <div style={{ display: "flex", fontSize: "32px", fontWeight: 700, color: TEXT }}>
            {report.follow.totalCalls}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "13px", color: MUTED }}>Avg P&L</div>
          <div
            style={{
              display: "flex",
              fontSize: "32px",
              fontWeight: 700,
              color: report.follow.avgPnlPercent >= 0 ? GREEN : RED,
            }}
          >
            {report.follow.avgPnlPercent >= 0 ? "+" : ""}
            {report.follow.avgPnlPercent.toFixed(1)}%
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "13px", color: MUTED }}>Total P&L</div>
          <div
            style={{
              display: "flex",
              fontSize: "32px",
              fontWeight: 700,
              color: report.follow.cumulativePnl >= 0 ? GREEN : RED,
            }}
          >
            {report.follow.cumulativePnl >= 0 ? "+" : ""}
            {report.follow.cumulativePnl.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Jim Cramer badge */}
      {report.jimCramerScore && (
        <div
          style={{
            display: "flex",
            marginTop: "20px",
            backgroundColor: "rgba(231,76,60,0.1)",
            border: "1px solid rgba(231,76,60,0.3)",
            borderRadius: "8px",
            padding: "12px 20px",
            fontSize: "16px",
            color: RED,
            fontWeight: 700,
          }}
        >
          JIM CRAMER ALERT — Fading beats following!
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "auto",
          fontSize: "14px",
          color: MUTED,
        }}
      >
        <div style={{ display: "flex" }}>paste.markets/backtest/{report.handle}</div>
        <div style={{ display: "flex" }}>
          {report.tweetsCovered} tweets scanned
        </div>
      </div>
    </div>
  ) : (
    // Fallback when no cached report
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
      <div style={{ display: "flex", fontSize: "48px", fontWeight: 700, color: TEXT, marginBottom: "16px" }}>
        Backtest @{normalized}
      </div>
      <div style={{ display: "flex", fontSize: "20px", color: MUTED, marginBottom: "40px" }}>
        Full history scan — every call tracked, no cherry-picking
      </div>
      <div style={{ display: "flex", fontSize: "14px", color: MUTED }}>
        paste.markets
      </div>
    </div>
  );

  return new ImageResponse(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      {
        name: "JetBrains Mono",
        data: fontData,
        style: "normal",
        weight: 700,
      },
    ],
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
