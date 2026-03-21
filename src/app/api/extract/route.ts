import { NextRequest, NextResponse } from "next/server";
import { extractTrades, type SourceType } from "@/lib/trade-extractor";
import { saveExtraction, trackThesis } from "@/lib/db";

interface SubmitResult {
  thesisId: string;
  tradeUrl: string;
  ticker: string;
  direction: string;
  entryPrice: number | null;
  pasteTradeId: string;
}

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
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) return null;

  const instrumentMap: Record<string, string> = {
    hyperliquid: "perps",
    robinhood: "stock",
    polymarket: "prediction",
  };

  try {
    const res = await fetch("https://paste.trade/api/trades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ticker: thesis.ticker,
        direction: thesis.direction,
        platform: thesis.platform,
        instrument: instrumentMap[thesis.platform] ?? "perps",
        thesis: thesis.quote || thesis.reasoning,
        ...(thesis.sourceUrl && { source_url: thesis.sourceUrl }),
        ...(thesis.author && { author_handle: thesis.author.replace(/^@/, "") }),
        headline_quote: (thesis.quote || thesis.reasoning).slice(0, 120),
        explanation: thesis.reasoning,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const tradeId = String(data["trade_id"] ?? data["id"] ?? "");
    const tradeUrl = String(
      data["url"] ?? (tradeId ? `https://paste.trade/t/${tradeId}` : ""),
    );
    const entryPrice =
      data["entryPrice"] != null
        ? Number(data["entryPrice"])
        : data["entry_price"] != null
          ? Number(data["entry_price"])
          : null;

    return {
      thesisId: thesis.id,
      tradeUrl,
      ticker: thesis.ticker,
      direction: thesis.direction,
      entryPrice,
      pasteTradeId: tradeId,
    };
  } catch {
    return null;
  }
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
      saveExtraction({
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
            trackThesis(
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

    return NextResponse.json({
      extraction,
      tracked,
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
