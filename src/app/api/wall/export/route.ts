import { NextRequest, NextResponse } from "next/server";
import { getWallPosts, getFeaturedWallPosts } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://paste.markets";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get("featured");

  const posts = featured === "true"
    ? await getFeaturedWallPosts()
    : await getWallPosts("all", 1000, 0);

  const cards = posts.map((p) => ({
    id: p.id,
    handle: p.author_handle,
    displayName: p.author_display_name,
    text: p.content,
    featured: p.featured === 1,
    likes: p.likes,
    retweets: p.retweets,
    imageUrl: `${BASE_URL}/api/og/quote/${encodeURIComponent(p.id)}`,
    pageUrl: `${BASE_URL}/wall/${encodeURIComponent(p.id)}`,
  }));

  return NextResponse.json({
    count: cards.length,
    cards,
  });
}
