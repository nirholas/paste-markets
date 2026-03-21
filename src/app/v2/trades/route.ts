/**
 * GET /v2/trades — paginated trade list with filtering
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error, parsePage, parsePageSize, pageToOffset, buildMeta } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const sp = req.nextUrl.searchParams;
  const page = parsePage(sp.get("page"));
  const pageSize = parsePageSize(sp.get("pageSize"));
  const offset = pageToOffset(page, pageSize);
  const ticker = sp.get("ticker");
  const author = sp.get("author");
  const direction = sp.get("direction");
  const platform = sp.get("platform");
  const integrity = sp.get("integrity");
  const minPnl = sp.get("min_pnl") ? Number(sp.get("min_pnl")) : null;

  try {
    const countRows = await sql`
      SELECT COUNT(*) as total FROM trades t
      WHERE (${ticker}::text IS NULL OR UPPER(t.ticker) = UPPER(${ticker}))
        AND (${author}::text IS NULL OR t.author_handle = ${author})
        AND (${direction}::text IS NULL OR t.direction = ${direction})
        AND (${platform}::text IS NULL OR t.platform = ${platform})
        AND (${integrity}::text IS NULL OR t.integrity = ${integrity})
        AND (${minPnl}::numeric IS NULL OR t.pnl_pct >= ${minPnl})
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT t.author_handle, t.ticker, t.direction, t.pnl_pct, t.platform,
             t.entry_date, t.posted_at, t.source_url, t.integrity, t.delay_minutes
      FROM trades t
      WHERE (${ticker}::text IS NULL OR UPPER(t.ticker) = UPPER(${ticker}))
        AND (${author}::text IS NULL OR t.author_handle = ${author})
        AND (${direction}::text IS NULL OR t.direction = ${direction})
        AND (${platform}::text IS NULL OR t.platform = ${platform})
        AND (${integrity}::text IS NULL OR t.integrity = ${integrity})
        AND (${minPnl}::numeric IS NULL OR t.pnl_pct >= ${minPnl})
      ORDER BY t.posted_at DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch trades", 500, auth.rateLimitHeaders);
  }
}
