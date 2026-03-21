/**
 * GET /v2/trades/[id] — single trade detail
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error } from "@/lib/v2-response";

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

  try {
    const rows = await sql`
      SELECT t.*, a.display_name, a.win_rate as author_win_rate,
             a.avg_pnl as author_avg_pnl, a.total_trades as author_total_trades,
             a.rank as author_rank
      FROM trades t
      JOIN authors a ON a.handle = t.author_handle
      WHERE t.id = ${id}
    `;

    if (rows.length === 0) {
      return v2Error("NOT_FOUND", `Trade with ID "${id}" not found.`, 404, auth.rateLimitHeaders);
    }

    return v2Ok(rows[0], undefined, auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch trade", 500, auth.rateLimitHeaders);
  }
}
