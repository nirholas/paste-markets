import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface TickerTrade {
  id: string | null;
  ticker: string;
  direction: string;
  author_handle: string;
  pnlPct: number | null;
  entryPrice: number | null;
  postedAt: string;
  sourceUrl: string | null;
  thesis: string | null;
  headlineQuote: string | null;
  platform: string | null;
  instrument: string | null;
}

export interface TickerResponse {
  ticker: string;
  trades: TickerTrade[];
  total: number;
  updatedAt: string;
}

// Module-level cache per ticker: 5 minutes
const cache = new Map<string, { data: TickerResponse; expiresAt: number }>();

function emptyResponse(ticker: string): TickerResponse {
  return {
    ticker: ticker.toUpperCase(),
    trades: [],
    total: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function buildTickerData(ticker: string): Promise<TickerResponse> {
  const cached = cache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) return emptyResponse(ticker);

  const url = new URL("/api/search", "https://paste.trade");
  url.searchParams.set("ticker", ticker);
  url.searchParams.set("top", "all");
  url.searchParams.set("limit", "50");

  let rawItems: Record<string, unknown>[] = [];
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!res.ok) return emptyResponse(ticker);
    const body: unknown = await res.json();
    if (Array.isArray(body)) {
      rawItems = body as Record<string, unknown>[];
    } else if (body && typeof body === "object") {
      const obj = body as Record<string, unknown>;
      rawItems = (
        Array.isArray(obj["trades"]) ? obj["trades"] :
        Array.isArray(obj["data"]) ? obj["data"] :
        Array.isArray(obj["results"]) ? obj["results"] :
        Array.isArray(obj["items"]) ? obj["items"] : []
      ) as Record<string, unknown>[];
    }
  } catch {
    return emptyResponse(ticker);
  }

  const trades: TickerTrade[] = rawItems.map((raw) => {
    const dirRaw = String(raw["direction"] ?? "long");
    const direction = (["long", "short", "yes", "no"].includes(dirRaw) ? dirRaw : "long");

    const pnlPct =
      raw["pnl_pct"] != null ? Number(raw["pnl_pct"]) :
      raw["pnlPct"] != null ? Number(raw["pnlPct"]) :
      raw["pnl"] != null ? Number(raw["pnl"]) : null;

    const entryPrice =
      raw["author_price"] != null ? Number(raw["author_price"]) :
      raw["entry_price"] != null ? Number(raw["entry_price"]) :
      raw["entryPrice"] != null ? Number(raw["entryPrice"]) : null;

    return {
      id: raw["id"] != null ? String(raw["id"]) : null,
      ticker: String(raw["ticker"] ?? ticker),
      direction,
      author_handle: String(raw["author_handle"] ?? raw["handle"] ?? "unknown"),
      pnlPct: pnlPct != null && !isNaN(pnlPct) ? pnlPct : null,
      entryPrice: entryPrice != null && !isNaN(entryPrice) ? entryPrice : null,
      postedAt: String(raw["posted_at"] ?? raw["author_date"] ?? new Date().toISOString()),
      sourceUrl: raw["source_url"] != null ? String(raw["source_url"]) : null,
      thesis: raw["thesis"] != null ? String(raw["thesis"]) : null,
      headlineQuote: raw["headline_quote"] != null ? String(raw["headline_quote"]) : null,
      platform: raw["platform"] != null ? String(raw["platform"]) : null,
      instrument: raw["instrument"] != null ? String(raw["instrument"]) : null,
    };
  }).filter((t) => t.author_handle !== "unknown");

  // Sort by pnlPct descending (nulls last)
  trades.sort((a, b) => {
    if (a.pnlPct == null && b.pnlPct == null) return 0;
    if (a.pnlPct == null) return 1;
    if (b.pnlPct == null) return -1;
    return b.pnlPct - a.pnlPct;
  });

  const data: TickerResponse = {
    ticker: ticker.toUpperCase(),
    trades,
    total: trades.length,
    updatedAt: new Date().toISOString(),
  };

  cache.set(ticker, { data, expiresAt: Date.now() + 5 * 60 * 1000 });
  return data;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const data = await buildTickerData(ticker.toUpperCase());
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
    },
  });
}
