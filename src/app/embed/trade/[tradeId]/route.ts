import { NextRequest, NextResponse } from "next/server";
import { getTradeById } from "@/lib/paste-trade";

export const runtime = "nodejs";

function fmtPrice(p: number): string {
  if (p >= 10000) return "$" + Math.round(p).toLocaleString("en-US");
  if (p >= 1000) return "$" + p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return "$" + p.toFixed(2);
  return "$" + p.toFixed(6);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const { tradeId } = await params;
  const trade = await getTradeById(tradeId).catch(() => null);

  const ticker = trade?.ticker ?? "???";
  const direction = trade?.direction ?? "long";
  const pnlPct = trade?.pnlPct ?? null;
  const handle = trade?.author_handle ?? "unknown";
  const entryPrice = trade?.entryPrice ?? null;
  const currentPrice = trade?.currentPrice ?? null;
  const platform = trade?.platform ?? null;

  const isUp = direction === "long" || direction === "yes";
  const pnlStr = pnlPct != null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%` : "Tracking";
  const pnlColor = pnlPct != null ? (pnlPct >= 0 ? "#2ecc71" : "#e74c3c") : "#555568";
  const dirColor = isUp ? "#2ecc71" : "#e74c3c";

  const priceHtml =
    entryPrice != null
      ? `<span>${fmtPrice(entryPrice)}</span>` +
        (currentPrice != null
          ? ` <span style="color:#555568">→</span> <span>${fmtPrice(currentPrice)}</span>`
          : "")
      : "";

  const metaLabel = [
    platform ? platform.toUpperCase() : null,
    priceHtml ? "Entry " + priceHtml : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tradePageUrl = `https://paste.markets/trade/${tradeId}?author=${encodeURIComponent(handle)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$${ticker} ${direction.toUpperCase()} · paste.markets</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 400px;
      height: 200px;
      overflow: hidden;
      background: #0a0a1a;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      color: #f0f0f0;
    }
    .card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 200px;
      padding: 20px 24px;
      gap: 16px;
      border-left: 4px solid ${pnlColor};
    }
    .left { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
    .ticker { font-size: 22px; font-weight: 700; color: #f0f0f0; }
    .dir-row { display: flex; align-items: center; gap: 8px; }
    .dir {
      font-size: 11px; font-weight: 700; padding: 2px 8px;
      border-radius: 4px; border: 1px solid ${dirColor};
      color: ${dirColor}; text-transform: uppercase;
    }
    .caller { font-size: 12px; color: #555568; }
    .meta { font-size: 11px; color: #555568; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
    .pnl { font-size: 30px; font-weight: 700; color: ${pnlColor}; white-space: nowrap; }
    .brand {
      font-size: 10px; color: #555568; text-decoration: none;
      letter-spacing: 1px; text-transform: uppercase;
    }
    .brand:hover { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="left">
      <div class="ticker">$${ticker}</div>
      <div class="dir-row">
        <span class="dir">${direction.toUpperCase()}</span>
        <span class="caller">@${handle}</span>
      </div>
      ${metaLabel ? `<div class="meta">${metaLabel}</div>` : ""}
    </div>
    <div class="right">
      <div class="pnl">${pnlStr}</div>
      <a href="${tradePageUrl}" target="_blank" rel="noopener noreferrer" class="brand">
        paste.markets
      </a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });
}
