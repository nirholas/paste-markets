/**
 * Batch backfill X profile data for all authors in the database.
 *
 * Calls X's GraphQL API directly with auth cookies.
 *
 * Run: npm run backfill:x-profiles
 *
 * Options:
 *   --limit N      Max authors to process (default: all)
 *   --delay MS     Delay between requests in ms (default: 2000)
 *   --force        Re-fetch even if already fetched
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const GRAPHQL_URL =
  "https://x.com/i/api/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName";

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1]! : fallback;
}
const force = args.includes("--force");
const limit = parseInt(getArg("limit", "0"), 10);
const delay = parseInt(getArg("delay", "2000"), 10);

// Skip handles that are clearly not real X accounts
const SKIP_HANDLES = new Set([
  "user", "favicon.png", "favicon.ico", "gabriel",
]);

function isValidHandle(handle: string): boolean {
  if (SKIP_HANDLES.has(handle)) return false;
  if (handle.includes(" ")) return false;
  if (handle.includes(".")) return false;
  return true;
}

interface XUserProfile {
  username: string;
  name: string;
  bio: string;
  location: string;
  website: string | null;
  avatarUrl: string;
  bannerUrl: string | null;
  verified: boolean;
  followers: number;
  following: number;
  tweetCount: number;
  joined: string | null;
}

function getAvatarOriginalSize(url: string): string {
  return url.replace(/_normal\.(jpg|jpeg|png|gif|webp)/i, ".$1");
}

async function fetchXProfile(
  handle: string,
  authToken: string,
  ct0: string,
): Promise<XUserProfile | null> {
  const variables = JSON.stringify({
    screen_name: handle,
    withSafetyModeUserFields: true,
  });
  const features = JSON.stringify({
    hidden_profile_likes_enabled: false,
    hidden_profile_subscriptions_enabled: false,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: false,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  });
  const fieldToggles = JSON.stringify({ withAuxiliaryUserLabels: false });
  const params = new URLSearchParams({ variables, features, fieldToggles });

  const res = await fetch(`${GRAPHQL_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${BEARER}`,
      Cookie: `auth_token=${authToken}; ct0=${ct0}`,
      "X-Csrf-Token": ct0,
      "X-Twitter-Active-User": "yes",
      "X-Twitter-Auth-Type": "OAuth2Session",
      "X-Twitter-Client-Language": "en",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Referer: `https://x.com/${handle}`,
      Origin: "https://x.com",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) {
    throw new Error("Rate limited — increase --delay or wait a few minutes");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
  }

  const data = (await res.json()) as {
    data?: {
      user?: {
        result?: {
          legacy?: Record<string, unknown>;
          is_blue_verified?: boolean;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [key: string]: any;
        };
      };
    };
  };

  const result = data.data?.user?.result;
  if (!result?.legacy) return null;

  const u = result.legacy;
  const urls =
    (
      u.entities as {
        url?: { urls?: Array<{ expanded_url?: string }> };
      }
    )?.url?.urls ?? [];
  const website = urls.length > 0 ? (urls[0]?.expanded_url ?? null) : null;

  return {
    username: (u.screen_name as string) || handle,
    name: (u.name as string) || "",
    bio: (u.description as string) || "",
    location: (u.location as string) || "",
    website,
    avatarUrl: getAvatarOriginalSize(
      (u.profile_image_url_https as string) || "",
    ),
    bannerUrl: (u.profile_banner_url as string) || null,
    verified: result.is_blue_verified ?? false,
    followers: (u.followers_count as number) ?? 0,
    following: (u.friends_count as number) ?? 0,
    tweetCount: (u.statuses_count as number) ?? 0,
    joined: u.created_at
      ? new Date(u.created_at as string).toISOString()
      : null,
  };
}

async function backfill() {
  const authToken = process.env["TWITTER_AUTH_TOKEN"];
  const ct0 = process.env["TWITTER_CT0"];

  if (!authToken || !ct0) {
    console.error(
      "ERROR: TWITTER_AUTH_TOKEN and TWITTER_CT0 must be set in .env.local",
    );
    process.exit(1);
  }

  const rows = force
    ? await sql`SELECT handle, total_trades FROM authors WHERE handle IS NOT NULL ORDER BY total_trades DESC`
    : await sql`SELECT handle, total_trades FROM authors WHERE handle IS NOT NULL AND x_profile_fetched_at IS NULL ORDER BY total_trades DESC`;

  let authors = rows.filter((r) => isValidHandle(r.handle as string));
  if (limit > 0) authors = authors.slice(0, limit);

  console.log(
    `\nBackfilling X profiles for ${authors.length} authors (delay: ${delay}ms)\n`,
  );
  console.log("\u2500".repeat(80));

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < authors.length; i++) {
    const handle = authors[i]!.handle as string;
    const trades = authors[i]!.total_trades as number;
    const progress = `[${i + 1}/${authors.length}]`;

    try {
      const profile = await fetchXProfile(handle, authToken, ct0);

      if (!profile) {
        console.log(`${progress} @${handle} \u2014 not found on X`);
        await sql`UPDATE authors SET x_profile_fetched_at = NOW() WHERE handle = ${handle}`;
        skipped++;
      } else {
        await sql`
          UPDATE authors SET
            avatar_url = ${profile.avatarUrl},
            banner_url = ${profile.bannerUrl},
            display_name = COALESCE(${profile.name || null}, display_name),
            bio = ${profile.bio || null},
            location = ${profile.location || null},
            website = ${profile.website},
            verified = ${profile.verified},
            followers = ${profile.followers},
            following = ${profile.following},
            tweet_count = ${profile.tweetCount},
            x_joined_at = ${profile.joined},
            x_profile_fetched_at = NOW()
          WHERE handle = ${handle}
        `;

        const fmtFollowers =
          profile.followers >= 1_000_000
            ? `${(profile.followers / 1_000_000).toFixed(1)}M`
            : profile.followers >= 1_000
              ? `${(profile.followers / 1_000).toFixed(1)}K`
              : String(profile.followers);

        console.log(
          `${progress} @${handle} \u2014 ${profile.name} | ${fmtFollowers} followers | ${profile.verified ? "verified" : ""} | ${profile.location || "no location"} | trades: ${trades}`,
        );
        success++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${progress} @${handle} \u2014 ERROR: ${msg}`);
      failed++;

      if (msg.includes("Rate limited")) {
        console.log("Waiting 60s before continuing...");
        await new Promise((r) => setTimeout(r, 60_000));
      }
    }

    // Rate limit
    if (i < authors.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log("\u2500".repeat(80));
  console.log(
    `\nDone! ${success} fetched, ${skipped} not found, ${failed} failed\n`,
  );
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
