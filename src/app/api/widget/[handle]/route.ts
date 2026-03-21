import { NextRequest, NextResponse } from "next/server";
import {
  syncAuthor,
  isStale,
  getOrCreateAuthor,
  getAuthorMetrics,
} from "@/lib/data";

export const dynamic = "force-dynamic";

// Design tokens (Bloomberg dark theme)
const BG = "#0a0a1a";
const SURFACE = "#0f0f22";
const BORDER = "#1a1a2e";
const TEXT = "#f0f0f0";
const MUTED = "#555568";
const GREEN = "#2ecc71";
const RED = "#e74c3c";
const ACCENT = "#3b82f6";

const FONT = "'JetBrains Mono', 'Courier New', monospace";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

function fmtStreak(streak: number): string {
  if (streak === 0) return "--";
  return streak > 0 ? `W${streak}` : `L${Math.abs(streak)}`;
}

function streakColor(streak: number): string {
  if (streak === 0) return MUTED;
  return streak > 0 ? GREEN : RED;
}

// ---------------------------------------------------------------------------
// Full widget — 400 × 180
// ---------------------------------------------------------------------------
function buildFullSvg(
  handle: string,
  winRate: number,
  avgPnl: number,
  totalTrades: number,
  streak: number,
  rank: number | null,
): string {
  const W = 400;
  const H = 180;

  // Win rate blocks (10 blocks, 26px wide, 12px tall, 3px gap)
  const BLOCK_W = 26;
  const BLOCK_H = 12;
  const BLOCK_GAP = 3;
  const BLOCKS = 10;
  const filled = Math.round(winRate / 10);
  const blocksStartX = 16;
  const blocksY = 68;

  const blockRects = Array.from({ length: BLOCKS }, (_, i) => {
    const x = blocksStartX + i * (BLOCK_W + BLOCK_GAP);
    const fill = i < filled ? GREEN : BORDER;
    return `<rect x="${x}" y="${blocksY}" width="${BLOCK_W}" height="${BLOCK_H}" rx="1" fill="${fill}"/>`;
  }).join("\n    ");

  const rankBadge =
    rank != null
      ? `<rect x="${W - 76}" y="12" width="60" height="18" rx="3" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="1"/>
    <text x="${W - 46}" y="25" font-family="${FONT}" font-size="10" fill="${ACCENT}" text-anchor="middle" font-weight="700">RANK #${rank}</text>`
      : "";

  const pnlColor = avgPnl >= 0 ? GREEN : RED;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trade scorecard for @${esc(handle)}">
  <title>@${esc(handle)} scorecard · paste.markets</title>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="8" fill="${BG}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="7.5" fill="none" stroke="${BORDER}" stroke-width="1"/>

  <!-- Header -->
  <text x="16" y="25" font-family="${FONT}" font-size="10" fill="${MUTED}" letter-spacing="1.5">paste.markets</text>
  <text x="${rank != null ? W - 88 : W - 16}" y="25" font-family="${FONT}" font-size="14" fill="${TEXT}" text-anchor="end" font-weight="700">@${esc(handle)}</text>
  ${rankBadge}

  <!-- Divider -->
  <line x1="16" y1="36" x2="${W - 16}" y2="36" stroke="${BORDER}" stroke-width="1"/>

  <!-- Win Rate label + value -->
  <text x="16" y="56" font-family="${FONT}" font-size="9" fill="${MUTED}" letter-spacing="1.5">WIN RATE</text>
  <text x="${W - 16}" y="56" font-family="${FONT}" font-size="16" fill="${GREEN}" text-anchor="end" font-weight="700">${Math.round(winRate)}%</text>

  <!-- Win rate blocks -->
  ${blockRects}

  <!-- Divider -->
  <line x1="16" y1="96" x2="${W - 16}" y2="96" stroke="${BORDER}" stroke-width="1"/>

  <!-- Stats labels -->
  <text x="16" y="115" font-family="${FONT}" font-size="9" fill="${MUTED}" letter-spacing="1.5">AVG P&amp;L</text>
  <text x="160" y="115" font-family="${FONT}" font-size="9" fill="${MUTED}" letter-spacing="1.5">TRADES</text>
  <text x="290" y="115" font-family="${FONT}" font-size="9" fill="${MUTED}" letter-spacing="1.5">STREAK</text>

  <!-- Stats values -->
  <text x="16" y="140" font-family="${FONT}" font-size="20" fill="${pnlColor}" font-weight="700">${esc(fmtPnl(avgPnl))}</text>
  <text x="160" y="140" font-family="${FONT}" font-size="20" fill="${TEXT}" font-weight="700">${totalTrades}</text>
  <text x="290" y="140" font-family="${FONT}" font-size="20" fill="${streakColor(streak)}" font-weight="700">${esc(fmtStreak(streak))}</text>

  <!-- Footer -->
  <line x1="16" y1="152" x2="${W - 16}" y2="152" stroke="${BORDER}" stroke-width="1"/>
  <text x="16" y="168" font-family="${FONT}" font-size="9" fill="${MUTED}" letter-spacing="0.5">Updated hourly</text>
  <text x="${W - 16}" y="168" font-family="${FONT}" font-size="9" fill="${MUTED}" text-anchor="end" letter-spacing="0.5">paste.markets</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Badge — 320 × 28 (shields.io style)
// ---------------------------------------------------------------------------
function buildBadgeSvg(
  handle: string,
  winRate: number,
  avgPnl: number,
): string {
  const W = 320;
  const H = 28;
  const LABEL_W = 100;
  const pnlColor = avgPnl >= 0 ? GREEN : RED;
  const label = "paste.markets";
  // value used in aria-label via inline interpolation below

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trade scorecard for @${esc(handle)}">
  <title>@${esc(handle)} · ${Math.round(winRate)}% WR · ${esc(fmtPnl(avgPnl))} · paste.markets</title>

  <!-- Clip path for rounded corners -->
  <defs>
    <clipPath id="r">
      <rect width="${W}" height="${H}" rx="4"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="4" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>

  <!-- Label section background -->
  <rect x="1" y="1" width="${LABEL_W - 1}" height="${H - 2}" rx="3" fill="${SURFACE}" clip-path="url(#r)"/>

  <!-- Label text -->
  <text x="${LABEL_W / 2}" y="18" font-family="${FONT}" font-size="10" fill="${MUTED}" text-anchor="middle" letter-spacing="0.5">${esc(label)}</text>

  <!-- Divider -->
  <line x1="${LABEL_W}" y1="4" x2="${LABEL_W}" y2="${H - 4}" stroke="${BORDER}" stroke-width="1"/>

  <!-- Value: handle -->
  <text x="${LABEL_W + 10}" y="18" font-family="${FONT}" font-size="11" fill="${TEXT}" font-weight="700">@${esc(handle)}</text>

  <!-- Separator dots -->
  <text x="${LABEL_W + 10 + handle.length * 7 + 4}" y="18" font-family="${FONT}" font-size="11" fill="${MUTED}">·</text>

  <!-- Win rate -->
  <text x="${LABEL_W + 10 + handle.length * 7 + 14}" y="18" font-family="${FONT}" font-size="11" fill="${GREEN}" font-weight="700">${Math.round(winRate)}% WR</text>

  <!-- Separator dot 2 -->
  <text x="${LABEL_W + 10 + handle.length * 7 + 14 + 52}" y="18" font-family="${FONT}" font-size="11" fill="${MUTED}">·</text>

  <!-- P&L -->
  <text x="${LABEL_W + 10 + handle.length * 7 + 14 + 62}" y="18" font-family="${FONT}" font-size="11" fill="${pnlColor}" font-weight="700">${esc(fmtPnl(avgPnl))}</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Error SVG
// ---------------------------------------------------------------------------
function buildErrorSvg(message: string, style: string): string {
  const W = style === "badge" ? 320 : 400;
  const H = style === "badge" ? 28 : 180;
  const cy = style === "badge" ? 18 : H / 2 + 5;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="${style === "badge" ? 4 : 8}" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  <text x="${W / 2}" y="${cy}" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">${esc(message)}</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();
  const { searchParams } = new URL(request.url);
  const style = searchParams.get("style") ?? "full";

  const headers = {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=3600, s-maxage=3600",
  };

  if (!handle) {
    return new NextResponse(buildErrorSvg("Missing handle", style), {
      status: 400,
      headers,
    });
  }

  try {
    const author = await getOrCreateAuthor(handle);

    if (isStale(author.last_fetched)) {
      try {
        await syncAuthor(handle);
      } catch {
        // Continue with cached data
      }
    }

    const metrics = await getAuthorMetrics(handle);
    if (!metrics) {
      return new NextResponse(buildErrorSvg(`@${handle} not found`, style), {
        status: 404,
        headers,
      });
    }

    const refreshed = await getOrCreateAuthor(handle);
    const rank = refreshed.rank ?? null;

    let svg: string;
    if (style === "badge") {
      svg = buildBadgeSvg(handle, metrics.winRate, metrics.avgPnl);
    } else {
      svg = buildFullSvg(
        handle,
        metrics.winRate,
        metrics.avgPnl,
        metrics.totalTrades,
        metrics.streak,
        rank,
      );
    }

    return new NextResponse(svg, { status: 200, headers });
  } catch (err) {
    console.error("[api/widget] Error:", err);
    return new NextResponse(buildErrorSvg("Error loading data", style), {
      status: 500,
      headers,
    });
  }
}
