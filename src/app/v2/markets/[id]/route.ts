/**
 * GET /v2/markets/[id] — market detail + consensus
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error, parsePage, parsePageSize, pageToOffset, buildMeta } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { id } = await params;
  const sql = neon(process.env.DATABASE_URL!);
  const sp = req.nextUrl.searchParams;
  const page = parsePage(sp.get("page"));
  const pageSize = parsePageSize(sp.get("pageSize"));
  const offset = pageToOffset(page, pageSize);

  try {
    // Market summary
    const summaryRows = await sql`
      SELECT ticker,
             COUNT(*) as total_calls,
             COUNT(DISTINCT author_handle) as caller_count,
             SUM(CASE WHEN direction = 'yes' THEN 1 ELSE 0 END) as yes_count,
             SUM(CASE WHEN direction = 'no' THEN 1 ELSE 0 END) as no_count,
             AVG(pnl_pct) as avg_pnl,
             MAX(posted_at) as last_call_at
      FROM trades
      WHERE platform = 'polymarket' AND ticker = ${id}
      GROUP BY ticker
    `;

    if (summaryRows.length === 0) {
      return v2Error("NOT_FOUND", `Market "${id}" not found.`, 404, auth.rateLimitHeaders);
    }

    const summary = summaryRows[0];
    const yesCount = Number(summary.yes_count ?? 0);
    const noCount = Number(summary.no_count ?? 0);
    const totalVotes = yesCount + noCount;
    const consensus = totalVotes > 0
      ? { direction: yesCount >= noCount ? "yes" : "no", confidence: Math.round((Math.max(yesCount, noCount) / totalVotes) * 100) }
      : { direction: "neutral", confidence: 0 };

    // Individual calls
    const countRows = await sql`
      SELECT COUNT(*) as total FROM trades WHERE platform = 'polymarket' AND ticker = ${id}
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const callRows = await sql`
      SELECT t.author_handle, t.direction, t.pnl_pct, t.posted_at, t.source_url,
             a.win_rate as author_win_rate, a.rank as author_rank
      FROM trades t
      JOIN authors a ON a.handle = t.author_handle
      WHERE t.platform = 'polymarket' AND t.ticker = ${id}
      ORDER BY t.posted_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(
      { summary, consensus, calls: callRows },
      buildMeta(total, page, pageSize),
      auth.rateLimitHeaders,
    );
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch market detail", 500, auth.rateLimitHeaders);
  }
}
