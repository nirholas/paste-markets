/**
 * POST /v2/keys — generate new API key
 * GET  /v2/keys — list keys for a handle
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate, generateApiKey } from "@/lib/api-auth";
import { v2Ok, v2Error } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  let body: { handle?: string; tier?: string };
  try {
    body = await req.json();
  } catch {
    return v2Error("INVALID_BODY", "Request body must be valid JSON.", 400, auth.rateLimitHeaders);
  }

  const handle = (body.handle ?? "").replace(/^@/, "").toLowerCase().trim();
  if (!handle) {
    return v2Error(
      "INVALID_PARAM",
      "Missing required field: handle (your Twitter/X username).",
      400,
      auth.rateLimitHeaders,
    );
  }

  // Determine tier based on requester's permissions
  const validTiers = ["free", "developer", "builder", "pro"] as const;
  const requestedTier = body.tier && validTiers.includes(body.tier as typeof validTiers[number])
    ? body.tier
    : "free";

  // Only developer+ can create non-free keys
  const tier = (auth.tier === "developer" || auth.tier === "builder" || auth.tier === "pro")
    ? requestedTier
    : "free";

  const key = generateApiKey();
  const sql = neon(process.env.DATABASE_URL!);

  try {
    await sql`
      INSERT INTO api_keys (key, handle, tier) VALUES (${key}, ${handle}, ${tier})
      ON CONFLICT DO NOTHING
    `;

    return v2Ok(
      {
        key,
        tier,
        handle,
        createdAt: new Date().toISOString(),
        limits: {
          anon: "60 req/hour",
          free: "100 req/day",
          developer: "10,000 req/day",
          builder: "1,000 req/hour",
          pro: "10,000 req/hour",
        },
        usage: [
          `Authorization: Bearer ${key}`,
          `or ?api_key=${key}`,
        ],
      },
      undefined,
      auth.rateLimitHeaders,
      201,
    );
  } catch {
    return v2Error("SERVER_ERROR", "Failed to create API key.", 500, auth.rateLimitHeaders);
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const handle = req.nextUrl.searchParams.get("handle")?.replace(/^@/, "").toLowerCase().trim();
  if (!handle) {
    return v2Error("INVALID_PARAM", "Provide ?handle=yourhandle to list keys.", 400, auth.rateLimitHeaders);
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const rows = await sql`
      SELECT key, handle, tier, created_at, last_used, request_count
      FROM api_keys WHERE handle = ${handle} ORDER BY created_at DESC
    `;

    const redacted = rows.map((r: any) => ({
      key: (r.key as string).slice(0, 8) + "...",
      tier: r.tier,
      createdAt: r.created_at,
      lastUsed: r.last_used,
      requestCount: r.request_count,
    }));

    return v2Ok(redacted, undefined, auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to list keys.", 500, auth.rateLimitHeaders);
  }
}
