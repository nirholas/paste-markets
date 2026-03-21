/**
 * Standardized response envelope for all /v1/* endpoints.
 *
 * Success:  { ok: true,  data: T, meta?: Meta, requestId: string }
 * Error:    { ok: false, error: { code, message }, requestId: string }
 */

import { NextResponse } from "next/server";

export interface Meta {
  total: number;
  limit: number;
  offset: number;
  page: number;
}

function requestId(): string {
  return crypto.randomUUID();
}

export function okResponse<T>(
  data: T,
  meta?: Partial<Meta>,
  rateLimitHeaders?: Record<string, string>,
  status = 200,
): NextResponse {
  const body: Record<string, unknown> = {
    ok: true,
    data,
    requestId: requestId(),
  };
  if (meta) body["meta"] = meta;

  const res = NextResponse.json(body, { status });
  if (rateLimitHeaders) {
    for (const [k, v] of Object.entries(rateLimitHeaders)) {
      res.headers.set(k, v);
    }
  }
  return res;
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  const body = {
    ok: false,
    error: { code, message },
    requestId: requestId(),
  };

  const res = NextResponse.json(body, { status });
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.headers.set(k, v);
    }
  }
  return res;
}

/** Parse and clamp a limit param */
export function parseLimit(raw: string | null, defaultVal = 20, max = 100): number {
  const n = parseInt(raw ?? String(defaultVal), 10);
  return isNaN(n) ? defaultVal : Math.min(Math.max(1, n), max);
}

/** Parse a non-negative offset param */
export function parseOffset(raw: string | null): number {
  const n = parseInt(raw ?? "0", 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

/** Compute current page from offset and limit */
export function computePage(offset: number, limit: number): number {
  return Math.floor(offset / limit) + 1;
}
