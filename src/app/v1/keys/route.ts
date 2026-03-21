/**
 * POST /v1/keys   — generate and persist an API key
 * GET  /v1/keys   — list keys for a handle (requires existing key)
 */

import { NextRequest } from "next/server";
import { authenticate, generateApiKey } from "@/lib/api-auth";
import { okResponse, errorResponse } from "@/lib/v1-response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  let body: { handle?: string; tier?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_BODY", "Request body must be valid JSON", 400, auth.rateLimitHeaders);
  }

  const handle = (body.handle ?? "").replace(/^@/, "").toLowerCase().trim();
  if (!handle) {
    return errorResponse(
      "INVALID_PARAM",
      "Missing required field: handle (your Twitter/X username)",
      400,
      auth.rateLimitHeaders,
    );
  }

  // Only developer-tier keys can issue developer-tier keys
  const requestedTier =
    body.tier === "developer" && auth.tier === "developer" ? "developer" : "free";

  const key = generateApiKey();

  // Persist to SQLite if available
  let persisted = false;
  if (process.env["USE_SQLITE"] !== "false") {
    try {
      const { insertApiKey } = await import("@/lib/db");
      insertApiKey(key, handle, requestedTier);
      persisted = true;
    } catch (err) {
      console.error("[v1/keys] Failed to persist key to SQLite:", err);
    }
  }

  return okResponse(
    {
      key,
      tier: requestedTier,
      handle,
      createdAt: new Date().toISOString(),
      persisted,
      limits: {
        requestsPerDay: requestedTier === "developer" ? 10_000 : 100,
      },
      usage: [
        `Authorization: Bearer ${key}`,
        `or ?api_key=${key}`,
      ],
    },
    undefined,
    auth.rateLimitHeaders,
  );
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const handle = req.nextUrl.searchParams.get("handle")?.replace(/^@/, "").toLowerCase().trim();
  if (!handle) {
    return errorResponse(
      "INVALID_PARAM",
      "Provide ?handle=yourhandle to list keys.",
      400,
      auth.rateLimitHeaders,
    );
  }

  if (process.env["USE_SQLITE"] !== "false") {
    try {
      const { getApiKeysByHandle } = await import("@/lib/db");
      const rows = getApiKeysByHandle(handle);
      return okResponse(
        rows.map((r) => ({
          key: r.key.slice(0, 8) + "...", // redact most of the key
          tier: r.tier,
          createdAt: r.created_at,
          lastUsed: r.last_used,
          requestCount: r.request_count,
        })),
        undefined,
        auth.rateLimitHeaders,
      );
    } catch (err) {
      console.error("[v1/keys GET] Error:", err);
    }
  }

  return errorResponse("SERVER_ERROR", "Key lookup unavailable in serverless mode.", 501, auth.rateLimitHeaders);
}
