import { NextResponse } from "next/server";
import { getAssets } from "@/lib/data";
import type { AssetSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

export type { AssetSummary };

export interface AssetsResponse {
  assets: AssetSummary[];
}

let cache: { data: AssetsResponse; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data);
  }

  const assets = await getAssets();
  const response: AssetsResponse = { assets };
  cache = { data: response, expiresAt: Date.now() + CACHE_TTL };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
  });
}
