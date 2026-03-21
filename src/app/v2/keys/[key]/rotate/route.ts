/**
 * POST /v2/keys/[key]/rotate — rotate an API key (invalidate old, create new)
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate, generateApiKey } from "@/lib/api-auth";
import { v2Ok, v2Error } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { key: oldKey } = await params;
  const sql = neon(process.env.DATABASE_URL!);

  try {
    // Find existing key
    const rows = await sql`
      SELECT key, handle, tier FROM api_keys WHERE key = ${oldKey} LIMIT 1
    `;

    if (rows.length === 0) {
      return v2Error("NOT_FOUND", "API key not found.", 404, auth.rateLimitHeaders);
    }

    const existing = rows[0];
    const newKey = generateApiKey();

    // Insert new key with same handle and tier
    await sql`
      INSERT INTO api_keys (key, handle, tier)
      VALUES (${newKey}, ${existing.handle as string}, ${existing.tier as string})
    `;

    // Delete old key
    await sql`DELETE FROM api_keys WHERE key = ${oldKey}`;

    return v2Ok(
      {
        oldKey: oldKey.slice(0, 8) + "...",
        newKey,
        handle: existing.handle,
        tier: existing.tier,
        rotatedAt: new Date().toISOString(),
      },
      undefined,
      auth.rateLimitHeaders,
    );
  } catch {
    return v2Error("SERVER_ERROR", "Failed to rotate key.", 500, auth.rateLimitHeaders);
  }
}
