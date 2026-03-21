import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { auditCaller, ensureAuditTable } from "@/lib/completeness";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for batch processing

/**
 * GET /api/cron/audit — Batch audit top 50 callers.
 *
 * Designed to be called by a cron job (e.g. Vercel Cron).
 * Fetches top callers from the rankings table and audits each one.
 */
export async function GET(req: Request) {
  const cronSecret = process.env["CRON_SECRET"];
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    await ensureAuditTable();

    // Get top 50 callers from rankings
    const topCallers = await sql`
      SELECT DISTINCT author_handle as handle
      FROM rankings
      WHERE timeframe = '30d'
      ORDER BY rank ASC
      LIMIT 50
    `;

    if (topCallers.length === 0) {
      // Fallback: get from authors table
      const authors = await sql`
        SELECT handle FROM authors
        WHERE total_trades > 0
        ORDER BY total_trades DESC
        LIMIT 50
      `;
      topCallers.push(...authors);
    }

    const results: Array<{
      handle: string;
      grade: string;
      completenessPercent: number;
      error?: string;
    }> = [];

    for (const row of topCallers) {
      const handle = (row.handle as string).toLowerCase();

      try {
        const audit = await auditCaller(handle);
        results.push({
          handle,
          grade: audit.grade,
          completenessPercent: audit.completenessPercent,
        });
      } catch (err) {
        results.push({
          handle,
          grade: "ERROR",
          completenessPercent: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Throttle between audits to avoid rate limits
      await new Promise((r) => setTimeout(r, 2000));
    }

    const succeeded = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    return NextResponse.json({
      message: `Batch audit complete: ${succeeded} succeeded, ${failed} failed`,
      total: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (err) {
    console.error("[cron/audit] Error:", err);
    return NextResponse.json(
      { error: "Batch audit failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
