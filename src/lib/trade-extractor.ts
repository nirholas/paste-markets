/**
 * Multi-thesis trade extraction pipeline.
 *
 * Processes URLs (tweets, threads, articles, YouTube, PDFs) or raw text,
 * runs through Claude Haiku to detect ALL tradeable ideas, and returns
 * structured ExtractedThesis[] grouped under a TradeExtraction.
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradeExtraction {
  id: string;
  source: {
    type: "tweet" | "thread" | "article" | "youtube" | "pdf" | "text";
    url: string | null;
    title: string;
    author: string | null;
    publishedAt: string | null;
    wordCount: number;
  };
  theses: ExtractedThesis[];
  summary: string;
  processingTime: number; // ms
  createdAt: string;
}

export interface ExtractedThesis {
  id: string;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform: "hyperliquid" | "robinhood" | "polymarket";
  confidence: number; // 0-100
  reasoning: string;
  quote: string;
  timeframe: string | null;
  priceAtExtraction: number | null;
  conviction: "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// Source type detection
// ---------------------------------------------------------------------------

export type SourceType = TradeExtraction["source"]["type"];

export function detectSourceType(input: string): SourceType {
  const trimmed = input.trim();
  if (/https?:\/\/(twitter\.com|x\.com)\//i.test(trimmed)) {
    // Threads are detected after fetching; default to tweet
    return "tweet";
  }
  if (/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(trimmed)) return "youtube";
  if (/\.pdf(\?|$)/i.test(trimmed) && /^https?:\/\//i.test(trimmed)) return "pdf";
  if (/^https?:\/\//i.test(trimmed)) return "article";
  return "text";
}

// ---------------------------------------------------------------------------
// Content fetching helpers
// ---------------------------------------------------------------------------

function extractTweetId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m?.[1] ?? null;
}

function extractTwitterHandle(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i);
  return m?.[1] ?? null;
}

async function fetchArticleContent(url: string): Promise<{ text: string; title: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "paste.markets/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { text: `[Failed to fetch: ${res.status}]`, title: url };

    const html = await res.text();

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() || url;

    // Strip to readable text
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();

    return { text: stripped.slice(0, 8000), title };
  } catch {
    return { text: "[Could not fetch URL content]", title: url };
  }
}

async function fetchTweetThread(tweetId: string): Promise<{ tweets: string[]; author: string | null }> {
  // Try xactions scrapeThread if available
  try {
    const xactions = await import("xactions");
    if (typeof xactions.scrapeThread === "function") {
      const thread = await xactions.scrapeThread(tweetId);
      if (Array.isArray(thread) && thread.length > 0) {
        const author = thread[0]?.author?.username ?? thread[0]?.username ?? null;
        const texts = thread.map((t: { text?: string; full_text?: string }) =>
          String(t.text ?? t.full_text ?? ""),
        );
        return { tweets: texts.filter(Boolean), author };
      }
    }
  } catch {
    // xactions not available or failed
  }

  // Fallback: try fetching tweet via nitter or return placeholder
  return { tweets: [], author: null };
}

// ---------------------------------------------------------------------------
// Claude extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM = `You are a trade thesis extractor for crypto, equities, and prediction markets. Given content from any source (article, tweet thread, YouTube transcript, research note), identify ALL tradeable ideas mentioned.

For each thesis found, provide:
- ticker: the specific asset symbol (BTC, ETH, AAPL, SOL, etc.) or prediction market topic
- direction: "long" or "short" (or "yes"/"no" for prediction markets)
- platform: "hyperliquid" (crypto perps), "robinhood" (stocks/ETFs), or "polymarket" (prediction markets)
- confidence: 0-100 how clearly this is stated as a trade idea vs just mentioned
- reasoning: 1-2 sentences on why this is a trade
- quote: the exact text excerpt that contains this thesis (keep it short, 1-2 sentences max)
- conviction: how convicted the author seems — "high" (explicit trade call), "medium" (strong opinion), "low" (casual mention)
- timeframe: "short-term" (days), "medium-term" (weeks), "long-term" (months), or null if not mentioned

Important rules:
- Include EVERY tradeable mention, even subtle ones
- "I'm long X" or "buying X" = high confidence trade call
- "X looks interesting" or "watching X" = low confidence mention
- For articles discussing multiple assets, extract each one separately
- Ignore generic market commentary with no specific ticker
- For prediction markets, use descriptive tickers like "FED_RATE_CUT" or "TRUMP_WIN"
- Be opinionated about confidence — don't default everything to 50

Respond in this exact JSON format (no markdown wrapping):
{
  "summary": "2-3 sentence summary of the entire content",
  "title": "A short title for this source content",
  "theses": [
    {
      "ticker": "BTC",
      "direction": "long",
      "platform": "hyperliquid",
      "confidence": 85,
      "reasoning": "Author explicitly calls for BTC to break 90k by end of month based on consolidation pattern",
      "quote": "BTC is consolidating at 84k, I think we see 90k+ by end of month",
      "conviction": "high",
      "timeframe": "short-term"
    }
  ]
}`;

interface ClaudeThesisResponse {
  summary?: string;
  title?: string;
  theses?: Array<{
    ticker?: string;
    direction?: string;
    platform?: string;
    confidence?: number;
    reasoning?: string;
    quote?: string;
    conviction?: string;
    timeframe?: string;
  }>;
}

async function runClaudeExtraction(content: string): Promise<ClaudeThesisResponse | null> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: EXTRACTION_SYSTEM,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error("[trade-extractor] Claude API error:", res.status);
      return null;
    }

    const data = (await res.json()) as { content?: Array<{ text: string }> };
    const text = data.content?.[0]?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as ClaudeThesisResponse;
  } catch (err) {
    console.error("[trade-extractor] Claude extraction failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Platform mapping
// ---------------------------------------------------------------------------

function normalizePlatform(raw: string | undefined): ExtractedThesis["platform"] {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("polymarket") || lower.includes("prediction")) return "polymarket";
  if (lower.includes("robinhood") || lower.includes("stock") || lower.includes("equit")) return "robinhood";
  return "hyperliquid";
}

function normalizeDirection(raw: string | undefined): ExtractedThesis["direction"] {
  const lower = (raw ?? "long").toLowerCase();
  if (lower === "short") return "short";
  if (lower === "yes") return "yes";
  if (lower === "no") return "no";
  return "long";
}

function normalizeConviction(raw: string | undefined): ExtractedThesis["conviction"] {
  const lower = (raw ?? "medium").toLowerCase();
  if (lower === "high") return "high";
  if (lower === "low") return "low";
  return "medium";
}

// ---------------------------------------------------------------------------
// Main extraction pipeline
// ---------------------------------------------------------------------------

export async function extractTrades(
  input: string,
  typeHint?: SourceType | "auto",
): Promise<TradeExtraction> {
  const start = Date.now();
  const trimmed = input.trim();
  const sourceType = typeHint && typeHint !== "auto" ? typeHint : detectSourceType(trimmed);
  const isUrl = /^https?:\/\//i.test(trimmed);

  let contentForClaude = "";
  let title = "";
  let author: string | null = null;

  switch (sourceType) {
    case "tweet":
    case "thread": {
      const tweetId = extractTweetId(trimmed);
      const handle = extractTwitterHandle(trimmed);
      author = handle ? `@${handle}` : null;

      if (tweetId) {
        const { tweets, author: threadAuthor } = await fetchTweetThread(tweetId);
        if (threadAuthor) author = `@${threadAuthor}`;

        if (tweets.length > 1) {
          // It's a thread
          title = `Thread by ${author ?? "unknown"}`;
          contentForClaude = `Twitter thread by ${author ?? "unknown"}:\n\n${tweets.map((t, i) => `${i + 1}. ${t}`).join("\n\n")}`;
        } else if (tweets.length === 1) {
          title = `Tweet by ${author ?? "unknown"}`;
          contentForClaude = `Tweet by ${author ?? "unknown"}:\n\n${tweets[0]}`;
        } else {
          // Could not fetch — ask Claude to work with URL context
          title = `Tweet by ${author ?? "unknown"}`;
          contentForClaude = `Tweet URL: ${trimmed}\nAuthor: ${author ?? "unknown"}\n\nNote: Could not fetch tweet content directly. Please analyze based on available context from the URL.`;
        }
      } else {
        title = `Tweet by ${author ?? "unknown"}`;
        contentForClaude = `Tweet URL: ${trimmed}\n\nNote: Could not parse tweet ID. Analyze based on URL context.`;
      }
      break;
    }

    case "youtube": {
      title = "YouTube Video";
      // Try fetching the page to get the video title
      try {
        const res = await fetch(trimmed, {
          headers: { "User-Agent": "paste.markets/1.0" },
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          const html = await res.text();
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (titleMatch) {
            title = titleMatch[1].replace(/\s*-\s*YouTube\s*$/i, "").replace(/\s+/g, " ").trim() || "YouTube Video";
          }
          // Try to extract channel name
          const channelMatch = html.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
          if (channelMatch) author = channelMatch[1];
        }
      } catch {
        // Ignore fetch errors
      }

      contentForClaude = `YouTube video: "${title}"${author ? ` by ${author}` : ""}\nURL: ${trimmed}\n\nNote: Cannot access video transcript directly. Analyze based on the title, channel, and any context from the URL.`;
      break;
    }

    case "pdf": {
      title = "PDF Document";
      contentForClaude = `PDF URL: ${trimmed}\n\nNote: Cannot extract PDF content directly. Analyze based on URL context.`;
      break;
    }

    case "article": {
      const fetched = await fetchArticleContent(trimmed);
      title = fetched.title;
      contentForClaude = `Article: "${fetched.title}"\nURL: ${trimmed}\n\nContent:\n${fetched.text}`;
      break;
    }

    case "text":
    default: {
      title = trimmed.slice(0, 80) + (trimmed.length > 80 ? "..." : "");
      contentForClaude = `Analyze this text for tradeable ideas:\n\n${trimmed}`;
      break;
    }
  }

  const wordCount = contentForClaude.split(/\s+/).length;

  // Run Claude extraction
  const claudeResult = await runClaudeExtraction(contentForClaude);

  if (claudeResult?.title) {
    title = claudeResult.title;
  }

  // Parse and normalize theses
  const theses: ExtractedThesis[] = (claudeResult?.theses ?? [])
    .filter((t) => t.ticker && typeof t.ticker === "string")
    .map((t) => ({
      id: randomUUID(),
      ticker: t.ticker!.toUpperCase().replace(/^\$/, ""),
      direction: normalizeDirection(t.direction),
      platform: normalizePlatform(t.platform),
      confidence: Math.min(100, Math.max(0, Number(t.confidence) || 50)),
      reasoning: t.reasoning || "",
      quote: t.quote || "",
      timeframe: t.timeframe || null,
      priceAtExtraction: null, // filled after paste.trade submission
      conviction: normalizeConviction(t.conviction),
    }))
    .slice(0, 10); // Max 10 theses

  const extraction: TradeExtraction = {
    id: randomUUID(),
    source: {
      type: sourceType,
      url: isUrl ? trimmed : null,
      title,
      author,
      publishedAt: null,
      wordCount,
    },
    theses,
    summary: claudeResult?.summary || "No summary available.",
    processingTime: Date.now() - start,
    createdAt: new Date().toISOString(),
  };

  return extraction;
}
