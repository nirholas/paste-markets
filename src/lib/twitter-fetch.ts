/**
 * Tweet fetching for bulk caller scan.
 *
 * Strategy (in order):
 * 1. Twitter API v2 (if TWITTER_BEARER_TOKEN is set)
 * 2. Nitter RSS feed (public, no auth required) — tries multiple instances
 * 3. Playwright browser scraper (if config/x-session.json exists)
 */

import { existsSync } from "fs";

export interface Tweet {
  id: string;
  text: string;
  created_at: string; // ISO 8601
  url: string;
}

// ---------------------------------------------------------------------------
// Twitter API v2
// ---------------------------------------------------------------------------

async function fetchViaTwitterApi(handle: string, maxTweets: number): Promise<Tweet[]> {
  const token = process.env["TWITTER_BEARER_TOKEN"];
  if (!token) throw new Error("TWITTER_BEARER_TOKEN not configured");

  // Resolve username → user ID
  const userRes = await fetch(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!userRes.ok) {
    throw new Error(`Twitter user lookup failed: ${userRes.status} ${userRes.statusText}`);
  }
  const userData = (await userRes.json()) as { data?: { id: string } };
  const userId = userData.data?.id;
  if (!userId) throw new Error(`Twitter user not found: @${handle}`);

  // Paginate timeline
  const tweets: Tweet[] = [];
  let nextToken: string | undefined;

  while (tweets.length < maxTweets) {
    const url = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("tweet.fields", "created_at,text");
    url.searchParams.set("exclude", "retweets,replies");
    if (nextToken) url.searchParams.set("pagination_token", nextToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) break;

    const data = (await res.json()) as {
      data?: Array<{ id: string; text: string; created_at: string }>;
      meta?: { next_token?: string };
    };

    for (const t of data.data ?? []) {
      tweets.push({
        id: t.id,
        text: t.text,
        created_at: t.created_at,
        url: `https://x.com/${handle}/status/${t.id}`,
      });
    }

    nextToken = data.meta?.next_token;
    if (!nextToken || tweets.length >= maxTweets) break;

    // Small pause to stay within rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  return tweets.slice(0, maxTweets);
}

// ---------------------------------------------------------------------------
// Nitter RSS fallback
// ---------------------------------------------------------------------------

const NITTER_INSTANCES = [
  "https://nitter.net",
  "https://nitter.cz",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
];

function parseNitterRss(xml: string, handle: string): Tweet[] {
  const tweets: Tweet[] = [];

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1] ?? "";

    // Title = tweet text (CDATA wrapped)
    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
    if (!titleMatch?.[1]) continue;
    let text = titleMatch[1].trim();

    // Skip retweets
    if (text.startsWith("RT @")) continue;

    // Strip any HTML tags that might be in the CDATA
    text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text || text.length < 10) continue;

    // Link
    const linkMatch = item.match(/<link>(.*?)<\/link>/);
    const link = linkMatch?.[1]?.trim() ?? "";

    // Tweet ID from URL
    const idMatch = link.match(/\/status\/(\d+)/);
    const id = idMatch?.[1] ?? "";
    if (!id) continue;

    // Date
    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    let created_at = new Date().toISOString();
    if (dateMatch?.[1]) {
      try {
        created_at = new Date(dateMatch[1].trim()).toISOString();
      } catch {
        // keep default
      }
    }

    tweets.push({
      id,
      text,
      created_at,
      url: `https://x.com/${handle}/status/${id}`,
    });
  }

  return tweets;
}

async function fetchViaNitter(handle: string, maxTweets: number): Promise<Tweet[]> {
  const errors: string[] = [];

  for (const instance of NITTER_INSTANCES) {
    try {
      const res = await fetch(`${instance}/${encodeURIComponent(handle)}/rss`, {
        headers: { "User-Agent": "paste.markets/1.0 (bulk-scan)" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        errors.push(`${instance}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const tweets = parseNitterRss(xml, handle);
      if (tweets.length > 0) {
        return tweets.slice(0, maxTweets);
      }
      errors.push(`${instance}: 0 tweets parsed`);
    } catch (err) {
      errors.push(`${instance}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`All Nitter instances failed: ${errors.join("; ")}`);
}

// ---------------------------------------------------------------------------
// Playwright browser scraper fallback
// ---------------------------------------------------------------------------

const SESSION_PATH = "./config/x-session.json";

async function fetchViaBrowser(handle: string, maxTweets: number): Promise<Tweet[]> {
  if (!existsSync(SESSION_PATH)) {
    throw new Error(
      "No X session file found at config/x-session.json — run the session export script first",
    );
  }

  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      storageState: SESSION_PATH,
    });

    const page = await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(`https://x.com/${handle}`, { waitUntil: "domcontentloaded" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("/i/flow")) {
      throw new Error(
        "X session expired — re-export session using browser-scripts/export-session-devtools.js",
      );
    }

    const seen = new Map<string, Tweet>();
    let idleCount = 0;
    let lastCount = 0;
    const MAX_SCROLLS = 300;
    const IDLE_LIMIT = 15;

    for (let i = 0; i < MAX_SCROLLS && seen.size < maxTweets; i++) {
      // Extract visible tweets
      const articles = await page.$$('article[data-testid="tweet"]');

      for (const article of articles) {
        try {
          // Skip retweets
          const socialContext = await article.$('[data-testid="socialContext"]');
          if (socialContext) {
            const ctText = await socialContext.textContent();
            if (ctText?.toLowerCase().includes("reposted")) continue;
          }

          // Tweet ID from permalink
          const permalink = await article.$('a[href*="/status/"]');
          if (!permalink) continue;
          const href = (await permalink.getAttribute("href")) ?? "";
          const tweetId = href.split("/status/")[1]?.split(/[/?]/)[0] ?? "";
          if (!tweetId || seen.has(tweetId)) continue;

          // Tweet text
          const textEl = await article.$('[data-testid="tweetText"]');
          const text = ((await textEl?.innerText()) ?? "").trim();

          // Timestamp
          const timeEl = await article.$("time[datetime]");
          const created_at =
            ((await timeEl?.getAttribute("datetime")) ?? "") || new Date().toISOString();

          seen.set(tweetId, {
            id: tweetId,
            text,
            created_at,
            url: `https://x.com/${handle}/status/${tweetId}`,
          });

          if (seen.size >= maxTweets) break;
        } catch {
          // skip malformed article
        }
      }

      if (seen.size === lastCount) {
        idleCount++;
      } else {
        idleCount = 0;
        lastCount = seen.size;
      }

      if (idleCount >= IDLE_LIMIT) break;

      await page.evaluate(() => window.scrollBy(0, 1200));
      await new Promise((r) => setTimeout(r, 800));
    }

    return Array.from(seen.values()).slice(0, maxTweets);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function fetchUserTweets(handle: string, maxTweets = 200): Promise<Tweet[]> {
  const errors: string[] = [];

  // Prefer official API when configured
  if (process.env["TWITTER_BEARER_TOKEN"]) {
    try {
      return await fetchViaTwitterApi(handle, maxTweets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[twitter-fetch] API v2 failed:", msg);
      errors.push(`Twitter API: ${msg}`);
    }
  }

  // Try Nitter RSS
  try {
    return await fetchViaNitter(handle, maxTweets);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[twitter-fetch] Nitter failed:", msg);
    errors.push(`Nitter: ${msg}`);
  }

  // Try Playwright browser scraper (only if session file exists)
  if (existsSync(SESSION_PATH)) {
    try {
      return await fetchViaBrowser(handle, maxTweets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[twitter-fetch] Browser scraper failed:", msg);
      errors.push(`Browser: ${msg}`);
    }
  }

  throw new Error(`[twitter-fetch] All methods failed for @${handle}: ${errors.join(" | ")}`);
}
