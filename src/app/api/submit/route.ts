import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PASTE_TRADE_URL = process.env["PASTE_TRADE_URL"] ?? "https://paste.trade";
const PASTE_TRADE_KEY = process.env["PASTE_TRADE_KEY"] ?? "";

function detectPlatform(url: string): string {
  if (/https?:\/\/(twitter\.com|x\.com)\//i.test(url)) return "twitter";
  if (/https?:\/\/(youtube\.com|youtu\.be)\//i.test(url)) return "youtube";
  return "web";
}

function extractHandle(url: string): string | undefined {
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/?]+)/i);
  return match?.[1];
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return /^https?:\/\//i.test(url);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid URL" },
        { status: 400 },
      );
    }

    const url = body.url.trim();

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid URL" },
        { status: 400 },
      );
    }

    if (!PASTE_TRADE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Service unavailable" },
        { status: 503 },
      );
    }

    const platform = detectPlatform(url);
    const author_handle = extractHandle(url);
    const source_date = new Date().toISOString();

    const payload: Record<string, string> = { url, platform, source_date };
    if (author_handle) payload.author_handle = author_handle;

    const res = await fetch(`${PASTE_TRADE_URL}/api/sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PASTE_TRADE_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[api/submit] paste.trade error:", res.status, data);
      return NextResponse.json(
        { ok: false, error: data?.error ?? "Submission failed" },
        { status: res.status },
      );
    }

    return NextResponse.json({
      ok: true,
      source_id: data.source_id,
      source_url: data.source_url,
      status: data.status ?? "processing",
    });
  } catch (err) {
    console.error("[api/submit] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
