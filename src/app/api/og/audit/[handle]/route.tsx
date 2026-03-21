import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { getLatestAudit, type CompletenessGrade } from "@/lib/completeness";

export const runtime = "nodejs";

const BG = "#0a0a1a";
const SURFACE = "#0f0f22";
const BORDER = "#1a1a2e";
const TEXT = "#f0f0f0";
const MUTED = "#555568";

const GRADE_COLORS: Record<CompletenessGrade, string> = {
  VERIFIED: "#2ecc71",
  MOSTLY_COMPLETE: "#3b82f6",
  PARTIAL: "#f39c12",
  CHERRY_PICKED: "#e74c3c",
  UNKNOWN: "#555568",
};

const GRADE_LABELS: Record<CompletenessGrade, string> = {
  VERIFIED: "VERIFIED",
  MOSTLY_COMPLETE: "MOSTLY COMPLETE",
  PARTIAL: "PARTIAL",
  CHERRY_PICKED: "CHERRY PICKED",
  UNKNOWN: "UNKNOWN",
};

async function loadFont(): Promise<ArrayBuffer> {
  return fetch(
    "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff",
  ).then((res) => res.arrayBuffer());
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  let grade: CompletenessGrade = "UNKNOWN";
  let completenessPercent = 0;
  let matchedCalls = 0;
  let totalCalls = 0;
  let tradeRelated = 0;

  try {
    const audit = await getLatestAudit(handle);
    if (audit) {
      grade = audit.grade;
      completenessPercent = audit.completenessPercent;
      matchedCalls = audit.matchedCalls;
      totalCalls = audit.trackedCalls;
      tradeRelated = audit.tradeRelatedTweets;
    }
  } catch {
    // render with defaults
  }

  const fontData = await loadFont();
  const gradeColor = GRADE_COLORS[grade];
  const gradeLabel = GRADE_LABELS[grade];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: BG,
          fontFamily: "JetBrains Mono",
          color: TEXT,
          padding: "48px",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: 8,
                background: SURFACE,
                fontSize: 28,
                fontWeight: 700,
                border: `2px solid ${BORDER}`,
              }}
            >
              {handle.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 32, fontWeight: 700 }}>@{handle}</span>
              <span style={{ fontSize: 14, color: MUTED }}>
                Full History Audit Report
              </span>
            </div>
          </div>

          {/* Grade badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: `2px solid ${gradeColor}`,
              background: `${gradeColor}15`,
              padding: "8px 20px",
              fontSize: 18,
              fontWeight: 700,
              color: gradeColor,
              letterSpacing: 2,
            }}
          >
            {gradeLabel}
          </div>
        </div>

        {/* Main score */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 64,
          }}
        >
          {/* Completeness % */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 80,
                fontWeight: 700,
                color: gradeColor,
                lineHeight: 1,
              }}
            >
              {completenessPercent}%
            </span>
            <span
              style={{
                fontSize: 12,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              Completeness
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 2,
              height: 120,
              background: BORDER,
            }}
          />

          {/* Stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: MUTED, width: 120, textTransform: "uppercase", letterSpacing: 1 }}>
                Matched
              </span>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#2ecc71" }}>
                {matchedCalls}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: MUTED, width: 120, textTransform: "uppercase", letterSpacing: 1 }}>
                Tracked
              </span>
              <span style={{ fontSize: 24, fontWeight: 700 }}>
                {totalCalls}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: MUTED, width: 120, textTransform: "uppercase", letterSpacing: 1 }}>
                Trade Tweets
              </span>
              <span style={{ fontSize: 24, fontWeight: 700 }}>
                {tradeRelated}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${BORDER}`,
            paddingTop: 16,
          }}
        >
          <span style={{ fontSize: 14, color: MUTED }}>paste.markets</span>
          <span style={{ fontSize: 12, color: MUTED }}>Anti-Cherry-Pick Audit</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "JetBrains Mono", data: fontData, style: "normal", weight: 400 },
      ],
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
