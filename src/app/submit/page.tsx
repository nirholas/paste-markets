"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Nav from "@/components/ui/nav";

interface SubmitResult {
  ok: true;
  source_id: string;
  source_url?: string;
  ticker?: string;
  direction?: string;
  thesis?: string;
  author_handle?: string;
  author_price?: number | null;
  headline_quote?: string;
  platform?: string;
  status?: string;
}

interface SubmitError {
  ok: false;
  error: string;
}

type SubmitResponse = SubmitResult | SubmitError;

const LOADING_STAGES = [
  "Fetching source...",
  "Extracting thesis...",
  "Locking entry price...",
  "Posting to paste.markets...",
];

const STAGE_DURATIONS = [1000, 2000, 2000];

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "Price pending";
  return (
    "$" +
    price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isLong =
    direction.toLowerCase() === "long" || direction.toLowerCase() === "yes";
  return (
    <span
      className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider"
      style={{
        color: isLong ? "#2ecc71" : "#e74c3c",
        border: `1px solid ${isLong ? "#2ecc71" : "#e74c3c"}`,
      }}
    >
      {isLong ? "LONG" : "SHORT"}
    </span>
  );
}

function PlatformBadge({ platform }: { platform?: string }) {
  if (!platform) return null;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded uppercase tracking-wider"
      style={{ color: "#555568", border: "1px solid #1a1a2e" }}
    >
      {platform}
    </span>
  );
}

function TradeCard({ data }: { data: SubmitResult }) {
  return (
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 w-full max-w-lg font-mono">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#c8c8d0] text-sm">
          {data.author_handle ? `@${data.author_handle}` : "Trade submitted"}
        </span>
        <PlatformBadge platform={data.platform} />
      </div>

      {data.headline_quote && (
        <p className="text-[#f0f0f0] text-sm mb-4 leading-relaxed border-l-2 border-[#3b82f6] pl-3">
          &quot;{data.headline_quote}&quot;
        </p>
      )}

      {data.ticker && (
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[#555568] text-xs uppercase tracking-wider">
              Trade:
            </span>
            <span className="text-[#f0f0f0] text-sm font-bold">
              {data.ticker}
            </span>
            {data.direction && (
              <DirectionBadge direction={data.direction} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#555568] text-xs uppercase tracking-wider">
              Entry:
            </span>
            <span className="text-[#f0f0f0] text-sm">
              {formatPrice(data.author_price)}
            </span>
          </div>
        </div>
      )}

      {data.thesis && (
        <div className="mb-6">
          <span className="text-[#555568] text-xs uppercase tracking-wider">
            Thesis:
          </span>
          <p className="text-[#c8c8d0] text-sm mt-1 leading-relaxed">
            {data.thesis}
          </p>
        </div>
      )}

      {!data.ticker && !data.thesis && (
        <div className="mb-6">
          <p className="text-[#555568] text-sm">
            Status:{" "}
            <span className="text-[#c8c8d0]">{data.status ?? "processing"}</span>
          </p>
          <p className="text-[#555568] text-xs mt-1">
            Trade data is being extracted. Check the markets page for updates.
          </p>
        </div>
      )}

      <Link
        href={`/markets/${data.source_id}`}
        className="block w-full text-center bg-[#3b82f6] text-white px-6 py-3 rounded hover:bg-blue-500 transition text-sm font-bold"
      >
        View Live P&L &rarr;
      </Link>
    </div>
  );
}

function BlinkingCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ opacity: visible ? 1 : 0 }} aria-hidden="true">
      _
    </span>
  );
}

export default function SubmitPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function startStages() {
    clearTimers();
    setStageIndex(0);
    let elapsed = 0;
    STAGE_DURATIONS.forEach((duration, i) => {
      elapsed += duration;
      const t = setTimeout(() => setStageIndex(i + 1), elapsed);
      timers.current.push(t);
    });
  }

  useEffect(() => {
    return clearTimers;
  }, []); // eslint-disable-line

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    startStages();

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data: SubmitResponse = await res.json();

      clearTimers();
      setLoading(false);

      if (data.ok) {
        setResult(data);
      } else {
        setError(data.error);
      }
    } catch {
      clearTimers();
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  return (
    <main className="min-h-screen">
      <Nav />

      {/* Hero */}
      <section className="flex flex-col items-center px-4 pt-20 pb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-[#f0f0f0] mb-3 text-center font-mono">
          Track Any Trade
        </h1>
        <p className="text-[#c8c8d0] text-sm md:text-base text-center max-w-md mb-10 font-mono leading-relaxed">
          Paste a tweet, article, or YouTube URL &mdash; we extract the thesis,
          lock the entry price, and track live P&L
        </p>

        {/* Input */}
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://x.com/..."
              disabled={loading}
              className="bg-[#0f0f22] border border-[#1a1a2e] text-[#f0f0f0] rounded px-4 py-3 w-full font-mono text-sm focus:border-[#3b82f6] outline-none placeholder:text-[#555568] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="bg-[#3b82f6] text-white px-6 py-3 rounded hover:bg-blue-500 transition font-mono text-sm font-bold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Track This Trade
            </button>
          </div>
        </form>

        {/* Loading state */}
        {loading && (
          <div className="mt-8 font-mono text-[#c8c8d0] text-sm">
            {LOADING_STAGES[stageIndex]} <BlinkingCursor />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="mt-8 w-full max-w-lg">
            <div className="bg-[#0f0f22] border border-[#e74c3c] rounded-lg p-4 font-mono">
              <p className="text-[#e74c3c] text-sm mb-3">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-[#555568] text-xs hover:text-[#c8c8d0] transition"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="mt-8 w-full max-w-lg">
            <p className="text-[#555568] text-xs uppercase tracking-wider font-mono mb-4">
              Trade Tracked
            </p>
            <TradeCard data={result} />
          </div>
        )}
      </section>
    </main>
  );
}
