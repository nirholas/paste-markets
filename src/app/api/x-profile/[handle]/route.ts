import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAuthor, updateXProfile, isXProfileStale } from "@/lib/db";
import { fetchProfile } from "@/lib/twitter-fetch";

export const dynamic = "force-dynamic";

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = cleanHandle(rawHandle);

    if (!handle) {
      return NextResponse.json({ error: "Missing handle" }, { status: 400 });
    }

    const author = await getOrCreateAuthor(handle);

    // Return cached data if fresh
    if (!isXProfileStale(author.x_profile_fetched_at)) {
      return NextResponse.json({
        handle,
        displayName: author.display_name,
        avatarUrl: author.avatar_url,
        bannerUrl: author.banner_url,
        bio: author.bio,
        location: author.location,
        website: author.website,
        verified: author.verified,
        followers: author.followers,
        following: author.following,
        tweetCount: author.tweet_count,
        joinedAt: author.x_joined_at,
        cached: true,
      });
    }

    // Fetch fresh from X
    const profile = await fetchProfile(handle);

    if (!profile) {
      return NextResponse.json(
        { error: "Could not fetch X profile", handle },
        { status: 404 },
      );
    }

    // Cache in DB
    await updateXProfile(handle, {
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      displayName: profile.displayName,
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      verified: profile.verified,
      followers: profile.followers,
      following: profile.following,
      tweetCount: profile.tweetCount,
      joinedAt: profile.joined,
    });

    return NextResponse.json({
      handle: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      verified: profile.verified,
      followers: profile.followers,
      following: profile.following,
      tweetCount: profile.tweetCount,
      joinedAt: profile.joined,
      cached: false,
    });
  } catch (err) {
    console.error("[api/x-profile] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
