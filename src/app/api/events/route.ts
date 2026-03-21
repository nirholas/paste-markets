import { NextRequest, NextResponse } from "next/server";
import { classifyCategory, type CallCategory } from "@/lib/category";

export const dynamic = "force-dynamic";

export interface EventItem {
  id: string;
  ticker: string;
  direction: "yes" | "no" | string;
  author_handle: string;
  author_avatar_url: string | null;
  headline_quote: string | null;
  thesis: string | null;
  platform: "polymarket";
  instrument: string | null;
  source_url: string | null;
  created_at: string;
  entry_price: number | null;   // probability 0–1
  current_price: number | null; // probability 0–1
  pnl_pct: number | null;
  win_rate: number | null;
  market_question: string | null;
  market_volume: number | null;
  expires_at: string | null;
  polymarket_url: string | null;
  category: CallCategory;
}

export interface EventsResponse {
  items: EventItem[];
  next_cursor: string | null;
  total: number;
  category: string;
}

const VALID_CATEGORIES = new Set([
  "all", "sports", "politics", "macro_event", "entertainment", "prediction",
]);

function fixAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return `https://paste.trade${url}`;
  return url;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;

  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = isNaN(rawLimit) ? 20 : Math.min(Math.max(1, rawLimit), 50);
  const cursor = searchParams.get("cursor") ?? undefined;
  const categoryFilter = searchParams.get("category") ?? "all";
  const resolvedCategory = VALID_CATEGORIES.has(categoryFilter) ? categoryFilter : "all";

  // Always fetch Polymarket trades
  const url = new URL("/api/trades", "https://paste.trade");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("platform", "polymarket");
  if (cursor) url.searchParams.set("cursor", cursor);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error", status: res.status },
        { status: 502 },
      );
    }

    const body = await res.json() as {
      items?: Record<string, unknown>[];
      next_cursor?: string | null;
      total?: number;
    };

    const rawItems = Array.isArray(body.items) ? body.items : [];

    let items: EventItem[] = rawItems.map((raw) => {
      const ticker = String(raw["ticker"] ?? "");
      const thesis = raw["thesis"] != null ? String(raw["thesis"]) : null;
      const marketQuestion = raw["market_question"] != null ? String(raw["market_question"]) : null;
      const instrument = raw["instrument"] != null ? String(raw["instrument"]) : null;

      const category = classifyCategory({
        platform: "polymarket",
        ticker,
        thesis,
        market_question: marketQuestion,
        instrument,
      });

      // Derive polymarket URL from source_url or instrument
      const sourceUrl = raw["source_url"] != null ? String(raw["source_url"]) : null;
      const polymarketUrl =
        sourceUrl?.includes("polymarket.com") ? sourceUrl :
        raw["polymarket_url"] != null ? String(raw["polymarket_url"]) : null;

      return {
        id: String(raw["id"] ?? ""),
        ticker,
        direction: String(raw["direction"] ?? "yes"),
        author_handle: String(raw["author_handle"] ?? ""),
        author_avatar_url: fixAvatarUrl(raw["author_avatar_url"] as string | null | undefined),
        headline_quote: raw["headline_quote"] != null ? String(raw["headline_quote"]) : null,
        thesis,
        platform: "polymarket" as const,
        instrument,
        source_url: sourceUrl,
        created_at: String(raw["created_at"] ?? new Date().toISOString()),
        entry_price: raw["entry_price"] != null ? Number(raw["entry_price"]) :
                     raw["entryPrice"] != null ? Number(raw["entryPrice"]) : null,
        current_price: raw["current_price"] != null ? Number(raw["current_price"]) :
                       raw["currentPrice"] != null ? Number(raw["currentPrice"]) : null,
        pnl_pct: raw["pnl_pct"] != null ? Number(raw["pnl_pct"]) :
                 raw["pnlPct"] != null ? Number(raw["pnlPct"]) : null,
        win_rate: raw["win_rate"] != null ? Number(raw["win_rate"]) :
                  raw["winRate"] != null ? Number(raw["winRate"]) : null,
        market_question: marketQuestion,
        market_volume: raw["market_volume"] != null ? Number(raw["market_volume"]) : null,
        expires_at: raw["expires_at"] != null ? String(raw["expires_at"]) :
                    raw["expiresAt"] != null ? String(raw["expiresAt"]) : null,
        polymarket_url: polymarketUrl,
        category,
      };
    });

    // Apply category filter
    if (resolvedCategory !== "all") {
      items = items.filter((item) => item.category === resolvedCategory);
    }

    const response: EventsResponse = {
      items,
      next_cursor: body.next_cursor ?? null,
      total: typeof body.total === "number" ? body.total : items.length,
      category: resolvedCategory,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=15",
      },
    });
  } catch (err) {
    console.error("[api/events] Fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
