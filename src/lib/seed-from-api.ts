/**
 * Seed the database from the paste.trade global search API.
 *
 * Fetches all recent trades across all authors, groups them by author,
 * creates author records, upserts trades, and computes rankings.
 *
 * Run with: npm run db:sync
 * Or POST /api/sync (with SYNC_SECRET header)
 */

import type { PasteTradeTrade } from "./paste-trade";

const BASE_URL = "https://paste.trade";
const useSqlite = process.env["USE_SQLITE"] !== "false";

interface RawGlobalTrade {
  author_handle?: string;
  ticker?: string;
  direction?: string;
  platform?: string;
  pnl_pct?: number;
  pnlPct?: number;
  pnl?: number;
  author_date?: string;
  created_at?: string;
  posted_at?: string;
  source_url?: string;
  sourceUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type GlobalSearchResponse = {
  trades: RawGlobalTrade[];
  total?: number;
  next_cursor?: string | null;
};

export interface SeedResult {
  authors: number;
  trades: number;
  ranked: number;
}

function normalizeGlobalTrade(raw: RawGlobalTrade): PasteTradeTrade {
  const rawDirection = String(raw.direction ?? "long");
  const direction = (["long", "short", "yes", "no"].includes(rawDirection)
    ? rawDirection
    : "long") as PasteTradeTrade["direction"];

  const pnlPct =
    raw.pnlPct != null
      ? Number(raw.pnlPct)
      : raw.pnl_pct != null
        ? Number(raw.pnl_pct)
        : raw.pnl != null
          ? Number(raw.pnl)
          : undefined;

  const sourceUrl = raw.source_url ?? raw.sourceUrl;
  const postedAt = raw.posted_at ?? raw.created_at ?? new Date().toISOString();

  return {
    ticker: String(raw.ticker ?? ""),
    direction,
    platform: raw.platform ?? undefined,
    pnlPct: pnlPct != null && !isNaN(pnlPct) ? pnlPct : undefined,
    author_date: raw.author_date ?? undefined,
    posted_at: postedAt,
    source_url: sourceUrl ?? undefined,
  };
}

async function fetchAllTrades(): Promise<Map<string, PasteTradeTrade[]>> {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) {
    throw new Error("PASTE_TRADE_KEY environment variable is not set");
  }

  const byAuthor = new Map<string, PasteTradeTrade[]>();
  let cursor: string | null = null;
  let pagesFetched = 0;
  const MAX_PAGES = 20; // safety limit

  do {
    const url = new URL("/api/search", BASE_URL);
    url.searchParams.set("top", "90d");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[seed-from-api] API error: ${res.status} ${res.statusText}`);
      break;
    }

    const body: unknown = await res.json();

    let trades: RawGlobalTrade[] = [];
    let nextCursor: string | null = null;

    if (body != null && typeof body === "object") {
      const obj = body as Record<string, unknown>;
      if (Array.isArray(obj["trades"])) {
        trades = obj["trades"] as RawGlobalTrade[];
      } else if (Array.isArray(obj["data"])) {
        trades = obj["data"] as RawGlobalTrade[];
      } else if (Array.isArray(body)) {
        trades = body as RawGlobalTrade[];
      }
      nextCursor = (obj["next_cursor"] as string | null | undefined) ?? null;
    } else if (Array.isArray(body)) {
      trades = body as RawGlobalTrade[];
    }

    for (const raw of trades) {
      const handle = raw.author_handle;
      if (!handle || typeof handle !== "string") continue;

      const normalized = normalizeGlobalTrade(raw);
      if (!normalized.ticker) continue; // skip trades with no ticker

      const list = byAuthor.get(handle) ?? [];
      list.push(normalized);
      byAuthor.set(handle, list);
    }

    cursor = nextCursor;
    pagesFetched++;

    console.log(
      `[seed-from-api] Page ${pagesFetched}: fetched ${trades.length} trades (${byAuthor.size} authors so far)`,
    );
  } while (cursor && pagesFetched < MAX_PAGES);

  return byAuthor;
}

export async function seedFromApi(): Promise<SeedResult> {
  if (!useSqlite) {
    console.warn("[seed-from-api] SQLite mode not enabled — skipping sync");
    return { authors: 0, trades: 0, ranked: 0 };
  }

  const db = await import("./db");

  console.log("[seed-from-api] Fetching all trades from paste.trade...");
  const byAuthor = await fetchAllTrades();

  if (byAuthor.size === 0) {
    console.warn("[seed-from-api] No trades found — check PASTE_TRADE_KEY and API availability");
    return { authors: 0, trades: 0, ranked: 0 };
  }

  let totalTrades = 0;

  for (const [handle, trades] of byAuthor) {
    try {
      db.getOrCreateAuthor(handle);
      db.upsertTrades(handle, trades);
      totalTrades += trades.length;
    } catch (err) {
      console.error(`[seed-from-api] Failed to sync @${handle}:`, err);
    }
  }

  console.log(
    `[seed-from-api] Upserted ${totalTrades} trades for ${byAuthor.size} authors. Computing rankings...`,
  );

  db.updateRankings("30d");
  db.updateRankings("7d");

  const leaderboard = db.getLeaderboard("30d", 9999, 0);
  const ranked = leaderboard.length;

  console.log(
    `[seed-from-api] Done. Authors: ${byAuthor.size}, Trades: ${totalTrades}, Ranked: ${ranked}`,
  );

  return { authors: byAuthor.size, trades: totalTrades, ranked };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith("seed-from-api.ts")) {
  seedFromApi()
    .then((result) => {
      console.log("[seed-from-api] Sync complete:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[seed-from-api] Fatal error:", err);
      process.exit(1);
    });
}
