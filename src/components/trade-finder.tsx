"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Trade {
  ticker: string;
  direction: string;
  venue: string;
  confidence: number;
  reasoning: string;
  timeframe: string;
}

interface TradeResult {
  thesis: string;
  source_type: string;
  trades: Trade[];
  analysis: string;
}

interface SubmitState {
  status: "idle" | "loading" | "success" | "error";
  tradeUrl?: string;
  error?: string;
}

const LOADING_STEPS = [
  "Analyzing source...",
  "Extracting thesis...",
  "Finding trades...",
];

function extractTwitterHandle(url: string): string | undefined {
  const match = url.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)(?:\/|$)/i);
  return match?.[1];
}

function isUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim());
}

function venueToPayload(venue: string): { platform: string; instrument: string } {
  const lower = venue.toLowerCase();
  if (lower.includes("polymarket")) return { platform: "polymarket", instrument: "polymarket" };
  if (lower.includes("robinhood")) return { platform: "robinhood", instrument: "shares" };
  return { platform: "hyperliquid", instrument: "perps" };
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const totalBlocks = 10;
  const filledBlocks = Math.round((confidence / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const colorClass =
    confidence > 70 ? "text-win" : confidence >= 40 ? "text-amber" : "text-loss";

  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span className="text-text-muted text-xs uppercase tracking-widest">Confidence</span>
      <span className={colorClass}>{"█".repeat(filledBlocks)}</span>
      <span className="text-text-muted">{"░".repeat(emptyBlocks)}</span>
      <span className={`${colorClass} text-xs`}>{confidence}</span>
    </div>
  );
}

function TradeCard({
  trade,
  thesis,
  sourceUrl,
  authorHandle,
}: {
  trade: Trade;
  thesis: string;
  sourceUrl?: string;
  authorHandle?: string;
}) {
  const directionUpper = trade.direction.toUpperCase();
  const directionColor =
    directionUpper === "LONG" || directionUpper === "YES"
      ? "text-win"
      : directionUpper === "SHORT" || directionUpper === "NO"
        ? "text-loss"
        : "text-text-primary";

  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const handlePost = async () => {
    setSubmitState({ status: "loading" });
    const { platform, instrument } = venueToPayload(trade.venue);

    try {
      const res = await fetch("/api/submit-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: trade.ticker,
          direction: trade.direction,
          platform,
          instrument,
          thesis,
          source_url: sourceUrl,
          author_handle: authorHandle,
          headline_quote: thesis.slice(0, 120),
          explanation: trade.reasoning,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          typeof data.details === "string" ? data.details : data.error || `Error ${res.status}`;
        setSubmitState({ status: "error", error: msg });
        return;
      }

      const tradeId = data.trade_id ?? data.id ?? "";
      const tradeUrl =
        data.url ?? (tradeId ? `https://paste.trade/t/${tradeId}` : "https://paste.trade");
      setSubmitState({ status: "success", tradeUrl });
    } catch (err) {
      setSubmitState({
        status: "error",
        error: err instanceof Error ? err.message : "Submission failed",
      });
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-text-primary">
          <span>${trade.ticker}</span>{" "}
          <span className={directionColor}>{directionUpper}</span>
        </h3>
      </div>

      <ConfidenceBar confidence={trade.confidence} />

      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-text-muted text-xs uppercase tracking-widest">Venue</span>
          <p className="text-text-secondary mt-1">{trade.venue}</p>
        </div>
        <div>
          <span className="text-text-muted text-xs uppercase tracking-widest">Timeframe</span>
          <p className="text-text-secondary mt-1">{trade.timeframe}</p>
        </div>
      </div>

      <div>
        <span className="text-text-muted text-xs uppercase tracking-widest">Reasoning</span>
        <p className="text-text-secondary text-sm mt-1 leading-relaxed">{trade.reasoning}</p>
      </div>

      {/* Post to paste.trade */}
      <div className="pt-2 border-t border-border">
        {submitState.status === "idle" && (
          <button
            onClick={handlePost}
            className="w-full border border-border rounded-lg px-4 py-2 text-sm font-bold text-text-primary hover:border-accent transition-colors"
          >
            Post to paste.trade
          </button>
        )}
        {submitState.status === "loading" && (
          <p className="text-text-muted text-sm text-center animate-pulse">Posting trade...</p>
        )}
        {submitState.status === "success" && (
          <div className="space-y-2">
            <p className="text-win text-sm font-bold">Trade posted. P&L tracking live.</p>
            <a
              href={submitState.tradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center border border-accent rounded-lg px-4 py-2 text-sm font-bold text-accent hover:bg-accent/10 transition-colors"
            >
              View on paste.trade
            </a>
          </div>
        )}
        {submitState.status === "error" && (
          <div className="space-y-2">
            <p className="text-loss text-sm">Failed to post: {submitState.error}</p>
            <button
              onClick={() => setSubmitState({ status: "idle" })}
              className="text-text-muted text-xs hover:text-text-secondary transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TradeFinderInner() {
  const searchParams = useSearchParams();
  const prefilled = searchParams.get("q") ?? "";

  const [input, setInput] = useState(prefilled);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setLoadingStep(0);
    setResult(null);
    setError(null);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 2000);

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Request failed with status ${res.status}`);
      }

      const data: TradeResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try again.");
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (prefilled) analyze(prefilled);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze(input);
  };

  const sourceUrl = isUrl(input) ? input : undefined;
  const authorHandle = sourceUrl ? extractTwitterHandle(sourceUrl) : undefined;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-16 pb-20">
      <section className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">
          What&apos;s The Trade?
        </h1>
        <p className="text-text-secondary text-sm">
          Paste a URL or describe a thesis. AI finds the trade.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="mb-10">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a URL or type your thesis..."
          rows={4}
          disabled={loading}
          className="w-full bg-surface border border-border rounded-lg p-4 text-text-primary text-sm placeholder:text-text-muted resize-none focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="mt-4 w-full border border-border rounded-lg px-6 py-3 text-sm font-bold text-text-primary hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing..." : "Find The Trade"}
        </button>
      </form>

      {loading && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-10">
          <div className="space-y-3">
            {LOADING_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-3 text-sm">
                {i < loadingStep ? (
                  <span className="text-win text-xs w-4 text-center">--</span>
                ) : i === loadingStep ? (
                  <span className="text-accent text-xs w-4 text-center animate-pulse">&gt;</span>
                ) : (
                  <span className="text-text-muted text-xs w-4 text-center">..</span>
                )}
                <span className={i <= loadingStep ? "text-text-primary" : "text-text-muted"}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-surface border border-loss/30 rounded-lg p-6 mb-10">
          <p className="text-loss text-sm font-bold mb-1">Analysis failed</p>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-8">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-text-muted mb-3">Thesis</h2>
            <p className="text-text-secondary text-sm leading-relaxed">{result.thesis}</p>
            <span className="inline-block mt-2 text-xs text-text-muted border border-border rounded px-2 py-0.5">
              {result.source_type}
            </span>
          </div>

          <div>
            <h2 className="text-xs uppercase tracking-widest text-text-muted mb-3">Trades</h2>
            <div className="space-y-4">
              {result.trades.map((trade, i) => (
                <TradeCard
                  key={`${trade.ticker}-${i}`}
                  trade={trade}
                  thesis={result.thesis}
                  sourceUrl={sourceUrl}
                  authorHandle={authorHandle}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs uppercase tracking-widest text-text-muted mb-3">Analysis</h2>
            <div className="bg-surface border border-border rounded-lg p-6">
              <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                {result.analysis}
              </p>
            </div>
          </div>

          <p className="text-text-muted text-xs text-center pt-4 border-t border-border">
            Not financial advice. AI-generated analysis. Do your own research.
          </p>
        </div>
      )}
    </div>
  );
}

export function TradeFinder() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 pt-16 pb-20">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3b82f6" }}>
            paste.trade
          </p>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#f0f0f0" }}>
            Submit a Trade
          </h1>
          <p className="text-sm" style={{ color: "#c8c8d0" }}>Loading...</p>
        </div>
      }
    >
      <TradeFinderInner />
    </Suspense>
  );
}
