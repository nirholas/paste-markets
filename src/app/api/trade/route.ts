import { NextRequest, NextResponse } from "next/server";

interface TradeIdea {
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  venue: string;
  confidence: number;
  reasoning: string;
  timeframe: string;
}

interface TradeResponse {
  thesis: string;
  source_type: string;
  trades: TradeIdea[];
  analysis: string;
}

function detectSourceType(input: string): string {
  if (/https?:\/\/(twitter\.com|x\.com)\//i.test(input)) return "tweet";
  if (/https?:\/\/(youtube\.com|youtu\.be)\//i.test(input)) return "video";
  if (/^https?:\/\//i.test(input)) return "article";
  return "text";
}

function isUrlSafe(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  // Only allow http(s)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.toLowerCase();
  // Block localhost, loopback, link-local, and private ranges
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^0\./.test(hostname) ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname === "169.254.169.254" || // cloud metadata
    hostname.endsWith(".amazonaws.com") && hostname.startsWith("169.254") ||
    hostname === "metadata.google.internal"
  ) {
    return false;
  }
  return true;
}

async function fetchContent(url: string): Promise<string> {
  if (!isUrlSafe(url)) return `[Blocked: URL points to a private/internal address]`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "paste.markets/1.0" },
      signal: AbortSignal.timeout(10000),
      redirect: "manual", // don't follow redirects to internal IPs
    });
    // If redirect, validate the target before following
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || !isUrlSafe(location)) return `[Blocked: redirect to private/internal address]`;
      const redirectRes = await fetch(location, {
        headers: { "User-Agent": "paste.markets/1.0" },
        signal: AbortSignal.timeout(10000),
        redirect: "manual",
      });
      if (!redirectRes.ok) return `[Failed to fetch: ${redirectRes.status}]`;
      const text = await redirectRes.text();
      const stripped = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return stripped.slice(0, 4000);
    }
    if (!res.ok) return `[Failed to fetch: ${res.status}]`;
    const text = await res.text();
    // Strip HTML tags for a rough text extraction
    const stripped = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Limit to ~4000 chars to fit in context
    return stripped.slice(0, 4000);
  } catch {
    return `[Could not fetch URL content]`;
  }
}

const SYSTEM_PROMPT = `You are a trading analyst for crypto and equities. Given a source (news article, tweet, thesis), extract tradeable ideas.

For each idea, provide:
- ticker: The specific instrument symbol (e.g., SOL, BTC, AAPL, TSLA)
- direction: "long", "short", "yes", or "no" (yes/no for prediction markets)
- venue: Where to execute — "Hyperliquid", "Robinhood", "Polymarket", "Binance", "Coinbase", "dYdX", etc.
- confidence: 0-100 score
- reasoning: One concise sentence explaining why
- timeframe: "1 day", "1 week", "1 month", "3 months"

Be opinionated. Don't hedge everything. If the thesis is strong, say so. If it's garbage, say so.

Respond in this exact JSON format:
{
  "thesis": "The core thesis extracted from the source",
  "trades": [
    {
      "ticker": "SOL",
      "direction": "long",
      "venue": "Hyperliquid",
      "confidence": 75,
      "reasoning": "Solana DeFi TVL is accelerating",
      "timeframe": "1 week"
    }
  ],
  "analysis": "A 2-3 sentence overall analysis"
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.input !== "string" || !body.input.trim()) {
      return NextResponse.json(
        { error: "Missing input", details: "Provide a URL or text thesis in the 'input' field" },
        { status: 400 },
      );
    }

    const input: string = body.input.trim();
    const sourceType = detectSourceType(input);

    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      return NextResponse.json(
        { error: "Service unavailable", details: "AI analysis is not configured" },
        { status: 503 },
      );
    }

    // Build user message
    let userContent: string;
    if (sourceType === "text") {
      userContent = `Analyze this thesis and find trades:\n\n${input}`;
    } else if (sourceType === "tweet") {
      userContent = `Analyze this tweet/thread and find trades. The URL is: ${input}\n\nNote: I cannot fetch tweet content directly. Analyze based on the URL context and any information you can infer from it.`;
    } else if (sourceType === "video") {
      userContent = `Analyze this video and find trades. The URL is: ${input}\n\nNote: I cannot watch videos. Analyze based on the URL context and any information you can infer from it.`;
    } else {
      // article — try to fetch content
      const content = await fetchContent(input);
      userContent = `Analyze this article and find trades:\n\nURL: ${input}\n\nContent:\n${content}`;
    }

    // Call Claude Haiku
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error("[api/trade] Claude API error:", response.status, errText);
      return NextResponse.json(
        { error: "AI analysis failed", details: `API returned ${response.status}` },
        { status: 502 },
      );
    }

    const result = await response.json();
    const assistantText: string =
      result.content?.[0]?.text ?? "";

    // Parse JSON from Claude's response
    let parsed: { thesis?: string; trades?: TradeIdea[]; analysis?: string };
    try {
      // Try to extract JSON from the response (Claude might wrap it in markdown)
      const jsonMatch = assistantText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // If parsing fails, return the raw analysis
      return NextResponse.json({
        thesis: input.slice(0, 200),
        source_type: sourceType,
        trades: [],
        analysis: assistantText || "Could not parse AI response into structured trades.",
      } satisfies TradeResponse);
    }

    // Validate and sanitize trades
    const trades: TradeIdea[] = (parsed.trades ?? [])
      .filter(
        (t): t is TradeIdea =>
          typeof t === "object" &&
          t !== null &&
          typeof t.ticker === "string" &&
          typeof t.direction === "string",
      )
      .map((t) => ({
        ticker: t.ticker.toUpperCase().replace(/^\$/, ""),
        direction: (["long", "short", "yes", "no"].includes(t.direction)
          ? t.direction
          : "long") as TradeIdea["direction"],
        venue: t.venue || "Unknown",
        confidence: Math.min(100, Math.max(0, Number(t.confidence) || 50)),
        reasoning: t.reasoning || "",
        timeframe: t.timeframe || "1 week",
      }))
      .slice(0, 5); // Max 5 trades

    const tradeResponse: TradeResponse = {
      thesis: parsed.thesis || input.slice(0, 200),
      source_type: sourceType,
      trades,
      analysis: parsed.analysis || assistantText,
    };

    return NextResponse.json(tradeResponse);
  } catch (err) {
    console.error("[api/trade] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
