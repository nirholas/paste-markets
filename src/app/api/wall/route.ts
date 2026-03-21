import { NextResponse, type NextRequest } from "next/server";
import { getWallPosts, getWallCount } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
  const category = params.get("category") ?? "all";

  const validCategories = ["all", "reaction", "testimonial", "feature_request"];
  const cat = validCategories.includes(category) ? category : "all";

  const offset = (page - 1) * limit;
  const posts = await getWallPosts(cat, limit, offset);
  const total = await getWallCount(cat);

  return NextResponse.json({
    posts,
    total,
    page,
    limit,
    hasMore: offset + posts.length < total,
  });
}
