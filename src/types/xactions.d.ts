declare module "xactions" {
  export function createBrowser(): Promise<{ close(): Promise<void> }>;
  export function createPage(browser: unknown): Promise<unknown>;
  export function loginWithCookie(page: unknown, cookie: string): Promise<void>;
  export function scrapeTweets(
    page: unknown,
    handle: string,
    options?: { limit?: number },
  ): Promise<
    Array<{
      id?: string;
      text?: string;
      timestamp?: string;
      url?: string;
      isRetweet?: boolean;
      likes?: string;
      retweets?: string;
      replies?: string;
    }>
  >;
  export function scrapeProfile(
    page: unknown,
    handle: string,
  ): Promise<{
    username?: string;
    name?: string;
    avatar?: string;
    bio?: string;
    verified?: boolean;
    followers?: string;
    following?: string;
  } | null>;
  export function searchTweets(
    page: unknown,
    query: string,
    options?: { limit?: number; filter?: string },
  ): Promise<Array<Record<string, unknown>>>;
  export function scrapeThread(
    tweetId: string,
  ): Promise<
    Array<{
      text?: string;
      full_text?: string;
      author?: { username?: string };
      username?: string;
    }>
  >;
}
