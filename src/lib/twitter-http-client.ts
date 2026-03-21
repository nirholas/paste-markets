/**
 * twitter-http-client.ts — Twitter GraphQL API Client
 *
 * Direct HTTP calls to Twitter's internal GraphQL API.
 * No browser needed — 10x faster than Puppeteer for read operations.
 * Uses the public bearer token embedded in Twitter's web client JS.
 *
 * Copied from xactions/src/http-client.ts for standalone use in paste-dashboard.
 *
 * Auth: requires auth_token + ct0 cookies from an exported session.
 * Set via env vars X_AUTH_TOKEN + X_CSRF_TOKEN, or load from session file.
 */

import { readFileSync, existsSync } from "fs";

// ─── Twitter API Constants ──────────────────────────────────────────────────

const GRAPHQL_BASE = "https://x.com/i/api/graphql";

/** Public bearer token embedded in Twitter's web client JS bundle */
const BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

/** GraphQL query IDs — these change when Twitter deploys new bundles */
const GRAPHQL = {
  UserByScreenName: { queryId: "NimuplG1OB7Fd2btCLdBOw", operationName: "UserByScreenName" },
  UserTweets:       { queryId: "QWF3SzpHmykQHsQMixG0cg", operationName: "UserTweets" },
  SearchTimeline:   { queryId: "flaR-PUMshxFWZWPNpq4zA", operationName: "SearchTimeline" },
} as const;

/** Feature flags required by Twitter's GraphQL API */
const DEFAULT_FEATURES: Record<string, boolean> = {
  rweb_video_screen_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  articles_preview_enabled: true,
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
];

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Client ─────────────────────────────────────────────────────────────────

const SESSION_PATHS = [
  "./config/x-session.json",
  "../xactions/config/x-session.json",
];

export class TwitterHttpClient {
  private authToken = "";
  private csrfToken = "";
  private cookies: Record<string, string> = {};
  private userAgent: string;
  private maxRetries: number;
  private waitOnRateLimit: boolean;

  constructor(options: { sessionPath?: string; maxRetries?: number; rateLimitStrategy?: "wait" | "error" } = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.waitOnRateLimit = options.rateLimitStrategy !== "error";
    this.userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    // Try env vars first
    const envAuth = process.env["X_AUTH_TOKEN"];
    const envCsrf = process.env["X_CSRF_TOKEN"];
    if (envAuth && envCsrf) {
      this.authToken = envAuth;
      this.csrfToken = envCsrf;
      this.cookies["auth_token"] = envAuth;
      this.cookies["ct0"] = envCsrf;
      return;
    }

    // Then try session files
    const sessionPath = options.sessionPath;
    const paths = sessionPath ? [sessionPath] : SESSION_PATHS;
    for (const p of paths) {
      if (existsSync(p)) {
        this.loadSession(p);
        if (this.isAuthenticated) break;
      }
    }
  }

  get isAuthenticated(): boolean {
    return !!this.authToken && !!this.csrfToken;
  }

  private loadSession(path: string): void {
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as {
        cookies?: Array<{ name: string; value: string }>;
      };

      for (const cookie of raw.cookies ?? []) {
        this.cookies[cookie.name] = cookie.value;
        if (cookie.name === "auth_token") this.authToken = cookie.value;
        if (cookie.name === "ct0") this.csrfToken = cookie.value;
      }
    } catch {
      // silently skip bad session files
    }
  }

  // ─── Core Request ───────────────────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": this.userAgent,
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
    };

    if (this.csrfToken) {
      headers["x-csrf-token"] = this.csrfToken;
    }

    const cookieStr = Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    if (cookieStr) {
      headers["Cookie"] = cookieStr;
    }

    return headers;
  }

  private async request<T>(url: string, options: { method?: string; body?: string } = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: options.method ?? "GET",
          headers: this.buildHeaders(),
          body: options.body,
          signal: AbortSignal.timeout(15_000),
        });

        if (res.status === 429) {
          const resetHeader = res.headers.get("x-rate-limit-reset");
          const resetAt = resetHeader ? parseInt(resetHeader, 10) * 1000 : Date.now() + 60_000;

          if (this.waitOnRateLimit) {
            const waitMs = Math.max(resetAt - Date.now(), 1000);
            console.warn(`[twitter-http] Rate limited — waiting ${Math.round(waitMs / 1000)}s`);
            await sleep(waitMs);
            continue;
          } else {
            throw new Error(`Rate limited, resets at ${new Date(resetAt).toISOString()}`);
          }
        }

        if (res.status === 401 || res.status === 403) {
          throw new Error(`Auth error ${res.status} — session may be expired`);
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => "unknown");
          throw new Error(`Twitter API ${res.status}: ${errText.slice(0, 200)}`);
        }

        return (await res.json()) as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries - 1) {
          const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await sleep(backoff);
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  // ─── GraphQL Helpers ────────────────────────────────────────────────────

  private buildGraphQLUrl(
    endpoint: { queryId: string; operationName: string },
    variables: Record<string, unknown>,
  ): string {
    const params = new URLSearchParams();
    params.set("variables", JSON.stringify(variables));
    params.set("features", JSON.stringify(DEFAULT_FEATURES));
    return `${GRAPHQL_BASE}/${endpoint.queryId}/${endpoint.operationName}?${params.toString()}`;
  }

  private async graphqlGet<T>(
    endpoint: { queryId: string; operationName: string },
    variables: Record<string, unknown>,
  ): Promise<T> {
    const url = this.buildGraphQLUrl(endpoint, variables);
    return this.request<T>(url);
  }

  // ─── Public Methods ───────────────────────────────────────────────────

  async getUser(username: string): Promise<TwitterUser | null> {
    try {
      const data = await this.graphqlGet<{ data?: { user?: { result?: Record<string, unknown> } } }>(
        GRAPHQL.UserByScreenName,
        { screen_name: username, withSafetyModeUserFields: false },
      );

      const user = data?.data?.user?.result as Record<string, unknown> | undefined;
      if (!user) return null;

      const legacy = user.legacy as Record<string, unknown> | undefined;
      return {
        id: user.rest_id as string,
        username: (legacy?.screen_name as string) ?? username,
        name: (legacy?.name as string) ?? "",
        bio: (legacy?.description as string) ?? "",
        followersCount: (legacy?.followers_count as number) ?? 0,
        followingCount: (legacy?.friends_count as number) ?? 0,
        tweetCount: (legacy?.statuses_count as number) ?? 0,
        verified: !!(user.is_blue_verified ?? legacy?.verified),
        profileImageUrl: legacy?.profile_image_url_https as string | undefined,
      };
    } catch {
      return null;
    }
  }

  async getUserTweets(userId: string, count = 20, cursor?: string): Promise<SearchResult> {
    const variables: Record<string, unknown> = {
      userId,
      count,
      includePromotedContent: false,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true,
    };
    if (cursor) variables.cursor = cursor;

    const data = await this.graphqlGet<Record<string, unknown>>(GRAPHQL.UserTweets, variables);
    return this.parseTimelineResponse(data);
  }

  async search(query: string, count = 20, product: "Top" | "Latest" | "People" | "Media" = "Latest", cursor?: string): Promise<SearchResult> {
    const variables: Record<string, unknown> = {
      rawQuery: query,
      count,
      querySource: "typed_query",
      product,
    };
    if (cursor) variables.cursor = cursor;

    const data = await this.graphqlGet<Record<string, unknown>>(GRAPHQL.SearchTimeline, variables);
    return this.parseTimelineResponse(data);
  }

  /**
   * Paginate through all of a user's tweets up to maxTweets.
   * This is the fast path — ~20 tweets per request, pure HTTP, no browser.
   */
  async getAllUserTweets(username: string, maxTweets: number): Promise<TwitterTweet[]> {
    const user = await this.getUser(username);
    if (!user) throw new Error(`User @${username} not found`);

    const allTweets: TwitterTweet[] = [];
    let cursor: string | undefined;

    while (allTweets.length < maxTweets) {
      const batch = await this.getUserTweets(user.id, Math.min(20, maxTweets - allTweets.length), cursor);

      if (batch.tweets.length === 0) break;

      for (const t of batch.tweets) {
        if (!t.isRetweet) {
          allTweets.push(t);
        }
      }

      cursor = batch.cursor;
      if (!cursor) break;

      // Small pause between pages to avoid rate limits
      await sleep(250);
    }

    return allTweets.slice(0, maxTweets);
  }

  // ─── Response Parsing ───────────────────────────────────────────────────

  private parseTimelineResponse(data: Record<string, unknown>): SearchResult {
    const tweets: TwitterTweet[] = [];
    let nextCursor: string | undefined;

    try {
      const instructions = this.findInstructions(data);

      for (const instruction of instructions) {
        const inst = instruction as Record<string, unknown>;
        const entries = inst.entries as Array<Record<string, unknown>> | undefined;
        if (!entries) continue;

        for (const entry of entries) {
          const entryId = entry.entryId as string | undefined;

          if (entryId?.startsWith("cursor-bottom")) {
            const content = entry.content as Record<string, unknown>;
            nextCursor = content?.value as string | undefined;
            continue;
          }

          const tweet = this.extractTweetFromEntry(entry);
          if (tweet) tweets.push(tweet);
        }
      }
    } catch {
      // parse error — return whatever we have
    }

    return { tweets, cursor: nextCursor };
  }

  private findInstructions(data: Record<string, unknown>): unknown[] {
    const paths = [
      ["data", "user", "result", "timeline_v2", "timeline", "instructions"],
      ["data", "user", "result", "timeline", "timeline", "instructions"],
      ["data", "search_by_raw_query", "search_timeline", "timeline", "instructions"],
    ];

    for (const path of paths) {
      let current: unknown = data;
      for (const key of path) {
        if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[key];
        } else {
          current = undefined;
          break;
        }
      }
      if (Array.isArray(current)) return current;
    }

    return [];
  }

  private extractTweetFromEntry(entry: Record<string, unknown>): TwitterTweet | null {
    try {
      const content = entry.content as Record<string, unknown> | undefined;
      if (!content) return null;

      let tweetResult: Record<string, unknown> | undefined;

      const itemContent = content.itemContent as Record<string, unknown> | undefined;
      if (itemContent) {
        const tweetResults = itemContent.tweet_results as Record<string, unknown> | undefined;
        tweetResult = tweetResults?.result as Record<string, unknown> | undefined;
      }

      if (!tweetResult) {
        const items = content.items as Array<Record<string, unknown>> | undefined;
        if (items?.[0]) {
          const item = items[0].item as Record<string, unknown> | undefined;
          const ic = item?.itemContent as Record<string, unknown> | undefined;
          const tr = ic?.tweet_results as Record<string, unknown> | undefined;
          tweetResult = tr?.result as Record<string, unknown> | undefined;
        }
      }

      if (!tweetResult) return null;

      if (tweetResult.__typename === "TweetWithVisibilityResults") {
        tweetResult = tweetResult.tweet as Record<string, unknown>;
      }
      if (!tweetResult?.legacy) return null;

      const legacy = tweetResult.legacy as Record<string, unknown>;
      const core = tweetResult.core as Record<string, unknown> | undefined;
      const userResults = core?.user_results as Record<string, unknown> | undefined;
      const userResult = userResults?.result as Record<string, unknown> | undefined;
      const userLegacy = userResult?.legacy as Record<string, unknown> | undefined;

      const views = tweetResult.views as Record<string, unknown> | undefined;
      const viewCount = parseInt(String(views?.count ?? "0"), 10);

      const mediaEntities = (legacy.entities as Record<string, unknown>)?.media as Array<Record<string, unknown>> | undefined;

      return {
        id: (tweetResult.rest_id as string) ?? (legacy.id_str as string) ?? "",
        text: (legacy.full_text as string) ?? "",
        authorId: (legacy.user_id_str as string) ?? "",
        authorUsername: (userLegacy?.screen_name as string) ?? "",
        authorName: (userLegacy?.name as string) ?? "",
        createdAt: new Date(legacy.created_at as string).getTime(),
        likes: (legacy.favorite_count as number) ?? 0,
        retweets: (legacy.retweet_count as number) ?? 0,
        replies: (legacy.reply_count as number) ?? 0,
        views: viewCount,
        bookmarks: (legacy.bookmark_count as number) ?? 0,
        isReply: !!(legacy.in_reply_to_status_id_str),
        isRetweet: !!(legacy.retweeted_status_result),
        isQuote: !!(legacy.is_quote_status),
        quotedTweetId: legacy.quoted_status_id_str as string | undefined,
        inReplyToId: legacy.in_reply_to_status_id_str as string | undefined,
        mediaUrls: (mediaEntities ?? []).map((m) => (m.media_url_https as string) ?? "").filter(Boolean),
        language: legacy.lang as string | undefined,
      };
    } catch {
      return null;
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
