/**
 * POST /v2/webhooks — register a webhook
 * GET  /v2/webhooks — list registered webhooks
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error, parsePage, parsePageSize, pageToOffset, buildMeta } from "@/lib/v2-response";
import { generateWebhookSecret } from "@/lib/webhook-dispatch";

export const dynamic = "force-dynamic";

async function ensureWebhooksTable() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_key TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT[] NOT NULL DEFAULT '{"*"}',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_delivered_at TIMESTAMPTZ,
      last_error TEXT,
      last_error_at TIMESTAMPTZ
    )
  `;
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  if (auth.tier === "anon") {
    return v2Error("FORBIDDEN", "API key required to register webhooks.", 403, auth.rateLimitHeaders);
  }

  let body: { url?: string; events?: string[] };
  try {
    body = await req.json();
  } catch {
    return v2Error("INVALID_BODY", "Request body must be valid JSON.", 400, auth.rateLimitHeaders);
  }

  const url = (body.url ?? "").trim();
  if (!url || !url.startsWith("https://")) {
    return v2Error("INVALID_PARAM", "Webhook URL must be a valid HTTPS URL.", 400, auth.rateLimitHeaders);
  }

  const events = body.events ?? ["*"];
  const secret = generateWebhookSecret();
  const sql = neon(process.env.DATABASE_URL!);

  try {
    await ensureWebhooksTable();

    const rows = await sql`
      INSERT INTO webhooks (owner_key, url, secret, events)
      VALUES (${auth.key ?? "anon"}, ${url}, ${secret}, ${events})
      RETURNING id, url, events, active, created_at
    `;

    return v2Ok(
      {
        ...rows[0],
        secret,
        note: "Store this secret securely. It will not be shown again. Use it to verify webhook signatures.",
      },
      undefined,
      auth.rateLimitHeaders,
      201,
    );
  } catch (err) {
    console.error("[v2/webhooks POST]", err);
    return v2Error("SERVER_ERROR", "Failed to register webhook.", 500, auth.rateLimitHeaders);
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  if (auth.tier === "anon" || !auth.key) {
    return v2Error("FORBIDDEN", "API key required to list webhooks.", 403, auth.rateLimitHeaders);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const sp = req.nextUrl.searchParams;
  const page = parsePage(sp.get("page"));
  const pageSize = parsePageSize(sp.get("pageSize"), 20);
  const offset = pageToOffset(page, pageSize);

  try {
    await ensureWebhooksTable();

    const countRows = await sql`
      SELECT COUNT(*) as total FROM webhooks WHERE owner_key = ${auth.key}
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT id, url, events, active, created_at, last_delivered_at, last_error, last_error_at
      FROM webhooks
      WHERE owner_key = ${auth.key}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to list webhooks.", 500, auth.rateLimitHeaders);
  }
}
