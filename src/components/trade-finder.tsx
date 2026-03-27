"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ExecuteButton } from "@/components/execution/execute-button";
import { TimeAgo } from "@/components/time-ago";

// ---------------------------------------------------------------------------
// Types (mirrors TradeExtraction from trade-extractor.ts)
// ---------------------------------------------------------------------------

interface ExtractedThesis {
  id: string;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform: "hyperliquid" | "robinhood" | "polymarket";
  confidence: number;
  reasoning: string;
  quote: string;
  timeframe: string | null;
  priceAtExtraction: number | null;
  conviction: "high" | "medium" | "low";
}

interface TradeExtraction {
  id: string;
  source: {
    type: string;
    url: string | null;
    title: string;
    author: string | null;
    publishedAt: string | null;
    wordCount: number;
  };
  theses: ExtractedThesis[];
  summary: string;
  sourceText: string | null;
  processingTime: number;
  createdAt: string;
}

interface TrackedTrade {
  thesisId: string;
  tradeUrl: string;
  ticker: string;
  direction: string;
  entryPrice: number | null;
  pasteTradeId: string;
}

interface ExtractResponse {
  extraction: TradeExtraction;
  tracked: TrackedTrade[];
  sourceUrl: string;
}

interface RecentExtraction {
  id: string;
  source_type: string;
  source_url: string | null;
  title: string;
  author: string | null;
  thesis_count: number;
  created_at: string;
}

interface SubmitState {
  status: "idle" | "loading" | "success" | "error";
  tradeUrl?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOADING_STEPS = [
  "Detecting source type...",
  "Fetching content...",
  "Extracting trade theses...",
  "Analyzing confidence levels...",
  "Finding optimal venues...",
];

const SOURCE_LABELS: Record<string, string> = {
  tweet: "Tweet",
  thread: "Thread",
  article: "Article",
  youtube: "YouTube",
  pdf: "PDF",
  text: "Text",
};

function venueToPayload(platform: string): { platform: string; instrument: string } {
  if (platform === "polymarket") return { platform: "polymarket", instrument: "polymarket" };
  if (platform === "robinhood") return { platform: "robinhood", instrument: "shares" };
  return { platform: "hyperliquid", instrument: "perps" };
}


// ---------------------------------------------------------------------------
// ConfidenceBar
// ---------------------------------------------------------------------------

function ConfidenceBar({ confidence }: { confidence: number }) {
  const totalBlocks = 10;
  const filledBlocks = Math.round((confidence / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const colorClass =
    confidence > 70 ? "text-win" : confidence >= 40 ? "text-amber" : "text-loss";

  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span className="text-text-muted text-xs uppercase tracking-widest">
        Confidence
      </span>
      <span className={colorClass}>{"█".repeat(filledBlocks)}</span>
      <span className="text-text-muted">{"░".repeat(emptyBlocks)}</span>
      <span className={`${colorClass} text-xs`}>{confidence}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThesisCard — single trade thesis
// ---------------------------------------------------------------------------

function ThesisCard({
  thesis,
  index,
  sourceUrl,
  authorHandle,
  tracked,
}: {
  thesis: ExtractedThesis;
  index: number;
  sourceUrl?: string;
  authorHandle?: string;
  tracked?: TrackedTrade;
}) {
  const dirUpper = thesis.direction.toUpperCase();
  const dirColor =
    dirUpper === "LONG" || dirUpper === "YES"
      ? "text-win"
      : dirUpper === "SHORT" || dirUpper === "NO"
        ? "text-loss"
        : "text-text-primary";

  const convictionColor =
    thesis.conviction === "high"
      ? "text-win"
      : thesis.conviction === "low"
        ? "text-loss"
        : "text-amber";

  const [submitState, setSubmitState] = useState<SubmitState>(
    tracked ? { status: "success", tradeUrl: tracked.tradeUrl } : { status: "idle" },
  );

  const handleTrack = async () => {
    setSubmitState({ status: "loading" });
    const { platform, instrument } = venueToPayload(thesis.platform);

    try {
      const res = await fetch("/api/submit-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: thesis.ticker,
          direction: thesis.direction,
          platform,
          instrument,
          thesis: thesis.quote || thesis.reasoning,
          source_url: sourceUrl,
          author_handle: authorHandle,
          headline_quote: (thesis.quote || thesis.reasoning).slice(0, 120),
          explanation: thesis.reasoning,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.details === "string"
            ? data.details
            : data.error || `Error ${res.status}`;
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
    <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-text-muted text-xs mr-2">Trade {index + 1}</span>
          <span className="text-text-primary font-bold text-lg">{thesis.ticker}</span>{" "}
          <span className={`font-bold ${dirColor}`}>{dirUpper}</span>
          <span className="text-text-muted text-xs ml-2">on {thesis.platform}</span>
        </div>
        <ConfidenceBar confidence={thesis.confidence} />
      </div>

      {/* Quote */}
      {thesis.quote && (
        <blockquote className="border-l-2 border-border pl-3 text-text-secondary text-sm italic">
          &ldquo;{thesis.quote}&rdquo;
        </blockquote>
      )}

      {/* Reasoning */}
      {thesis.reasoning && (
        <p className="text-text-secondary text-sm leading-relaxed">{thesis.reasoning}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span>
          Conviction:{" "}
          <span className={convictionColor}>{thesis.conviction.toUpperCase()}</span>
        </span>
        {thesis.timeframe && <span>{thesis.timeframe}</span>}
        {thesis.priceAtExtraction != null && (
          <span>
            Entry: $
            {thesis.priceAtExtraction.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </span>
        )}
      </div>

      {/* Track + Execute buttons */}
      <div className="pt-2 border-t border-border">
        {submitState.status === "idle" && (
          <div className="flex gap-2">
            <button
              onClick={handleTrack}
              className="flex-1 border border-border rounded-lg px-4 py-2 text-sm font-bold text-text-primary hover:border-accent transition-colors"
            >
              Track This Trade
            </button>
            <ExecuteButton
              ticker={thesis.ticker}
              direction={thesis.direction}
              platform={thesis.platform}
              entryPrice={thesis.priceAtExtraction}
              className="flex-1 rounded-lg"
            />
          </div>
        )}
        {submitState.status === "loading" && (
          <p className="text-text-muted text-sm text-center animate-pulse">
            Posting trade...
          </p>
        )}
        {submitState.status === "success" && (
          <div className="space-y-2">
            <p className="text-win text-sm font-bold">
              Trade posted. P&L tracking live.
            </p>
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
            <p className="text-loss text-sm">Failed: {submitState.error}</p>
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

// ---------------------------------------------------------------------------
// TrackAllButton
// ---------------------------------------------------------------------------

function TrackAllButton({
  extraction,
  onTracked,
}: {
  extraction: TradeExtraction;
  onTracked: (tracked: TrackedTrade[]) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleTrackAll = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: extraction.source.url || extraction.source.title,
          trackAll: true,
        }),
      });

      if (!res.ok) {
        setState("error");
        return;
      }

      const data: ExtractResponse = await res.json();
      onTracked(data.tracked);
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="text-center">
        <p className="text-win text-sm font-bold">
          All trades posted. P&L tracking live.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleTrackAll}
      disabled={state === "loading"}
      className="w-full border border-accent rounded-lg px-6 py-3 text-sm font-bold text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
    >
      {state === "loading"
        ? "Tracking all trades..."
        : state === "error"
          ? "Retry Track All"
          : `Track All ${extraction.theses.length} Trades`}
    </button>
  );
}

// ---------------------------------------------------------------------------
// RecentExtractions
// ---------------------------------------------------------------------------

function RecentExtractions({ extractions }: { extractions: RecentExtraction[] }) {
  if (extractions.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
        Recent Extractions
      </h2>
      <div className="space-y-2">
        {extractions.map((ext) => (
          <a
            key={ext.id}
            href={`/source/${ext.id}`}
            className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 hover:border-accent/50 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-text-muted border border-border rounded px-1.5 py-0.5 flex-shrink-0">
                {SOURCE_LABELS[ext.source_type] || ext.source_type}
              </span>
              <span className="text-sm text-text-primary truncate group-hover:text-accent transition-colors">
                {ext.author ? `${ext.author} ` : ""}
                {ext.title.length > 60
                  ? ext.title.slice(0, 60) + "..."
                  : ext.title}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
              <span className="text-xs text-text-secondary">
                {ext.thesis_count} trade{ext.thesis_count !== 1 ? "s" : ""}
              </span>
              <TimeAgo date={ext.created_at} className="text-xs text-text-muted" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TradeFinderInner
// ---------------------------------------------------------------------------

function TradeFinderInner() {
  const searchParams = useSearchParams();
  const prefilled = searchParams.get("q") ?? "";

  const [input, setInput] = useState(prefilled);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [trackedMap, setTrackedMap] = useState<Record<string, TrackedTrade>>({});
  const [error, setError] = useState<string | null>(null);
  const [recentExtractions, setRecentExtractions] = useState<RecentExtraction[]>([]);

  // Fetch recent extractions on mount
  useEffect(() => {
    fetch("/api/extract/recent")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setRecentExtractions(data);
      })
      .catch(() => {});
  }, []);

  const analyze = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setLoadingStep(0);
    setResult(null);
    setTrackedMap({});
    setError(null);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Request failed with status ${res.status}`);
      }

      const data: ExtractResponse = await res.json();
      setResult(data);

      // Build tracked map from initial response
      const map: Record<string, TrackedTrade> = {};
      for (const t of data.tracked) {
        map[t.thesisId] = t;
      }
      setTrackedMap(map);

      // Refresh recent extractions
      fetch("/api/extract/recent")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          if (Array.isArray(d)) setRecentExtractions(d);
        })
        .catch(() => {});
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

  const handleTrackedAll = (tracked: TrackedTrade[]) => {
    const map = { ...trackedMap };
    for (const t of tracked) {
      map[t.thesisId] = t;
    }
    setTrackedMap(map);
  };

  const extraction = result?.extraction;
  const sourceUrl = extraction?.source.url ?? undefined;
  const authorHandle = extraction?.source.author?.replace(/^@/, "") ?? undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-16 pb-20">
      {/* Header */}
      <section className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">
          What&apos;s The Trade?
        </h1>
        <p className="text-text-secondary text-sm mb-1">
          Paste any URL or text to find the trades
        </p>
        <p className="text-text-muted text-xs">
          Supports: Tweets - Threads - Articles - YouTube - PDFs - Raw text
        </p>
      </section>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mb-10">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"https://x.com/taikimaeda/status/...\n\nOr paste article text directly..."}
          rows={4}
          disabled={loading}
          className="w-full bg-surface border border-border rounded-lg p-4 text-text-primary text-sm placeholder:text-text-muted resize-none focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="mt-4 w-full border border-border rounded-lg px-6 py-3 text-sm font-bold text-text-primary hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Extracting Trades..." : "Extract Trades"}
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-10">
          <div className="space-y-3">
            {LOADING_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-3 text-sm">
                {i < loadingStep ? (
                  <span className="text-win text-xs w-4 text-center">--</span>
                ) : i === loadingStep ? (
                  <span className="text-accent text-xs w-4 text-center animate-pulse">
                    &gt;
                  </span>
                ) : (
                  <span className="text-text-muted text-xs w-4 text-center">..</span>
                )}
                <span
                  className={
                    i <= loadingStep ? "text-text-primary" : "text-text-muted"
                  }
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-surface border border-loss/30 rounded-lg p-6 mb-10">
          <p className="text-loss text-sm font-bold mb-1">Extraction failed</p>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {extraction && (
        <div className="space-y-8 mb-12">
          {/* Source info */}
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="flex items-center gap-2 text-xs text-text-muted uppercase tracking-widest mb-2">
              <span>Source</span>
              <span>-</span>
              <span>{SOURCE_LABELS[extraction.source.type] || extraction.source.type}</span>
              {extraction.source.author && (
                <>
                  <span>-</span>
                  <span>{extraction.source.author}</span>
                </>
              )}
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-2">
              {extraction.source.title}
            </h2>
            {extraction.sourceText && (
              <div className="bg-[#0a0a1a] border border-border rounded p-4 mb-3">
                <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
                  {extraction.sourceText}
                </p>
              </div>
            )}
            <p className="text-text-secondary text-sm leading-relaxed">
              {extraction.summary}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
              <span>{extraction.source.wordCount} words</span>
              <span>{extraction.processingTime}ms</span>
              {extraction.source.url && (
                <a
                  href={extraction.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  View source
                </a>
              )}
            </div>
          </div>

          {/* Trades count header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              {extraction.theses.length} Trade{extraction.theses.length !== 1 ? "s" : ""}{" "}
              Found
            </h2>
            <a
              href={`/source/${extraction.id}`}
              className="text-xs text-accent hover:underline"
            >
              View source page
            </a>
          </div>

          {/* Track All */}
          {extraction.theses.length > 1 && (
            <TrackAllButton
              extraction={extraction}
              onTracked={handleTrackedAll}
            />
          )}

          {/* Thesis cards */}
          <div className="space-y-4">
            {extraction.theses.map((thesis, i) => (
              <ThesisCard
                key={thesis.id}
                thesis={thesis}
                index={i}
                sourceUrl={sourceUrl}
                authorHandle={authorHandle}
                tracked={trackedMap[thesis.id]}
              />
            ))}
          </div>

          {/* Disclaimer */}
          <p className="text-text-muted text-xs text-center pt-4 border-t border-border">
            Not financial advice. AI-generated analysis. Do your own research.
          </p>
        </div>
      )}

      {/* Recent extractions */}
      {!loading && !extraction && (
        <RecentExtractions extractions={recentExtractions} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function TradeFinder() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 pt-16 pb-20">
          <h1 className="text-3xl font-bold mb-2 text-text-primary">
            What&apos;s The Trade?
          </h1>
          <p className="text-sm text-text-secondary">Loading...</p>
        </div>
      }
    >
      <TradeFinderInner />
    </Suspense>
  );
}
