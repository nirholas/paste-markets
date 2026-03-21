/**
 * GET /v2/keys/[key]/usage — view usage stats for a key
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { key } = await params;
  const sql = neon(process.env.DATABASE_URL!);

  try {
    const rows = await sql`
      SELECT key, handle, tier, created_at, last_used, request_count
      FROM api_keys WHERE key = ${key} LIMIT 1
    `;

    if (rows.length === 0) {
      return v2Error("NOT_FOUND", "API key not found.", 404, auth.rateLimitHeaders);
    }

    const row = rows[0];
    return v2Ok(
      {
        key: (row.key as string).slice(0, 8) + "...",
        handle: row.handle,
        tier: row.tier,
        createdAt: row.created_at,
        lastUsed: row.last_used,
        requestCount: row.request_count,
      },
      undefined,
      auth.rateLimitHeaders,
    );
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch key usage.", 500, auth.rateLimitHeaders);
  }
}
