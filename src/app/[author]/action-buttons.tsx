"use client";

import Link from "next/link";
import { useState } from "react";

interface ActionButtonsProps {
  handle: string;
  metrics?: {
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    streak: number;
    bestTrade?: { ticker: string; direction: string; pnl: number } | null;
  };
}

export function ActionButtons({ handle, metrics }: ActionButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [compareInput, setCompareInput] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  function handleShare() {
    const url = `${window.location.origin}/${handle}`;
    const pnlSign = metrics && metrics.avgPnl >= 0 ? "+" : "";
    const text = metrics
      ? `@${handle} on paste.markets\n\n${Math.round(metrics.winRate)}% win rate | ${pnlSign}${metrics.avgPnl.toFixed(1)}% avg P&L | ${metrics.totalTrades} trades\n\nCheck your scorecard:`
      : `@${handle}'s trade scorecard on paste.markets`;
    const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer,width=600,height=400");
  }

  function handleTweetStats() {
    const url = `${window.location.origin}/${handle}`;
    let text: string;
    if (metrics) {
      const pnlSign = metrics.avgPnl >= 0 ? "+" : "";
      const winRateStr = `${Math.round(metrics.winRate)}% win rate`;
      const bestStr =
        metrics.bestTrade
          ? `Best call: $${metrics.bestTrade.ticker} ${metrics.bestTrade.direction.toUpperCase()} +${metrics.bestTrade.pnl.toFixed(1)}%`
          : `${pnlSign}${metrics.avgPnl.toFixed(1)}% avg P&L`;
      text = `My calls on @paste_markets\n\n${winRateStr} · ${bestStr}\n${metrics.totalTrades} tracked trades`;
    } else {
      text = `Check out @${handle}'s trade scorecard on @paste_markets`;
    }
    const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer,width=600,height=400");
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleCompareSubmit() {
    const other = compareInput.trim().replace(/^@/, "");
    if (other) {
      window.location.href = `/vs/${handle}/${encodeURIComponent(other)}`;
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleTweetStats}
          className="border border-accent text-accent hover:bg-accent/10 px-4 py-2 rounded-lg text-sm transition-colors font-bold"
        >
          Tweet My Stats
        </button>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {showPreview ? "Hide Scorecard" : "Share Scorecard"}
        </button>

        <button
          onClick={handleCopyLink}
          className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>

        {!showCompare ? (
          <button
            onClick={() => setShowCompare(true)}
            className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Compare &harr;
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface border border-border rounded-lg px-3 py-1.5 focus-within:border-accent transition-colors">
              <span className="text-text-muted text-sm mr-1 select-none">@</span>
              <input
                type="text"
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCompareSubmit()}
                placeholder="other handle"
                autoFocus
                className="bg-transparent outline-none text-text-primary placeholder:text-text-muted font-mono text-sm w-32"
              />
            </div>
            <button
              onClick={handleCompareSubmit}
              className="border border-accent text-accent hover:bg-accent/10 px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Go
            </button>
            <button
              onClick={() => setShowCompare(false)}
              className="text-text-muted hover:text-text-secondary text-sm px-2"
            >
              &times;
            </button>
          </div>
        )}

        <Link
          href={`/wrapped/${handle}`}
          className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
        >
          View Wrapped
        </Link>
      </div>

      {/* Scorecard Preview */}
      {showPreview && (
        <div className="mt-6 space-y-4">
          <div className="bg-surface border border-border rounded-lg p-4 overflow-hidden">
            <div className="text-[11px] uppercase tracking-[2px] text-text-muted mb-3">
              Scorecard Preview
            </div>
            <img
              src={`/api/og/author/${handle}`}
              alt={`@${handle} scorecard`}
              className="w-full rounded-lg border border-border"
              style={{ aspectRatio: "1200/630" }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleShare}
              className="border border-accent text-accent hover:bg-accent/10 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Post to X
            </button>
            <a
              href={`/api/og/author/${handle}`}
              download={`${handle}-scorecard.png`}
              className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Download Image
            </a>
          </div>
        </div>
      )}
    </>
  );
}
