/**
 * twitter-http-client.ts — Twitter HTTP client via agent-twitter-client
 *
 * Uses the same Scraper class that Swarmsy/xactions uses internally.
 * No browser needed — GraphQL API calls over HTTP.
 *
 * Auth: TWITTER_AUTH_TOKEN + TWITTER_CT0 (cookie-based, same as Swarmsy)
 * Proxy: PROXY_URL — optional rotating proxy (http://user:pass@host:port)
 */

import { Scraper, SearchMode } from "agent-twitter-client";
import { HttpsProxyAgent } from "https-proxy-agent";

// ─── Types (re-exported for compatibility) ───────────────────────────────────

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  verified: boolean;
  profileImageUrl?: string;
  bannerUrl?: string;
  location?: string;
  website?: string;
  joined?: Date;
}

export interface TwitterTweet {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  createdAt: number;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  bookmarks: number;
  isReply: boolean;
  isRetweet: boolean;
  isQuote: boolean;
  quotedTweetId?: string;
  inReplyToId?: string;
  mediaUrls: string[];
  language?: string;
}

export interface SearchResult {
  tweets: TwitterTweet[];
  cursor?: string;
}

// ─── Build scraper options (proxy if configured) ─────────────────────────────

function buildScraper(): Scraper {
  const proxyUrl = process.env["PROXY_URL"];

  if (proxyUrl) {
    const agent = new HttpsProxyAgent(proxyUrl);
    return new Scraper({
      transform: {
        request: (input: RequestInfo | URL, init?: RequestInit) => {
          return [input, { ...init, agent } as RequestInit];
        },
      },
    });
  }

  return new Scraper();
}

// ─── Direct GraphQL fallback (bypasses outdated library query hashes) ────────

const BEARER =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const USER_BY_SCREEN_NAME_FEATURES = {
  hidden_profile_subscriptions_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
};

async function directGraphQLGetUser(
  username: string,
  authToken: string,
  ct0: string,
): Promise<TwitterUser | null> {
  const variables = JSON.stringify({ screen_name: username });
  const features = JSON.stringify(USER_BY_SCREEN_NAME_FEATURES);
  const url = `https://x.com/i/api/graphql/xc8f1g7BYqr6VTzTbvNlGw/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: BEARER,
      Cookie: `auth_token=${authToken}; ct0=${ct0}`,
      "x-csrf-token": ct0,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      "User-Agent": BROWSER_UA,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    data?: {
      user?: {
        result?: {
          rest_id?: string;
          is_blue_verified?: boolean;
          legacy?: Record<string, unknown>;
        };
      };
    };
  };

  const result = data?.data?.user?.result;
  const legacy = result?.legacy;
  if (!legacy) return null;

  const joinedStr = legacy["created_at"] as string | undefined;

  return {
    id: (result?.rest_id as string) ?? "",
    username: (legacy["screen_name"] as string) ?? username,
    name: (legacy["name"] as string) ?? "",
    bio: (legacy["description"] as string) ?? "",
    followersCount: (legacy["followers_count"] as number) ?? 0,
    followingCount: (legacy["friends_count"] as number) ?? 0,
    tweetCount: (legacy["statuses_count"] as number) ?? 0,
    verified: result?.is_blue_verified ?? false,
    profileImageUrl: ((legacy["profile_image_url_https"] as string) ?? "").replace(
      "_normal",
      "_400x400",
    ),
    bannerUrl: (legacy["profile_banner_url"] as string) ?? undefined,
    location: (legacy["location"] as string) ?? undefined,
    website:
      ((legacy["entities"] as Record<string, unknown>)?.["url"] as Record<string, unknown>)?.["urls"] instanceof Array
        ? (((legacy["entities"] as Record<string, unknown>)?.["url"] as Record<string, unknown>)?.["urls"] as Array<Record<string, unknown>>)?.[0]?.["expanded_url"] as string | undefined
        : undefined,
    joined: joinedStr ? new Date(joinedStr) : undefined,
  };
}

async function directGraphQLCheckSession(
  authToken: string,
  ct0: string,
): Promise<boolean> {
  // Lightweight check: fetch a known user to verify auth
  const variables = JSON.stringify({ screen_name: "x" });
  const features = JSON.stringify(USER_BY_SCREEN_NAME_FEATURES);
  const url = `https://x.com/i/api/graphql/xc8f1g7BYqr6VTzTbvNlGw/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: BEARER,
        Cookie: `auth_token=${authToken}; ct0=${ct0}`,
        "x-csrf-token": ct0,
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
      },
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class TwitterHttpClient {
  private scraper: Scraper;
  private _authenticated = false;

  constructor() {
    this.scraper = buildScraper();
  }

  get isAuthenticated(): boolean {
    return this._authenticated;
  }

  async authenticate(): Promise<void> {
    if (this._authenticated) return;

    const authToken = process.env["TWITTER_AUTH_TOKEN"];
    const ct0 = process.env["TWITTER_CT0"];

    if (!authToken || !ct0) return;

    // Set cookies the same way Swarmsy does
    await this.scraper.setCookies([
      `auth_token=${authToken}; Domain=.twitter.com; Path=/; Secure; HttpOnly`,
      `ct0=${ct0}; Domain=.twitter.com; Path=/; Secure`,
    ]);

    this._authenticated = true;
  }

  /**
   * Verify the X session is actually valid (tokens not expired/revoked).
   * Returns status without exposing any token values.
   */
  async checkSession(): Promise<{
    configured: boolean;
    authenticated: boolean;
    sessionValid: boolean;
  }> {
    const authToken = process.env["TWITTER_AUTH_TOKEN"];
    const ct0 = process.env["TWITTER_CT0"];
    const configured = !!(authToken && ct0);

    if (!configured) {
      return { configured: false, authenticated: false, sessionValid: false };
    }

    // Use direct GraphQL check (library's isLoggedIn uses outdated endpoints)
    try {
      const sessionValid = await directGraphQLCheckSession(authToken, ct0);
      return { configured: true, authenticated: true, sessionValid };
    } catch {
      return { configured: true, authenticated: true, sessionValid: false };
    }
  }

  async getUser(username: string): Promise<TwitterUser | null> {
    const authToken = process.env["TWITTER_AUTH_TOKEN"];
    const ct0 = process.env["TWITTER_CT0"];

    // Primary: direct GraphQL (works with current X API)
    if (authToken && ct0) {
      try {
        const user = await directGraphQLGetUser(username, authToken, ct0);
        if (user) return user;
      } catch {
        // fall through to library
      }
    }

    // Fallback: agent-twitter-client library (may have outdated query hashes)
    try {
      await this.authenticate();
      const profile = await this.scraper.getProfile(username);
      if (!profile) return null;

      return {
        id: profile.userId ?? "",
        username: profile.username ?? username,
        name: profile.name ?? "",
        bio: profile.biography ?? "",
        followersCount: profile.followersCount ?? 0,
        followingCount: profile.followingCount ?? 0,
        tweetCount: profile.tweetsCount ?? 0,
        verified: profile.isBlueVerified ?? profile.isVerified ?? false,
        profileImageUrl: profile.avatar ?? undefined,
        bannerUrl: profile.banner ?? undefined,
        location: profile.location ?? undefined,
        website: profile.website ?? undefined,
        joined: profile.joined ?? undefined,
      };
    } catch {
      return null;
    }
  }

  async getAllUserTweets(username: string, maxTweets: number): Promise<TwitterTweet[]> {
    await this.authenticate();

    const results: TwitterTweet[] = [];

    for await (const tweet of this.scraper.getTweets(username, maxTweets)) {
      if (!tweet.id || tweet.isRetweet) continue;

      results.push({
        id: tweet.id,
        text: tweet.text ?? "",
        authorId: tweet.userId ?? "",
        authorUsername: tweet.username ?? username,
        authorName: tweet.name ?? "",
        createdAt: tweet.timestamp ? tweet.timestamp * 1000 : Date.now(),
        likes: tweet.likes ?? 0,
        retweets: tweet.retweets ?? 0,
        replies: tweet.replies ?? 0,
        views: tweet.views ?? 0,
        bookmarks: tweet.bookmarkCount ?? 0,
        isReply: tweet.isReply ?? false,
        isRetweet: tweet.isRetweet ?? false,
        isQuote: tweet.isQuoted ?? false,
        quotedTweetId: tweet.quotedStatusId ?? undefined,
        inReplyToId: tweet.inReplyToStatusId ?? undefined,
        mediaUrls: (tweet.photos ?? []).map((p: { url: string }) => p.url),
        language: undefined,
      });

      if (results.length >= maxTweets) break;
    }

    return results;
  }

  async search(query: string, maxResults = 20): Promise<SearchResult> {
    await this.authenticate();

    const tweets: TwitterTweet[] = [];

    for await (const tweet of this.scraper.searchTweets(query, maxResults, SearchMode.Latest)) {
      if (!tweet.id) continue;

      tweets.push({
        id: tweet.id,
        text: tweet.text ?? "",
        authorId: tweet.userId ?? "",
        authorUsername: tweet.username ?? "",
        authorName: tweet.name ?? "",
        createdAt: tweet.timestamp ? tweet.timestamp * 1000 : Date.now(),
        likes: tweet.likes ?? 0,
        retweets: tweet.retweets ?? 0,
        replies: tweet.replies ?? 0,
        views: tweet.views ?? 0,
        bookmarks: tweet.bookmarkCount ?? 0,
        isReply: tweet.isReply ?? false,
        isRetweet: tweet.isRetweet ?? false,
        isQuote: tweet.isQuoted ?? false,
        mediaUrls: (tweet.photos ?? []).map((p: { url: string }) => p.url),
        language: undefined,
      });

      if (tweets.length >= maxResults) break;
    }

    return { tweets };
  }
}
