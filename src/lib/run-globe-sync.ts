/**
 * Standalone globe sync script.
 * Pulls all authors from paste.trade, checks DB for locations, geocodes.
 *
 * Usage: npx tsx src/lib/run-globe-sync.ts
 */

import { neon } from "@neondatabase/serverless";
import { geocode } from "./geocode";

const sql = neon(process.env.DATABASE_URL!);

const PASTE_BASE = "https://paste.trade";

interface LeaderboardAuthor {
  author: { handle: string; name: string | null; avatar_url: string; platform: string };
  stats: Record<string, unknown>;
}

async function fetchLeaderboard(window: string): Promise<LeaderboardAuthor[]> {
  try {
    const url = `${PASTE_BASE}/api/leaderboard?window=${window}&sort=avg_pnl&limit=200`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { authors?: LeaderboardAuthor[] };
    return data.authors ?? [];
  } catch {
    return [];
  }
}

async function fetchFeedAuthors(sort: string, window: string): Promise<Map<string, { name: string | null; avatar: string | null }>> {
  const map = new Map<string, { name: string | null; avatar: string | null }>();
  try {
    const url = `${PASTE_BASE}/api/feed?sort=${sort}&window=${window}&limit=100`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return map;
    const data = await res.json() as { items?: Array<{ author?: Record<string, unknown> }> };
    for (const item of data.items ?? []) {
      const handle = item.author?.["handle"];
      if (handle && typeof handle === "string") {
        map.set(handle, {
          name: (item.author?.["name"] as string) ?? null,
          avatar: (item.author?.["avatar_url"] as string) ?? null,
        });
      }
    }
  } catch {
    // ignore
  }
  return map;
}

async function main() {
  console.log("=== Globe Sync: Pulling all paste.trade authors ===\n");

  // 1. Collect all unique authors from paste.trade
  const authors = new Map<string, { name: string | null; avatar: string | null }>();

  for (const window of ["7d", "30d", "all"]) {
    const lb = await fetchLeaderboard(window);
    console.log(`  leaderboard/${window}: ${lb.length} authors`);
    for (const a of lb) {
      if (a.author?.handle) {
        authors.set(a.author.handle, { name: a.author.name, avatar: a.author.avatar_url });
      }
    }
  }

  for (const [sort, window] of [["new", "30d"], ["top", "7d"], ["top", "30d"]] as const) {
    const feedAuthors = await fetchFeedAuthors(sort, window);
    console.log(`  feed/${sort}/${window}: ${feedAuthors.size} authors`);
    for (const [handle, meta] of feedAuthors) {
      if (!authors.has(handle)) authors.set(handle, meta);
    }
  }

  console.log(`\n  Total unique authors from paste.trade: ${authors.size}\n`);

  // 2. Ensure all authors exist in DB
  let newCount = 0;
  for (const [handle, meta] of authors) {
    const rows = await sql`SELECT handle FROM authors WHERE handle = ${handle}`;
    if (rows.length === 0) {
      await sql`
        INSERT INTO authors (handle, display_name, avatar_url)
        VALUES (${handle}, ${meta.name}, ${meta.avatar})
        ON CONFLICT (handle) DO NOTHING
      `;
      newCount++;
    }
  }
  console.log(`  New authors added to DB: ${newCount}`);

  // 3. Check existing locations in DB
  const allHandles = Array.from(authors.keys());
  const dbRows = await sql`
    SELECT handle, location, lat, lng FROM authors
    WHERE handle = ANY(${allHandles})
  ` as Array<{ handle: string; location: string | null; lat: number | null; lng: number | null }>;

  let alreadyGeocoded = 0;
  let newlyGeocoded = 0;
  const needsScrape: string[] = [];
  const unresolvable: Record<string, string> = {};

  for (const row of dbRows) {
    if (row.lat != null && row.lng != null) {
      alreadyGeocoded++;
      continue;
    }

    if (row.location) {
      const coord = geocode(row.location);
      if (coord) {
        await sql`UPDATE authors SET lat = ${coord.lat}, lng = ${coord.lng} WHERE handle = ${row.handle}`;
        newlyGeocoded++;
        console.log(`  Geocoded: @${row.handle} "${row.location}" → ${coord.label} (${coord.lat}, ${coord.lng})`);
      } else {
        unresolvable[row.handle] = row.location;
      }
    } else {
      needsScrape.push(row.handle);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`  Already geocoded:  ${alreadyGeocoded}`);
  console.log(`  Newly geocoded:    ${newlyGeocoded}`);
  console.log(`  Needs X scrape:    ${needsScrape.length}`);
  console.log(`  Unresolvable:      ${Object.keys(unresolvable).length}`);

  if (needsScrape.length > 0) {
    console.log(`\n=== Handles needing X profile location scrape (${needsScrape.length}) ===`);
    console.log(needsScrape.map(h => `@${h}`).join(", "));

    // Print browser console scraper script
    console.log(`\n=== Browser Console Scraper ===`);
    console.log(`Paste this into your browser console on x.com to scrape locations:\n`);
    console.log(`// Open each profile and grab the location`);
    console.log(`const handles = ${JSON.stringify(needsScrape)};`);
    console.log(`const results = {};`);
    console.log(`for (const h of handles) {`);
    console.log(`  try {`);
    console.log(`    const res = await fetch(\`https://x.com/i/api/graphql/xmU6X_CKVnQ5lSrCbAmJsg/UserByScreenName?variables=\${encodeURIComponent(JSON.stringify({screen_name: h}))}&features=\${encodeURIComponent(JSON.stringify({hidden_profile_subscriptions_enabled:true,rweb_tipjar_consumption_enabled:true,responsive_web_graphql_exclude_directive_enabled:true,verified_phone_label_enabled:false,subscriptions_verification_info_is_identity_verified_enabled:true,subscriptions_verification_info_verified_since_enabled:true,highlights_tweets_tab_ui_enabled:true,responsive_web_twitter_article_notes_tab_enabled:true,subscriptions_feature_can_gift_premium:true,creator_subscriptions_tweet_preview_api_enabled:true,responsive_web_graphql_skip_user_profile_image_extensions_enabled:false,responsive_web_graphql_timeline_navigation_enabled:true}))}\`, {`);
    console.log(`      headers: { 'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA', 'x-csrf-token': document.cookie.match(/ct0=([^;]+)/)?.[1] },`);
    console.log(`      credentials: 'include'`);
    console.log(`    });`);
    console.log(`    const data = await res.json();`);
    console.log(`    const loc = data?.data?.user?.result?.legacy?.location || null;`);
    console.log(`    if (loc) results[h] = loc;`);
    console.log(`    console.log(\`@\${h}: \${loc || '(no location)'}\`);`);
    console.log(`    await new Promise(r => setTimeout(r, 1500));`);
    console.log(`  } catch(e) { console.error(\`@\${h}: failed\`, e); }`);
    console.log(`}`);
    console.log(`console.log('\\n=== COPY THIS ===');`);
    console.log(`console.log(JSON.stringify(results, null, 2));`);
    console.log(`console.log('\\nThen POST to: curl -X POST http://localhost:3000/api/globe/sync -H "Content-Type: application/json" -d \\'{\"locations\": ' + JSON.stringify(results) + '}\\''  );`);
  }

  if (Object.keys(unresolvable).length > 0) {
    console.log(`\n=== Unresolvable locations (need manual mapping) ===`);
    for (const [handle, loc] of Object.entries(unresolvable)) {
      console.log(`  @${handle}: "${loc}"`);
    }
  }
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
