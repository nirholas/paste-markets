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
import { fetchProfile } from "./twitter-fetch";

const sql = neon(process.env.DATABASE_URL!);

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
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
  if (handle.includes(" ")) return false; // "David Patterson", "Bob Sternfels"
  if (handle.includes(".")) return false; // favicon.png
  return true;
}

async function backfill() {
  // Get authors to process
  const condition = force ? "" : "AND x_profile_fetched_at IS NULL";
  const rows = await sql`
    SELECT handle, total_trades
    FROM authors
    WHERE handle IS NOT NULL ${force ? sql`` : sql`AND x_profile_fetched_at IS NULL`}
    ORDER BY total_trades DESC
  `;

  let authors = rows.filter((r) => isValidHandle(r.handle as string));
  if (limit > 0) authors = authors.slice(0, limit);

  console.log(`\nBackfilling X profiles for ${authors.length} authors (delay: ${delay}ms)\n`);
  console.log("─".repeat(70));

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < authors.length; i++) {
    const handle = authors[i].handle as string;
    const trades = authors[i].total_trades as number;
    const progress = `[${i + 1}/${authors.length}]`;

    try {
      const profile = await fetchProfile(handle);

      if (!profile) {
        console.log(`${progress} @${handle} — not found on X`);
        // Mark as fetched so we don't retry every time
        await sql`UPDATE authors SET x_profile_fetched_at = NOW() WHERE handle = ${handle}`;
        skipped++;
        continue;
      }

      await sql`
        UPDATE authors SET
          avatar_url = ${profile.avatarUrl},
          banner_url = ${profile.bannerUrl},
          display_name = COALESCE(${profile.displayName}, display_name),
          bio = ${profile.bio},
          location = ${profile.location},
          website = ${profile.website},
          verified = ${profile.verified},
          followers = ${profile.followers},
          following = ${profile.following},
          tweet_count = ${profile.tweetCount},
          x_joined_at = ${profile.joined},
          x_profile_fetched_at = NOW()
        WHERE handle = ${handle}
      `;

      const followers = profile.followers >= 1000
        ? `${(profile.followers / 1000).toFixed(1)}K`
        : String(profile.followers);

      console.log(
        `${progress} @${handle} — ${profile.displayName || handle} | ${followers} followers | ${profile.verified ? "verified" : "unverified"} | ${profile.location || "no location"} | trades: ${trades}`,
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${progress} @${handle} — ERROR: ${msg}`);
      failed++;
    }

    // Rate limit: wait between requests
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
