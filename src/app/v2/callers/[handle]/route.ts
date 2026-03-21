/**
 * GET /v2/callers/[handle] — full caller profile
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error } from "@/lib/v2-response";

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

  try {
    const rows = await sql`SELECT * FROM authors WHERE handle = ${handle}`;
    if (rows.length === 0) {
      return v2Error("NOT_FOUND", `Caller "${handle}" not found.`, 404, auth.rateLimitHeaders);
    }

    const author = rows[0];

    // Get recent trade summary
    const tradeRows = await sql`
      SELECT ticker, direction, pnl_pct, platform, entry_date, posted_at, integrity
      FROM trades WHERE author_handle = ${handle}
      ORDER BY entry_date DESC LIMIT 10
    `;

    // Get integrity stats
    const integrityRows = await sql`
      SELECT integrity, COUNT(*) as count
      FROM trades WHERE author_handle = ${handle}
      GROUP BY integrity
    `;

    const integrityStats: Record<string, number> = {};
    let integrityTotal = 0;
    for (const row of integrityRows) {
      integrityStats[row.integrity as string] = Number(row.count);
      integrityTotal += Number(row.count);
    }

    return v2Ok(
      {
        ...author,
        recentTrades: tradeRows,
        integrity: {
          ...integrityStats,
          total: integrityTotal,
          score: integrityTotal > 0
            ? Math.round(((integrityStats["live"] ?? 0) / integrityTotal) * 100)
            : 100,
        },
      },
      undefined,
      auth.rateLimitHeaders,
    );
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch caller profile", 500, auth.rateLimitHeaders);
  }
}
