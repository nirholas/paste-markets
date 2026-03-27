import { NextRequest, NextResponse } from "next/server";
import { createSource, PasteTradeError } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

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

    const platform = detectPlatform(url);
    const author_handle = extractHandle(url);
    const source_date = new Date().toISOString();

    const result = await createSource({
      url,
      platform,
      source_date,
      author_handle,
    });

    return NextResponse.json({
      ok: true,
      source_id: result.source_id,
      source_url: result.source_url,
      status: result.status ?? "processing",
    });
  } catch (err) {
    if (err instanceof PasteTradeError) {
      const status =
        err.code === "no_api_key" ? 503 :
        err.code === "unauthorized" ? 502 :
        err.code === "network_error" ? 504 : 502;
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code, details: err.detail },
        { status },
      );
    }
    console.error("[api/submit] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
