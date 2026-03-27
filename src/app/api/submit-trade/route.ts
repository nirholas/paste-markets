import { NextRequest, NextResponse } from "next/server";
import { submitTrade, PasteTradeError } from "@/lib/paste-trade";

interface SubmitTradeBody {
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform: string;
  instrument: string;
  thesis: string;
  source_url?: string;
  author_handle?: string;
  headline_quote?: string;
  chain_steps?: string[];
  explanation?: string;
}

export async function POST(request: NextRequest) {
  let body: SubmitTradeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.ticker || typeof body.ticker !== "string") {
    return NextResponse.json({ error: "Missing required field: ticker" }, { status: 400 });
  }
  if (!body.direction || !["long", "short", "yes", "no"].includes(body.direction)) {
    return NextResponse.json(
      { error: "Invalid direction: must be long, short, yes, or no" },
      { status: 400 },
    );
  }
  if (!body.thesis || typeof body.thesis !== "string" || !body.thesis.trim()) {
    return NextResponse.json({ error: "Missing required field: thesis" }, { status: 400 });
  }

  try {
    const result = await submitTrade({
      ticker: body.ticker.toUpperCase().replace(/^\$/, ""),
      direction: body.direction === "yes" || body.direction === "no" ? "long" : body.direction,
      platform: body.platform || "hyperliquid",
      instrument: body.instrument || "perps",
      thesis: body.thesis.trim(),
      source_url: body.source_url,
      author_handle: body.author_handle,
      headline_quote: body.headline_quote,
      chain_steps: body.chain_steps,
      explanation: body.explanation,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof PasteTradeError) {
      const status =
        err.code === "no_api_key" ? 503 :
        err.code === "unauthorized" ? 502 :
        err.code === "network_error" ? 504 : 502;
      return NextResponse.json(
        { error: err.message, code: err.code, details: err.detail },
        { status },
      );
    }
    return NextResponse.json(
      { error: "Failed to submit trade to paste.trade" },
      { status: 502 },
    );
  }
}
