/**
 * API key authentication + in-memory rate limiting for /v1/* endpoints.
 *
 * Key format: pt_<32 random hex chars>
 * Tiers:
 *   - anon (no key):  60 req/hour per IP
 *   - free:           100 req/day per key
 *   - developer:      10,000 req/day per key
 *
 * Keys are stored in the SQLite api_keys table (USE_SQLITE=true)
 * or in PT_API_KEYS env var as a JSON array / comma-separated list (serverless).
 */

import type { NextRequest } from "next/server";

export type ApiTier = "anon" | "free" | "developer" | "builder" | "pro";

export interface ApiKeyRecord {
  key: string;
  tier: ApiTier;
  handle?: string;
}

export interface AuthSuccess {
  ok: true;
  key: string | null;
  tier: ApiTier;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp seconds
  rateLimitHeaders: Record<string, string>;
}

export interface AuthFailure {
  ok: false;
  statusCode: number;
  error: { code: string; message: string };
  headers: Record<string, string>;
}

export type AuthResult = AuthSuccess | AuthFailure;

// ----- Key lookup -----

/** Look up a key, checking SQLite first then env var fallback. */
async function lookupKey(key: string): Promise<ApiKeyRecord | null> {
  // SQLite path
  if (process.env["USE_SQLITE"] !== "false") {
    try {
      const { getApiKey } = await import("./db");
      const row = getApiKey(key);
      if (row) {
        // Fire-and-forget usage tracking
        try {
          const { touchApiKey } = await import("./db");
          touchApiKey(key);
        } catch { /* non-critical */ }
        return { key: row.key, tier: row.tier, handle: row.handle };
      }
    } catch { /* fall through to env var */ }
  }

  // Env var fallback (serverless / dev without SQLite)
  const raw = process.env["PT_API_KEYS"] ?? "";
  if (!raw.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === "object") {
          const rec = item as Record<string, unknown>;
          if (rec["key"] === key) {
            const validTiers = ["free", "developer", "builder", "pro"] as const;
            const rawTier = rec["tier"] as string;
            const tier = validTiers.includes(rawTier as typeof validTiers[number])
              ? (rawTier as "free" | "developer" | "builder" | "pro")
              : "free";
            return {
              key,
              tier,
              handle: typeof rec["handle"] === "string" ? rec["handle"] : undefined,
            };
          }
        }
      }
    }
  } catch {
    // comma-separated fallback
    for (const k of raw.split(",")) {
      if (k.trim() === key) return { key, tier: "free" };
    }
  }

  return null;
}

// ----- Rate limiting -----

const LIMITS: Record<ApiTier, { max: number; windowMs: number }> = {
  anon:      { max: 60,     windowMs: 60 * 60 * 1000 },           // 60/hour
  free:      { max: 100,    windowMs: 24 * 60 * 60 * 1000 },      // 100/day
  developer: { max: 10_000, windowMs: 24 * 60 * 60 * 1000 },      // 10k/day
  builder:   { max: 1_000,  windowMs: 60 * 60 * 1000 },           // 1k/hour
  pro:       { max: 10_000, windowMs: 60 * 60 * 1000 },           // 10k/hour
};

interface RateEntry { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateEntry>();

function checkRateLimit(
  identifier: string,
  tier: ApiTier,
): { allowed: boolean; limit: number; remaining: number; reset: number } {
  const cfg = LIMITS[tier];
  const now = Date.now();

  let entry = rateLimitStore.get(identifier);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + cfg.windowMs };
    rateLimitStore.set(identifier, entry);
  }

  entry.count++;
  const remaining = Math.max(0, cfg.max - entry.count);
  const reset = Math.ceil(entry.resetAt / 1000);
  return { allowed: entry.count <= cfg.max, limit: cfg.max, remaining, reset };
}

// ----- Main auth function (async) -----

export async function authenticate(req: NextRequest): Promise<AuthResult> {
  // Extract key from Authorization header or ?api_key
  const authHeader = req.headers.get("authorization") ?? "";
  let key: string | null = null;

  if (authHeader.startsWith("Bearer ")) {
    key = authHeader.slice(7).trim() || null;
  }
  if (!key) key = req.nextUrl.searchParams.get("api_key");

  let tier: ApiTier = "anon";
  let identifier: string;

  if (key) {
    const record = await lookupKey(key);
    if (!record) {
      return {
        ok: false,
        statusCode: 401,
        error: {
          code: "INVALID_KEY",
          message: "Invalid API key. Get one at paste.trade/developer.",
        },
        headers: {},
      };
    }
    tier = record.tier;
    identifier = `key:${key}`;
  } else {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    identifier = `ip:${ip}`;
  }

  const { allowed, limit, remaining, reset } = checkRateLimit(identifier, tier);

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(reset),
  };

  if (!allowed) {
    return {
      ok: false,
      statusCode: 429,
      error: {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded. Retry after ${new Date(reset * 1000).toISOString()}.`,
      },
      headers: {
        ...rateLimitHeaders,
        "Retry-After": String(reset - Math.floor(Date.now() / 1000)),
      },
    };
  }

  return { ok: true, key, tier, limit, remaining, reset, rateLimitHeaders };
}

/** Generate a new API key: pt_ + 32 random hex chars */
export function generateApiKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "pt_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
