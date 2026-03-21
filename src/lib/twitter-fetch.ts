/**
 * Tweet fetching for bulk caller scan.
 *
 * Feature flag: TWITTER_SCRAPE_MODE
 *   "http"    → Direct GraphQL API via cookies (fast, needs X_AUTH_TOKEN + X_CSRF_TOKEN)
 *   "browser" → xactions Puppeteer stealth scraper (slow, no auth needed)
 *   "auto"    → HTTP if cookies available, else browser (default)
 *
 * Full fallback chain:
 * 1. Twitter API v2 (if TWITTER_BEARER_TOKEN is set)
 * 2. HTTP GraphQL client (if cookies available + mode != "browser")
 * 3. xactions Puppeteer scraper (if mode != "http")
 * 4. Nitter RSS feed
 * 5. Playwright browser scraper (if config/x-session.json exists)
 */

import { existsSync } from "fs";
import { TwitterHttpClient } from "./twitter-http-client";
import type { TwitterTweet, TwitterUser } from "./twitter-http-client";

export interface Tweet {
  id: string;
  text: string;
  created_at: string; // ISO 8601
  url: string;
  author_handle?: string;
  author_name?: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
    views?: number;
  };
}

export interface TwitterProfile {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  followers: number;
  following: number;
  tweetCount: number;
  joined: string | null; // ISO 8601
}

// ─── Feature flag ───────────────────────────────────────────────────────────

type ScrapeMode = "http" | "browser" | "auto";

function getScrapeMode(): ScrapeMode {
  const mode = process.env["TWITTER_SCRAPE_MODE"]?.toLowerCase();
  if (mode === "http" || mode === "browser") return mode;
  return "auto";
}

// ─── Shared HTTP client singleton ───────────────────────────────────────────

let _httpClient: TwitterHttpClient | null = null;

function getHttpClient(): TwitterHttpClient {
  if (!_httpClient) {
    _httpClient = new TwitterHttpClient();
  }
  return _httpClient;
}

function httpClientAvailable(): boolean {
  return getHttpClient().isAuthenticated;
}

// ─── Convert TwitterTweet → Tweet ───────────────────────────────────────────

function toTweet(t: TwitterTweet): Tweet {
  return {
    id: t.id,
    text: t.text,
    created_at: new Date(t.createdAt).toISOString(),
    url: `https://x.com/${t.authorUsername}/status/${t.id}`,
    author_handle: t.authorUsername || undefined,
    author_name: t.authorName || undefined,
    metrics: {
      likes: t.likes,
      retweets: t.retweets,
      replies: t.replies,
      views: t.views,
    },
  };
}

// ---------------------------------------------------------------------------
// Twitter API v2
// ---------------------------------------------------------------------------

async function fetchViaTwitterApi(handle: string, maxTweets: number): Promise<Tweet[]> {
  const token = process.env["TWITTER_BEARER_TOKEN"];
  if (!token) throw new Error("TWITTER_BEARER_TOKEN not configured");

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

    await new Promise((r) => setTimeout(r, 300));
  }

  return tweets.slice(0, maxTweets);
}

// ---------------------------------------------------------------------------
// HTTP GraphQL client (fast path — Swarmsy-style)
// ---------------------------------------------------------------------------

async function fetchViaHttp(handle: string, maxTweets: number): Promise<Tweet[]> {
  const client = getHttpClient();
  if (!client.isAuthenticated) {
    throw new Error("HTTP client not authenticated — set X_AUTH_TOKEN + X_CSRF_TOKEN env vars or provide config/x-session.json");
  }

  const raw = await client.getAllUserTweets(handle, maxTweets);
  return raw.map(toTweet);
}

// ---------------------------------------------------------------------------
// xactions Puppeteer scraper (browser path)
// ---------------------------------------------------------------------------

function parseMetricCount(value: string | null | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned.endsWith("K")) return Math.round(parseFloat(cleaned) * 1_000);
  if (cleaned.endsWith("M")) return Math.round(parseFloat(cleaned) * 1_000_000);
  return parseInt(cleaned, 10) || 0;
}

async function fetchViaXactions(handle: string, maxTweets: number): Promise<Tweet[]> {
  const { createBrowser, createPage, loginWithCookie, scrapeTweets } = await import("xactions");

  const browser = await createBrowser();
  try {
    const page = await createPage(browser);
    const cookie = process.env["XACTIONS_SESSION_COOKIE"];
    if (cookie) await loginWithCookie(page, cookie);
    const raw = await scrapeTweets(page, handle, { limit: maxTweets });

    const tweets: Tweet[] = [];
    for (const t of raw) {
      if (t.isRetweet) continue;
      if (t.text?.startsWith("RT @")) continue;
      if (!t.id || !t.text) continue;

      tweets.push({
        id: t.id,
        text: t.text,
        created_at: t.timestamp || new Date().toISOString(),
        url: t.url || `https://x.com/${handle}/status/${t.id}`,
        author_handle: handle,
        metrics: {
          likes: parseMetricCount(t.likes),
          retweets: parseMetricCount(t.retweets),
          replies: parseMetricCount(t.replies),
        },
      });
    }

    tweets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return tweets.slice(0, maxTweets);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Profile fetching (uses HTTP client or xactions)
// ---------------------------------------------------------------------------

export async function fetchProfile(handle: string): Promise<TwitterProfile | null> {
  const mode = getScrapeMode();

  // Try HTTP client first (unless forced to browser)
  if (mode !== "browser" && httpClientAvailable()) {
    const client = getHttpClient();
    const user = await client.getUser(handle);
    if (user) {
      return {
        handle: user.username,
        displayName: user.name,
        avatarUrl: user.profileImageUrl ?? null,
        bannerUrl: user.bannerUrl ?? null,
        bio: user.bio,
        location: user.location ?? null,
        website: user.website ?? null,
        verified: user.verified,
        followers: user.followersCount,
        following: user.followingCount,
        tweetCount: user.tweetCount,
        joined: user.joined ? user.joined.toISOString() : null,
      };
    }
  }

  // Fall back to xactions Puppeteer
  if (mode !== "http") {
    try {
      const { createBrowser, createPage, loginWithCookie, scrapeProfile } = await import("xactions");
      const browser = await createBrowser();
      try {
        const page = await createPage(browser);
        const cookie = process.env["XACTIONS_SESSION_COOKIE"];
        if (cookie) await loginWithCookie(page, cookie);
        const raw = await scrapeProfile(page, handle);
        if (!raw || (!raw.username && !raw.name)) return null;

        const rawAny = raw as Record<string, unknown>;
        return {
          handle: raw.username || handle,
          displayName: raw.name || null,
          avatarUrl: raw.avatar || null,
          bannerUrl: (rawAny.banner as string) || null,
          bio: raw.bio || null,
          location: (rawAny.location as string) || null,
          website: (rawAny.website as string) || null,
          verified: raw.verified ?? false,
          followers: parseMetricCount(raw.followers),
          following: parseMetricCount(raw.following),
          tweetCount: parseMetricCount(rawAny.tweets as string),
          joined: null,
        };
      } finally {
        await browser.close();
      }
    } catch {
      return null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tweet search (uses HTTP client or xactions)
// ---------------------------------------------------------------------------

export async function searchTweets(query: string, maxResults = 50): Promise<Tweet[]> {
  const mode = getScrapeMode();

  // Try HTTP client first
  if (mode !== "browser" && httpClientAvailable()) {
    const client = getHttpClient();
    const result = await client.search(query, maxResults);
    return result.tweets.map(toTweet);
  }

  // Fall back to xactions Puppeteer
  if (mode !== "http") {
    const { createBrowser, createPage, loginWithCookie, searchTweets: xSearch } = await import("xactions");
    const browser = await createBrowser();
    try {
      const page = await createPage(browser);
      const cookie = process.env["XACTIONS_SESSION_COOKIE"];
      if (cookie) await loginWithCookie(page, cookie);
      const raw = await xSearch(page, query, { limit: maxResults, filter: "latest" });

      return raw
        .filter((t: Record<string, unknown>) => t.id && t.text)
        .map((t: Record<string, unknown>) => ({
          id: t.id as string,
          text: t.text as string,
          created_at: (t.timestamp as string) || new Date().toISOString(),
          url: (t.url as string) || `https://x.com/i/status/${t.id}`,
          author_handle: (t.author as string) || undefined,
          metrics: {
            likes: parseMetricCount(t.likes as string),
            retweets: 0,
            replies: 0,
          },
        }));
    } finally {
      await browser.close();
    }
  }

  throw new Error("[twitter-fetch] Search unavailable — no auth for HTTP mode and browser mode disabled");
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

    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
    if (!titleMatch?.[1]) continue;
    let text = titleMatch[1].trim();

    if (text.startsWith("RT @")) continue;

    text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text || text.length < 10) continue;

    const linkMatch = item.match(/<link>(.*?)<\/link>/);
    const link = linkMatch?.[1]?.trim() ?? "";

    const idMatch = link.match(/\/status\/(\d+)/);
    const id = idMatch?.[1] ?? "";
    if (!id) continue;

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

  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    throw new Error(
      "playwright is not available — install it or use HTTP/xactions fetch methods instead",
    );
  }

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
      const articles = await page.$$('article[data-testid="tweet"]');

      for (const article of articles) {
        try {
          const socialContext = await article.$('[data-testid="socialContext"]');
          if (socialContext) {
            const ctText = await socialContext.textContent();
            if (ctText?.toLowerCase().includes("reposted")) continue;
          }

          const permalink = await article.$('a[href*="/status/"]');
          if (!permalink) continue;
          const href = (await permalink.getAttribute("href")) ?? "";
          const tweetId = href.split("/status/")[1]?.split(/[/?]/)[0] ?? "";
          if (!tweetId || seen.has(tweetId)) continue;

          const textEl = await article.$('[data-testid="tweetText"]');
          const text = ((await textEl?.innerText()) ?? "").trim();

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
  const mode = getScrapeMode();
  const errors: string[] = [];

  // 1. Official API when configured
  if (process.env["TWITTER_BEARER_TOKEN"]) {
    try {
      return await fetchViaTwitterApi(handle, maxTweets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[twitter-fetch] API v2 failed:", msg);
      errors.push(`Twitter API: ${msg}`);
    }
  }

  // 2. HTTP GraphQL (fast path) — unless mode is "browser"
  if (mode !== "browser" && httpClientAvailable()) {
    try {
      console.log(`[twitter-fetch] Using HTTP mode for @${handle}`);
      return await fetchViaHttp(handle, maxTweets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[twitter-fetch] HTTP GraphQL failed:", msg);
      errors.push(`HTTP: ${msg}`);
    }
  }

  // 3. xactions Puppeteer (browser path) — unless mode is "http"
  if (mode !== "http") {
    try {
      console.log(`[twitter-fetch] Using browser mode for @${handle}`);
      return await fetchViaXactions(handle, maxTweets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[twitter-fetch] xactions failed:", msg);
      errors.push(`xactions: ${msg}`);
    }
  }

  // 4. Nitter RSS
  try {
    return await fetchViaNitter(handle, maxTweets);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[twitter-fetch] Nitter failed:", msg);
    errors.push(`Nitter: ${msg}`);
  }

  // 5. Playwright browser scraper
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
