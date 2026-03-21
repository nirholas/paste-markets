/**
 * Standardized response envelope for all /v2/* endpoints.
 *
 * Success:  { data: T, meta?: { page, pageSize, total, hasMore }, timestamp: string }
 * Error:    { error: { code, message, details? }, timestamp: string }
 */

import { NextResponse } from "next/server";

export interface V2Meta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function v2Ok<T>(
  data: T,
  meta?: Partial<V2Meta>,
  rateLimitHeaders?: Record<string, string>,
  status = 200,
): NextResponse {
  const body: Record<string, unknown> = {
    data,
    timestamp: new Date().toISOString(),
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

export function v2Error(
  code: string,
  message: string,
  status: number,
  extraHeaders?: Record<string, string>,
  details?: unknown,
): NextResponse {
  const body: Record<string, unknown> = {
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    timestamp: new Date().toISOString(),
  };

  const res = NextResponse.json(body, { status });
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.headers.set(k, v);
    }
  }
  return res;
}

/** Parse page parameter (1-indexed) */
export function parsePage(raw: string | null, defaultVal = 1): number {
  const n = parseInt(raw ?? String(defaultVal), 10);
  return isNaN(n) || n < 1 ? defaultVal : n;
}

/** Parse pageSize parameter */
export function parsePageSize(raw: string | null, defaultVal = 20, max = 100): number {
  const n = parseInt(raw ?? String(defaultVal), 10);
  return isNaN(n) ? defaultVal : Math.min(Math.max(1, n), max);
}

/** Compute SQL offset from page + pageSize */
export function pageToOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** Build V2Meta from total, page, pageSize */
export function buildMeta(total: number, page: number, pageSize: number): V2Meta {
  return {
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}
