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

  async getUser(username: string): Promise<TwitterUser | null> {
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
