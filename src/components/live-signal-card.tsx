"use client";

import Link from "next/link";
import type { NewTradeEvent } from "@/lib/tweet-poller";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 85
      ? "#2ecc71"
      : pct >= 70
        ? "#f39c12"
        : "#e74c3c";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export interface LiveSignalCardProps {
  event: NewTradeEvent;
  animate?: boolean;
}

export function LiveSignalCard({ event, animate = true }: LiveSignalCardProps) {
  const handle = event.handle.replace(/^@/, "");
  const isLong = event.direction === "long" || event.direction === "yes";
  const borderAccent = isLong ? "border-[#2ecc71]/30" : "border-[#e74c3c]/30";
  const quote = event.tweetText.slice(0, 140);

  return (
    <div
      className={`bg-[#0f0f22] border ${borderAccent} rounded-lg p-4 space-y-3 transition-all ${
        animate ? "animate-slide-in" : ""
      }`}
    >
      {/* Header: LIVE badge + handle + time */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#e74c3c] border border-[#e74c3c]/50 px-1.5 py-0.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e74c3c] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#e74c3c]" />
            </span>
            LIVE
          </span>
          <Link
            href={`/${handle}`}
            className="text-[#c8c8d0] hover:text-[#3b82f6] transition-colors font-mono text-xs"
          >
            @{handle}
          </Link>
        </div>
        <span className="text-[11px] text-[#555568] shrink-0 font-mono">
          {timeAgo(event.tweetDate)}
        </span>
      </div>

      {/* Tweet text */}
      {quote && (
        <p className="text-[#c8c8d0] text-xs border-l-2 border-[#1a1a2e] pl-3 leading-relaxed italic line-clamp-2">
          &ldquo;{quote}&rdquo;
        </p>
      )}

      {/* Trade details */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
            isLong ? "text-[#2ecc71] border-[#2ecc71]/50" : "text-[#e74c3c] border-[#e74c3c]/50"
          }`}
        >
          {event.direction}
        </span>
        <Link
          href={`/ticker/${event.ticker}`}
          className="text-base font-bold text-[#f0f0f0] hover:text-[#3b82f6] transition-colors tracking-tight"
        >
          ${event.ticker}
        </Link>
        {event.platform && (
          <span className="text-[10px] uppercase tracking-widest text-[#555568] border border-[#1a1a2e] px-1.5 py-0.5">
            {event.platform}
          </span>
        )}
      </div>

      {/* Entry price + confidence */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-[#555568] font-mono">
          {event.entryPrice != null && (
            <span>
              <span className="text-[#555568]">Entry </span>
              <span className="text-[#c8c8d0]">{formatPrice(event.entryPrice)}</span>
            </span>
          )}
        </div>
        <div className="w-24">
          <ConfidenceBar confidence={event.confidence} />
        </div>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-3 pt-2 border-t border-[#1a1a2e]">
        {event.tweetUrl && (
          <a
            href={event.tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#555568] hover:text-[#3b82f6] transition-colors font-mono"
          >
            View Tweet →
          </a>
        )}
        {event.tradeUrl && (
          <a
            href={event.tradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#555568] hover:text-[#3b82f6] transition-colors font-mono"
          >
            Track Trade →
          </a>
        )}
      </div>
    </div>
  );
}
