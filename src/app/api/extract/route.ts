import { NextRequest, NextResponse } from "next/server";
import { extractTrades, type SourceType } from "@/lib/trade-extractor";
import { saveExtraction, trackThesis } from "@/lib/db";
import { submitTrade, skillRoute, skillDiscover } from "@/lib/paste-trade";

interface SubmitResult {
  thesisId: string;
  tradeUrl: string;
  ticker: string;
  direction: string;
  entryPrice: number | null;
  pasteTradeId: string;
}

const INSTRUMENT_MAP: Record<string, string> = {
  hyperliquid: "perps",
  robinhood: "stock",
  polymarket: "prediction",
};

async function submitThesisToPasteTrade(thesis: {
  id: string;
  ticker: string;
  direction: string;
  platform: string;
  reasoning: string;
  quote: string;
  sourceUrl: string | null;
  author: string | null;
}): Promise<SubmitResult | null> {
  const dir = (["long", "short"].includes(thesis.direction)
    ? thesis.direction
    : "long") as "long" | "short";

  const result = await submitTrade({
    ticker: thesis.ticker,
    direction: dir,
    platform: thesis.platform,
    instrument: INSTRUMENT_MAP[thesis.platform] ?? "perps",
    thesis: thesis.quote || thesis.reasoning,
    source_url: thesis.sourceUrl ?? undefined,
    author_handle: thesis.author?.replace(/^@/, ""),
    headline_quote: (thesis.quote || thesis.reasoning).slice(0, 120),
    explanation: thesis.reasoning,
  });

  if (!result) return null;

  return {
    thesisId: thesis.id,
    tradeUrl: result.url ?? (result.trade_id ? `https://paste.trade/t/${result.trade_id}` : ""),
    ticker: thesis.ticker,
    direction: thesis.direction,
    entryPrice: null,
    pasteTradeId: result.trade_id ?? result.id ?? "",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.input !== "string" || !body.input.trim()) {
      return NextResponse.json(
        { error: "Missing input", details: "Provide a URL or text in the 'input' field" },
        { status: 400 },
      );
    }

    const input: string = body.input.trim();
    const typeHint: SourceType | "auto" = body.type ?? "auto";
    const trackAll: boolean = body.trackAll === true;

    // Run extraction pipeline
    const extraction = await extractTrades(input, typeHint);

    // Persist extraction to SQLite
    try {
      await saveExtraction({
        id: extraction.id,
        source_type: extraction.source.type,
        source_url: extraction.source.url,
        title: extraction.source.title,
        author: extraction.source.author,
        summary: extraction.summary,
        word_count: extraction.source.wordCount,
        thesis_count: extraction.theses.length,
        processing_time_ms: extraction.processingTime,
        theses: extraction.theses.map((t) => ({
          id: t.id,
          ticker: t.ticker,
          direction: t.direction,
          platform: t.platform,
          confidence: t.confidence,
          reasoning: t.reasoning,
          quote: t.quote,
          timeframe: t.timeframe,
          conviction: t.conviction,
          price_at_extraction: t.priceAtExtraction,
        })),
      });
    } catch (dbErr) {
      console.error("[api/extract] DB save failed:", dbErr);
      // Continue — extraction still works without persistence
    }

    // If trackAll is requested, submit each thesis to paste.trade
    const tracked: SubmitResult[] = [];
    if (trackAll && extraction.theses.length > 0) {
      const results = await Promise.allSettled(
        extraction.theses.map((thesis) =>
          submitThesisToPasteTrade({
            id: thesis.id,
            ticker: thesis.ticker,
            direction: thesis.direction,
            platform: thesis.platform,
            reasoning: thesis.reasoning,
            quote: thesis.quote,
            sourceUrl: extraction.source.url,
            author: extraction.source.author,
          }),
        ),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          tracked.push(result.value);
          // Update DB with tracking info
          try {
            await trackThesis(
              result.value.thesisId,
              result.value.pasteTradeId,
              result.value.tradeUrl,
              result.value.entryPrice,
            );
          } catch {
            // Non-critical
          }
        }
      }
    }

    // Run venue routing for each thesis via paste.trade /api/skill/route
    const routing: Record<string, unknown>[] = [];
    if (extraction.theses.length > 0) {
      const routeResults = await Promise.allSettled(
        extraction.theses.map(async (thesis) => {
          const dir = (["long", "short"].includes(thesis.direction)
            ? thesis.direction
            : "long") as "long" | "short";
          const result = await skillRoute({
            tickers: [thesis.ticker],
            direction: dir,
          });
          return result ? { ticker: thesis.ticker, ...result } : null;
        }),
      );

      for (const result of routeResults) {
        if (result.status === "fulfilled" && result.value) {
          routing.push(result.value);
        }
      }
    }

    // Discover instruments for each thesis via paste.trade /api/skill/discover
    const discovery: Record<string, unknown>[] = [];
    if (extraction.theses.length > 0) {
      const discoverResults = await Promise.allSettled(
        extraction.theses.map(async (thesis) => {
          const result = await skillDiscover({
            query: thesis.ticker,
            platforms: thesis.platform ? [thesis.platform] : undefined,
          });
          return result ? { ticker: thesis.ticker, ...result } : null;
        }),
      );

      for (const result of discoverResults) {
        if (result.status === "fulfilled" && result.value) {
          discovery.push(result.value);
        }
      }
    }

    return NextResponse.json({
      extraction,
      tracked,
      routing,
      discovery,
      sourceUrl: `/source/${extraction.id}`,
    });
  } catch (err) {
    console.error("[api/extract] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
