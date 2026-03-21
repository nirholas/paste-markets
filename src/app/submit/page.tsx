"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";


/* ─── Trade submission types (existing feature) ──────────────────────────── */

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
    <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-lg font-mono">
      <div className="flex items-center justify-between mb-4">
        <span className="text-text-secondary text-sm">
          {data.author_handle ? `@${data.author_handle}` : "Trade submitted"}
        </span>
        <PlatformBadge platform={data.platform} />
      </div>

      {data.headline_quote && (
        <p className="text-text-primary text-sm mb-4 leading-relaxed border-l-2 border-accent pl-3">
          &quot;{data.headline_quote}&quot;
        </p>
      )}

      {data.ticker && (
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs uppercase tracking-wider">
              Trade:
            </span>
            <span className="text-text-primary text-sm font-bold">
              {data.ticker}
            </span>
            {data.direction && (
              <DirectionBadge direction={data.direction} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs uppercase tracking-wider">
              Entry:
            </span>
            <span className="text-text-primary text-sm">
              {formatPrice(data.author_price)}
            </span>
          </div>
        </div>
      )}

      {data.thesis && (
        <div className="mb-6">
          <span className="text-text-muted text-xs uppercase tracking-wider">
            Thesis:
          </span>
          <p className="text-text-secondary text-sm mt-1 leading-relaxed">
            {data.thesis}
          </p>
        </div>
      )}

      {!data.ticker && !data.thesis && (
        <div className="mb-6">
          <p className="text-text-muted text-sm">
            Status:{" "}
            <span className="text-text-secondary">{data.status ?? "processing"}</span>
          </p>
          <p className="text-text-muted text-xs mt-1">
            Trade data is being extracted. Check the markets page for updates.
          </p>
        </div>
      )}

      <Link
        href={`/markets/${data.source_id}`}
        className="block w-full text-center bg-accent text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition text-sm font-bold"
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

/* ─── Nomination types ────────────────────────────────────────────────────── */

interface Submission {
  id: number;
  caller_handle: string;
  submitted_by: string | null;
  reason: string | null;
  example_tweet_url: string | null;
  upvotes: number;
  status: string;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: "rgba(243, 156, 18, 0.1)", text: "#f39c12", border: "#f39c12" },
    approved: { bg: "rgba(46, 204, 113, 0.1)", text: "#2ecc71", border: "#2ecc71" },
    tracked: { bg: "rgba(46, 204, 113, 0.15)", text: "#2ecc71", border: "#2ecc71" },
    rejected: { bg: "rgba(231, 76, 60, 0.1)", text: "#e74c3c", border: "#e74c3c" },
  };
  const c = colors[status] ?? colors.pending!;
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-bold"
      style={{ background: c!.bg, color: c!.text, border: `1px solid ${c!.border}` }}
    >
      {status === "tracked" ? "Now Tracking" : status}
    </span>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */

export default function SubmitPage() {
  // Trade submission state
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Nomination state
  const [handle, setHandle] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [reason, setReason] = useState("");
  const [exampleUrl, setExampleUrl] = useState("");
  const [nomLoading, setNomLoading] = useState(false);
  const [nomResult, setNomResult] = useState<{ submission: Submission; deduplicated: boolean } | null>(null);
  const [nomError, setNomError] = useState<string | null>(null);

  // Nominations list state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());

  // Load voted IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("paste_voted_ids");
      if (stored) setVotedIds(new Set(JSON.parse(stored)));
    } catch {
      // ignore
    }
  }, []);

  function saveVote(id: number) {
    const updated = new Set(votedIds);
    updated.add(id);
    setVotedIds(updated);
    try {
      localStorage.setItem("paste_voted_ids", JSON.stringify([...updated]));
    } catch {
      // ignore
    }
  }

  // Trade submission helpers
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

  async function pollForTrades(sourceId: string, handle: string | undefined): Promise<SubmitResult | null> {
    const maxAttempts = 10;
    const delay = 2000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, delay));
      try {
        const params = new URLSearchParams();
        if (handle) params.set("handle", handle);
        const res = await fetch(`/api/source/${sourceId}?${params}`);
        if (!res.ok) continue;
        const data = await res.json();

        if (data.trades?.length > 0) {
          const trade = data.trades[0];
          return {
            ok: true,
            source_id: sourceId,
            source_url: data.source_url,
            ticker: trade.ticker,
            direction: trade.direction,
            thesis: trade.thesis,
            author_handle: trade.author_handle ?? handle,
            author_price: trade.author_price ?? trade.posted_price ?? null,
            headline_quote: trade.headline_quote,
            platform: trade.platform,
            status: "completed",
          };
        }

        if (data.status && data.status !== "processing" && data.status !== "pending") {
          break;
        }
      } catch {
        // continue polling
      }
    }

    return null;
  }

  async function handleTradeSubmit(e: React.FormEvent) {
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

      if (data.ok) {
        // Source created — poll paste.trade for extracted trades
        const polled = await pollForTrades(data.source_id, data.author_handle);

        clearTimers();
        setLoading(false);

        if (polled) {
          setResult(polled);
        } else {
          // Still show the result card even if no trades found yet
          setResult(data);
        }
      } else {
        clearTimers();
        setLoading(false);
        setError(data.error);
      }
    } catch {
      clearTimers();
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  // Fetch nominations
  const fetchNominations = useCallback(async () => {
    try {
      const res = await fetch("/api/nominate?sort=upvotes&limit=50");
      const data = await res.json();
      if (data.ok) {
        setSubmissions(data.submissions);
      }
    } catch {
      // silently fail
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNominations();
  }, [fetchNominations]);

  // Submit nomination
  async function handleNominate(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim() || nomLoading) return;

    setNomLoading(true);
    setNomResult(null);
    setNomError(null);

    try {
      const res = await fetch("/api/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim(),
          submitted_by: submittedBy.trim() || undefined,
          reason: reason.trim() || undefined,
          example_tweet_url: exampleUrl.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setNomResult({ submission: data.submission, deduplicated: data.deduplicated });
        setHandle("");
        setSubmittedBy("");
        setReason("");
        setExampleUrl("");
        fetchNominations();
      } else {
        setNomError(data.error);
      }
    } catch {
      setNomError("Network error. Please try again.");
    } finally {
      setNomLoading(false);
    }
  }

  // Upvote
  async function handleUpvote(id: number) {
    if (votedIds.has(id)) return;

    saveVote(id);
    // Optimistic update
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, upvotes: s.upvotes + 1 } : s)),
    );

    try {
      await fetch("/api/nominate/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: id }),
      });
    } catch {
      // revert on error
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, upvotes: s.upvotes - 1 } : s)),
      );
    }
  }

  const shareUrl = nomResult
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `I nominated @${nomResult.submission.caller_handle} for @paste_markets tracking. Upvote → paste.markets/submit`,
      )}`
    : "";

  return (
    <main className="min-h-screen">

      {/* ── Track Any Trade ─────────────────────────────────────────────── */}
      <section className="flex flex-col items-center px-4 pt-20 pb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-3 text-center font-mono">
          Track Any Trade
        </h1>
        <p className="text-text-secondary text-sm md:text-base text-center max-w-md mb-10 font-mono leading-relaxed">
          Paste a tweet, article, or YouTube URL &mdash; we extract the thesis,
          lock the entry price, and track live P&L
        </p>

        <form onSubmit={handleTradeSubmit} className="w-full max-w-lg">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://x.com/..."
              disabled={loading}
              className="bg-surface border border-border text-text-primary rounded px-4 py-3 w-full font-mono text-sm focus:border-accent outline-none placeholder:text-text-muted disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="bg-accent text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition font-mono text-sm font-bold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Track This Trade
            </button>
          </div>
        </form>

        {loading && (
          <div className="mt-8 font-mono text-text-secondary text-sm">
            {LOADING_STAGES[stageIndex]} <BlinkingCursor />
          </div>
        )}

        {error && !loading && (
          <div className="mt-8 w-full max-w-lg">
            <div className="bg-surface border border-loss rounded-lg p-4 font-mono">
              <p className="text-loss text-sm mb-3">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-text-muted text-xs hover:text-text-secondary transition"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="mt-8 w-full max-w-lg">
            <p className="text-text-muted text-xs uppercase tracking-wider font-mono mb-4">
              Trade Tracked
            </p>
            <TradeCard data={result} />
          </div>
        )}
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="border-t border-border" />
      </div>

      {/* ── Nominate a Caller ────────────────────────────────────────────── */}
      <section className="flex flex-col items-center px-4 pt-16 pb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-3 text-center font-mono">
          Nominate a Caller
        </h2>
        <p className="text-text-secondary text-sm text-center max-w-md mb-10 font-mono leading-relaxed">
          Know someone making good calls? Nominate them to be tracked on
          paste.markets. Top-voted nominations get added first.
        </p>

        <form onSubmit={handleNominate} className="w-full max-w-lg space-y-4">
          <div>
            <label className="text-text-muted text-xs uppercase tracking-widest font-mono block mb-2">
              Caller Handle *
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@handle"
              disabled={nomLoading}
              className="bg-surface border border-border text-text-primary rounded px-4 py-3 w-full font-mono text-sm focus:border-accent outline-none placeholder:text-text-muted disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-text-muted text-xs uppercase tracking-widest font-mono block mb-2">
              Your Handle (optional)
            </label>
            <input
              type="text"
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              placeholder="@your_handle"
              disabled={nomLoading}
              className="bg-surface border border-border text-text-primary rounded px-4 py-3 w-full font-mono text-sm focus:border-accent outline-none placeholder:text-text-muted disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-text-muted text-xs uppercase tracking-widest font-mono block mb-2">
              Why should we track them? (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Great calls on memecoins, 80%+ win rate..."
              disabled={nomLoading}
              rows={2}
              className="bg-surface border border-border text-text-primary rounded px-4 py-3 w-full font-mono text-sm focus:border-accent outline-none placeholder:text-text-muted disabled:opacity-50 resize-none"
            />
          </div>

          <div>
            <label className="text-text-muted text-xs uppercase tracking-widest font-mono block mb-2">
              Example tweet URL (optional)
            </label>
            <input
              type="url"
              value={exampleUrl}
              onChange={(e) => setExampleUrl(e.target.value)}
              placeholder="https://x.com/handle/status/..."
              disabled={nomLoading}
              className="bg-surface border border-border text-text-primary rounded px-4 py-3 w-full font-mono text-sm focus:border-accent outline-none placeholder:text-text-muted disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={nomLoading || !handle.trim()}
            className="w-full bg-accent text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition font-mono text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {nomLoading ? "Submitting..." : "Nominate Caller"}
          </button>
        </form>

        {/* Nomination confirmation */}
        {nomResult && (
          <div className="mt-8 w-full max-w-lg">
            <div className="bg-surface border border-win rounded-lg p-6 font-mono">
              <p className="text-win text-sm font-bold mb-2">
                {nomResult.deduplicated
                  ? `@${nomResult.submission.caller_handle} was already nominated — your upvote has been counted!`
                  : `Thanks! @${nomResult.submission.caller_handle} has been nominated.`}
              </p>
              <p className="text-text-secondary text-sm mb-4">
                Current upvotes: {nomResult.submission.upvotes}
              </p>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block border border-accent text-accent px-4 py-2 rounded-lg text-xs font-bold hover:bg-accent hover:text-white transition"
              >
                Share to boost
              </a>
            </div>
          </div>
        )}

        {nomError && (
          <div className="mt-8 w-full max-w-lg">
            <div className="bg-surface border border-loss rounded-lg p-4 font-mono">
              <p className="text-loss text-sm">{nomError}</p>
            </div>
          </div>
        )}
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="border-t border-border" />
      </div>

      {/* ── Pending Nominations ──────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 pt-16 pb-20">
        <h2 className="text-xl font-bold text-text-primary mb-2 font-mono">
          Pending Nominations
        </h2>
        <p className="text-text-muted text-xs uppercase tracking-widest font-mono mb-6">
          Upvote callers you want tracked
        </p>

        {listLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-lg p-4 animate-pulse h-16"
              />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center font-mono">
            <p className="text-text-muted text-sm">
              No nominations yet. Be the first to nominate a caller!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((s) => {
              const hasVoted = votedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-4 font-mono hover:border-accent/30 transition"
                >
                  {/* Upvote button */}
                  <button
                    onClick={() => handleUpvote(s.id)}
                    disabled={hasVoted}
                    className={`flex flex-col items-center min-w-[48px] rounded-lg px-2 py-1 text-xs transition ${
                      hasVoted
                        ? "border border-win/40 text-win cursor-default"
                        : "border border-border text-text-muted hover:border-win hover:text-win cursor-pointer"
                    }`}
                  >
                    <span className="text-sm leading-none">{hasVoted ? "\u25B2" : "\u25B3"}</span>
                    <span className="font-bold">{s.upvotes}</span>
                  </button>

                  {/* Handle + details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-text-primary text-sm font-bold">
                        @{s.caller_handle}
                      </span>
                      <StatusBadge status={s.status} />
                      {s.submitted_by && (
                        <span className="text-text-muted text-xs">
                          by @{s.submitted_by}
                        </span>
                      )}
                    </div>
                    {s.reason && (
                      <p className="text-text-muted text-xs mt-1 truncate">
                        {s.reason}
                      </p>
                    )}
                  </div>

                  {/* Time + link */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-text-muted text-xs hidden sm:block">
                      {timeAgo(s.created_at)}
                    </span>
                    {s.example_tweet_url && (
                      <a
                        href={s.example_tweet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent text-xs hover:underline hidden sm:block"
                      >
                        example
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
