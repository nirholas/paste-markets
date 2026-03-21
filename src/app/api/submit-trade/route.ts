import { NextRequest, NextResponse } from "next/server";

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

interface PasteTradeResponse {
  id?: string;
  trade_id?: string;
  url?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) {
    return NextResponse.json(
      { error: "Service unavailable", details: "PASTE_TRADE_KEY is not configured" },
      { status: 503 },
    );
  }

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

  const payload: SubmitTradeBody = {
    ticker: body.ticker.toUpperCase().replace(/^\$/, ""),
    direction: body.direction,
    platform: body.platform || "hyperliquid",
    instrument: body.instrument || "perps",
    thesis: body.thesis.trim(),
    ...(body.source_url && { source_url: body.source_url }),
    ...(body.author_handle && { author_handle: body.author_handle }),
    ...(body.headline_quote && { headline_quote: body.headline_quote }),
    ...(body.chain_steps?.length && { chain_steps: body.chain_steps }),
    ...(body.explanation && { explanation: body.explanation }),
  };

  let upstream: Response;
  try {
    upstream = await fetch("https://paste.trade/api/trades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error("[api/submit-trade] Network error:", err);
    return NextResponse.json(
      { error: "Failed to reach paste.trade API" },
      { status: 502 },
    );
  }

  const responseText = await upstream.text().catch(() => "");
  let responseData: PasteTradeResponse = {};
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = { raw: responseText };
  }

  if (!upstream.ok) {
    console.error("[api/submit-trade] paste.trade error:", upstream.status, responseText);
    return NextResponse.json(
      {
        error: "paste.trade rejected the trade",
        details: responseData,
        status: upstream.status,
      },
      { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 },
    );
  }

  return NextResponse.json(responseData, { status: 201 });
}
