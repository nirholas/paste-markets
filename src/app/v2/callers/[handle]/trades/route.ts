/**
 * GET /v2/callers/[handle]/trades — caller's trade history
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error, parsePage, parsePageSize, pageToOffset, buildMeta } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { handle } = await params;
  const sql = neon(process.env.DATABASE_URL!);
  const sp = req.nextUrl.searchParams;
  const page = parsePage(sp.get("page"));
  const pageSize = parsePageSize(sp.get("pageSize"));
  const offset = pageToOffset(page, pageSize);
  const ticker = sp.get("ticker");
  const direction = sp.get("direction");
  const platform = sp.get("platform");

  try {
    // Check caller exists
    const authorRows = await sql`SELECT handle FROM authors WHERE handle = ${handle}`;
    if (authorRows.length === 0) {
      return v2Error("NOT_FOUND", `Caller "${handle}" not found.`, 404, auth.rateLimitHeaders);
    }

    const countRows = await sql`
      SELECT COUNT(*) as total FROM trades
      WHERE author_handle = ${handle}
        AND (${ticker}::text IS NULL OR UPPER(ticker) = UPPER(${ticker}))
        AND (${direction}::text IS NULL OR direction = ${direction})
        AND (${platform}::text IS NULL OR platform = ${platform})
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT ticker, direction, pnl_pct, platform, entry_date, posted_at,
             source_url, integrity, delay_minutes, counted_in_stats
      FROM trades
      WHERE author_handle = ${handle}
        AND (${ticker}::text IS NULL OR UPPER(ticker) = UPPER(${ticker}))
        AND (${direction}::text IS NULL OR direction = ${direction})
        AND (${platform}::text IS NULL OR platform = ${platform})
      ORDER BY entry_date DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch trades", 500, auth.rateLimitHeaders);
  }
}
