/**
 * Batch backfill X profile data for all authors in the database.
 *
 * Fetches avatar, banner, bio, location, website, verified status,
 * follower/following/tweet counts, and join date from X via the
 * agent-twitter-client GraphQL API.
 *
 * Run: npm run backfill:x-profiles
 *
 * Options:
 *   --limit N      Max authors to process (default: all)
 *   --delay MS     Delay between requests in ms (default: 2000)
 *   --force        Re-fetch even if already fetched
 */

import { neon } from "@neondatabase/serverless";
import { Scraper } from "agent-twitter-client";

const sql = neon(process.env.DATABASE_URL!);

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

async function createScraper(): Promise<Scraper> {
  const scraper = new Scraper();
  const authToken = process.env["TWITTER_AUTH_TOKEN"];
  const ct0 = process.env["TWITTER_CT0"];

  if (!authToken || !ct0) {
    throw new Error("TWITTER_AUTH_TOKEN and TWITTER_CT0 must be set in .env.local");
  }

  await scraper.setCookies([
    `auth_token=${authToken}; Domain=.twitter.com; Path=/; Secure; HttpOnly`,
    `ct0=${ct0}; Domain=.twitter.com; Path=/; Secure`,
  ]);

  return scraper;
}

async function backfill() {
  const scraper = await createScraper();

  // Get authors to process
  const rows = force
    ? await sql`SELECT handle, total_trades FROM authors WHERE handle IS NOT NULL ORDER BY total_trades DESC`
    : await sql`SELECT handle, total_trades FROM authors WHERE handle IS NOT NULL AND x_profile_fetched_at IS NULL ORDER BY total_trades DESC`;

  let authors = rows.filter((r) => isValidHandle(r.handle as string));
  if (limit > 0) authors = authors.slice(0, limit);

  console.log(`\nBackfilling X profiles for ${authors.length} authors (delay: ${delay}ms)\n`);
  console.log("─".repeat(70));

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < authors.length; i++) {
    const handle = authors[i]!.handle as string;
    const trades = authors[i]!.total_trades as number;
    const progress = `[${i + 1}/${authors.length}]`;

    try {
      const profile = await scraper.getProfile(handle);

      if (!profile || !profile.username) {
        console.log(`${progress} @${handle} — not found on X`);
        await sql`UPDATE authors SET x_profile_fetched_at = NOW() WHERE handle = ${handle}`;
        skipped++;
      } else {
        const avatarUrl = profile.avatar ?? null;
        const bannerUrl = profile.banner ?? null;
        const displayName = profile.name ?? null;
        const bio = profile.biography ?? null;
        const location = profile.location ?? null;
        const website = profile.website ?? null;
        const verified = profile.isBlueVerified ?? profile.isVerified ?? false;
        const followers = profile.followersCount ?? 0;
        const following = profile.followingCount ?? 0;
        const tweetCount = profile.tweetsCount ?? 0;
        const joined = profile.joined ? profile.joined.toISOString() : null;

        await sql`
          UPDATE authors SET
            avatar_url = ${avatarUrl},
            banner_url = ${bannerUrl},
            display_name = COALESCE(${displayName}, display_name),
            bio = ${bio},
            location = ${location},
            website = ${website},
            verified = ${verified},
            followers = ${followers},
            following = ${following},
            tweet_count = ${tweetCount},
            x_joined_at = ${joined},
            x_profile_fetched_at = NOW()
          WHERE handle = ${handle}
        `;

        const fmtFollowers = followers >= 1000
          ? `${(followers / 1000).toFixed(1)}K`
          : String(followers);

        console.log(
          `${progress} @${handle} — ${displayName || handle} | ${fmtFollowers} followers | ${verified ? "verified" : ""} | ${location || "no location"} | trades: ${trades}`,
        );
        success++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${progress} @${handle} — ERROR: ${msg}`);
      failed++;
    }

    // Rate limit
    if (i < authors.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log("─".repeat(70));
  console.log(`\nDone! ${success} fetched, ${skipped} not found, ${failed} failed\n`);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
