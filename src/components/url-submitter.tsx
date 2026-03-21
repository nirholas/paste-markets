"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ─── Types matching POST /api/submit response ─────────────────────────────────

interface SubmitSuccess {
  ok: true;
  trade_url: string;
  author_handle: string;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  author_price: number;
  thesis: string;
  headline_quote?: string;
}

interface SubmitError {
  ok: false;
  error: string;
  ticker?: string;
  direction?: string;
  thesis?: string;
}

type SubmitResult = SubmitSuccess | SubmitError;
type PageState = "input" | "loading" | "success" | "error";

// ─── Progress steps ───────────────────────────────────────────────────────────

const STEPS = [
  "Fetching tweet content",
  "Extracting trade thesis",
  "Looking up price at author's timestamp",
  "Submitting to paste.trade",
];

// Milliseconds before each step becomes active while the API call is in-flight
const STEP_DELAYS_MS = [0, 1800, 3600, 5200];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIcon({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done")
    return (
      <span className="w-4 text-center text-xs font-bold" style={{ color: "#2ecc71" }}>
        ✓
      </span>
    );
  if (status === "active")
    return (
      <span
        className="w-4 text-center text-xs font-bold animate-pulse"
        style={{ color: "#3b82f6" }}
      >
        ⟳
      </span>
    );
  return (
    <span className="w-4 text-center text-xs" style={{ color: "#555568" }}>
      ·
    </span>
  );
}

function LoadingSteps({ activeStep }: { activeStep: number }) {
  return (
    <div
      className="rounded-lg p-6"
      style={{ background: "#0f0f22", border: "1px solid #1a1a2e" }}
    >
      <p className="text-xs uppercase tracking-widest mb-5" style={{ color: "#555568" }}>
        Processing
      </p>
      <div className="space-y-4">
        {STEPS.map((step, i) => {
          const status = i < activeStep ? "done" : i === activeStep ? "active" : "pending";
          return (
            <div key={step} className="flex items-center gap-3">
              <StepIcon status={status} />
              <span
                className="text-sm"
                style={{ color: status === "pending" ? "#555568" : "#f0f0f0" }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const up = direction === "long" || direction === "yes";
  return (
    <span
      className="text-xs uppercase tracking-widest font-bold px-2 py-0.5 rounded"
      style={
        up
          ? {
              color: "#2ecc71",
              border: "1px solid rgba(46,204,113,0.3)",
              background: "rgba(46,204,113,0.05)",
            }
          : {
              color: "#e74c3c",
              border: "1px solid rgba(231,76,60,0.3)",
              background: "rgba(231,76,60,0.05)",
            }
      }
    >
      {direction.toUpperCase()}
    </span>
  );
}

function SuccessCard({ result, onReset }: { result: SubmitSuccess; onReset: () => void }) {
  const formattedPrice =
    result.author_price < 1 ? result.author_price.toFixed(4) : result.author_price.toFixed(2);

  return (
    <div className="space-y-4">
      {/* Trade card */}
      <div
        className="rounded-lg p-6 space-y-5"
        style={{ background: "#0f0f22", border: "1px solid rgba(46,204,113,0.3)" }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span
            className="text-xs uppercase tracking-widest font-bold"
            style={{ color: "#2ecc71" }}
          >
            Trade Submitted
          </span>
          <span className="text-xs" style={{ color: "#555568" }}>
            paste.trade
          </span>
        </div>

        {/* Author */}
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#555568" }}>
            Author
          </p>
          <p className="font-bold" style={{ color: "#f0f0f0" }}>
            @{result.author_handle}
          </p>
        </div>

        {/* Headline quote */}
        {result.headline_quote && (
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#555568" }}>
              Quote
            </p>
            <p
              className="text-sm leading-relaxed italic border-l-2 pl-3"
              style={{ color: "#c8c8d0", borderColor: "#1a1a2e" }}
            >
              &ldquo;{result.headline_quote}&rdquo;
            </p>
          </div>
        )}

        {/* Thesis */}
        {result.thesis && (
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#555568" }}>
              Thesis
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#c8c8d0" }}>
              {result.thesis}
            </p>
          </div>
        )}

        {/* Ticker + direction + price */}
        <div
          className="flex items-center gap-3 pt-3"
          style={{ borderTop: "1px solid #1a1a2e" }}
        >
          <span className="font-bold text-lg" style={{ color: "#f0f0f0" }}>
            ${result.ticker}
          </span>
          <DirectionBadge direction={result.direction} />
          <span className="text-xs ml-auto" style={{ color: "#555568" }}>
            entry{" "}
            <span className="font-bold" style={{ color: "#f0f0f0" }}>
              ${formattedPrice}
            </span>
          </span>
        </div>

        <p className="text-xs" style={{ color: "#555568" }}>
          Price locked at submission &middot;{" "}
          <span style={{ color: "#2ecc71" }}>live tracking started</span>
        </p>
      </div>

      {/* CTA: view trade */}
      <a
        href={result.trade_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between w-full rounded-lg px-6 py-3 text-sm font-bold transition-colors"
        style={{
          background: "#0f0f22",
          border: "1px solid rgba(59,130,246,0.4)",
          color: "#3b82f6",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)")}
      >
        <span>View on paste.trade</span>
        <span>&rarr;</span>
      </a>

      <button
        onClick={onReset}
        className="w-full rounded-lg px-6 py-3 text-sm transition-colors"
        style={{ border: "1px solid #1a1a2e", color: "#c8c8d0" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#3b82f6";
          e.currentTarget.style.color = "#f0f0f0";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#1a1a2e";
          e.currentTarget.style.color = "#c8c8d0";
        }}
      >
        Submit Another
      </button>
    </div>
  );
}

function ErrorCard({ result, onReset }: { result: SubmitError; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-lg p-6 space-y-4"
        style={{ background: "#0f0f22", border: "1px solid rgba(231,76,60,0.3)" }}
      >
        <div>
          <p
            className="text-xs uppercase tracking-widest font-bold mb-2"
            style={{ color: "#e74c3c" }}
          >
            Submission Failed
          </p>
          <p className="text-sm" style={{ color: "#c8c8d0" }}>
            {result.error}
          </p>
        </div>

        {(result.ticker || result.direction || result.thesis) && (
          <div className="pt-4 space-y-3" style={{ borderTop: "1px solid #1a1a2e" }}>
            <p className="text-xs uppercase tracking-widest" style={{ color: "#555568" }}>
              Extracted (not posted)
            </p>
            {result.ticker && (
              <div className="flex items-center gap-3">
                <span className="font-bold" style={{ color: "#f0f0f0" }}>
                  ${result.ticker}
                </span>
                {result.direction && <DirectionBadge direction={result.direction} />}
              </div>
            )}
            {result.thesis && (
              <p className="text-sm leading-relaxed" style={{ color: "#c8c8d0" }}>
                {result.thesis}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onReset}
        className="w-full rounded-lg px-6 py-3 text-sm transition-colors"
        style={{ border: "1px solid #1a1a2e", color: "#c8c8d0" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#3b82f6";
          e.currentTarget.style.color = "#f0f0f0";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#1a1a2e";
          e.currentTarget.style.color = "#c8c8d0";
        }}
      >
        Try Again
      </button>
    </div>
  );
}

// ─── Main inner component (uses useSearchParams) ──────────────────────────────

function UrlSubmitFormInner() {
  const searchParams = useSearchParams();
  const prefilled = searchParams.get("q") ?? "";

  const [input, setInput] = useState(prefilled);
  const [pageState, setPageState] = useState<PageState>("input");
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const submit = async (url: string) => {
    if (!url.trim()) return;
    setPageState("loading");
    setActiveStep(0);
    setResult(null);
    clearTimers();

    // Advance through steps on a schedule while API call runs
    STEP_DELAYS_MS.forEach((delay, i) => {
      timersRef.current.push(setTimeout(() => setActiveStep(i), delay));
    });

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data: SubmitResult = await res.json();

      // Snap all steps complete, then brief pause before showing result
      clearTimers();
      setActiveStep(STEPS.length);
      await new Promise((r) => setTimeout(r, 400));

      setResult(data);
      setPageState(data.ok ? "success" : "error");
    } catch (err) {
      clearTimers();
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Network error. Please try again.",
      });
      setPageState("error");
    }
  };

  // Auto-submit if pre-filled via ?q=
  useEffect(() => {
    if (prefilled) submit(prefilled);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    setPageState("input");
    setInput("");
    setResult(null);
    setActiveStep(0);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-16 pb-20">
      {/* Page header */}
      <section className="mb-10">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3b82f6" }}>
          paste.trade
        </p>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#f0f0f0" }}>
          Submit a Trade
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "#c8c8d0" }}>
          Paste a tweet. We extract the thesis, lock the price, and post it to
          paste.trade for live P&amp;L tracking.
        </p>
      </section>

      {/* URL input — visible during input and loading */}
      {(pageState === "input" || pageState === "loading") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="mb-8"
        >
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://x.com/..."
            disabled={pageState === "loading"}
            autoFocus
            className="w-full rounded-lg px-4 py-3 text-sm placeholder:text-[#555568] focus:outline-none transition-colors disabled:opacity-50"
            style={{
              background: "#0f0f22",
              border: "1px solid #1a1a2e",
              color: "#f0f0f0",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
          />
          <button
            type="submit"
            disabled={pageState === "loading" || !input.trim()}
            className="mt-3 w-full rounded-lg px-6 py-3 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: "1px solid #1a1a2e", color: "#f0f0f0", background: "transparent" }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = "#3b82f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#1a1a2e";
            }}
          >
            {pageState === "loading" ? "Processing..." : "Find & Submit Trade"}
          </button>
          {pageState === "input" && (
            <p className="mt-3 text-center text-xs" style={{ color: "#555568" }}>
              Works with X (Twitter) tweet URLs
            </p>
          )}
        </form>
      )}

      {/* Animated progress steps */}
      {pageState === "loading" && <LoadingSteps activeStep={activeStep} />}

      {/* Success: rich trade card */}
      {pageState === "success" && result?.ok && (
        <SuccessCard result={result as SubmitSuccess} onReset={handleReset} />
      )}

      {/* Error: show what was extracted + failure reason */}
      {pageState === "error" && result && !result.ok && (
        <ErrorCard result={result as SubmitError} onReset={handleReset} />
      )}
    </div>
  );
}

// ─── Export (wrapped in Suspense for useSearchParams) ─────────────────────────

export function UrlSubmitter() {
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
          <p className="text-sm" style={{ color: "#c8c8d0" }}>
            Loading...
          </p>
        </div>
      }
    >
      <UrlSubmitFormInner />
    </Suspense>
  );
}
