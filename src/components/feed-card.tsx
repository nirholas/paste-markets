"use client";

import Link from "next/link";
import type { FeedItem } from "@/app/api/feed/route";
import { tierColor } from "@/lib/alpha";
import { DoubleDownButton } from "@/components/double-down-popover";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function DirectionBadge({ direction }: { direction: string }) {
  const isLong = direction === "long" || direction === "yes";
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
        isLong ? "text-[#2ecc71] border-[#2ecc71]/50" : "text-[#e74c3c] border-[#e74c3c]/50"
      }`}
    >
      {direction}
    </span>
  );
}

function TierBadge({ tier, alphaScore }: { tier: string | null; alphaScore: number | null }) {
  if (!tier) return null;
  const color = tierColor(tier as Parameters<typeof tierColor>[0]);
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border"
      style={{ color, borderColor: `${color}50` }}
    >
      {tier}
    </span>
  );
}

function PnlBadge({ pnl }: { pnl: number | null }) {
  if (pnl == null) {
    return <span className="text-[#555568] text-xs font-mono">OPEN</span>;
  }
  const color = pnl >= 0 ? "#2ecc71" : "#e74c3c";
  const label = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`;
  return (
    <span className="text-sm font-bold font-mono" style={{ color }}>
      {label}
    </span>
  );
}

export interface FeedCardProps {
  item: FeedItem;
  /** Show "Back This Call" CTA — only if wager is enabled */
  showWagerCta?: boolean;
  onWagerClick?: (item: FeedItem) => void;
}

export function FeedCard({ item, showWagerCta = false, onWagerClick }: FeedCardProps) {
  const quote = (item.headline_quote ?? item.thesis ?? "").slice(0, 120);
  const handle = item.author_handle.replace(/^@/, "");
  const isLong = item.direction === "long" || item.direction === "yes";
  const borderAccent = isLong ? "hover:border-[#2ecc71]/30" : "hover:border-[#e74c3c]/30";
  const tradeHref = item.source_url ?? `/${handle}`;

  return (
    <div
      className={`bg-[#0f0f22] border border-[#1a1a2e] ${borderAccent} rounded-lg p-4 space-y-3 transition-colors`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <DirectionBadge direction={item.direction} />
          <Link
            href={`/ticker/${item.ticker.toUpperCase()}`}
            className="text-base font-bold text-[#f0f0f0] hover:text-[#3b82f6] transition-colors tracking-tight"
          >
            ${item.ticker.toUpperCase()}
          </Link>
          {item.platform && (
            <span className="text-[10px] uppercase tracking-widest text-[#555568] border border-[#1a1a2e] px-1.5 py-0.5">
              {item.platform}
            </span>
          )}
          {item.author_tier && (
            <TierBadge tier={item.author_tier} alphaScore={item.author_alpha_score} />
          )}
        </div>
        <span className="text-[11px] text-[#555568] shrink-0 font-mono">
          {timeAgo(item.created_at)}
        </span>
      </div>

      {/* Author */}
      <div className="flex items-center gap-2 text-xs">
        <Link
          href={`/${handle}`}
          className="text-[#c8c8d0] hover:text-[#3b82f6] transition-colors font-mono"
        >
          @{handle}
        </Link>
        {item.win_rate != null && item.win_rate > 0 && (
          <span className="text-[#555568]">{Math.round(item.win_rate)}% WR</span>
        )}
      </div>

      {/* Headline quote */}
      {quote && (
        <p className="text-[#c8c8d0] text-xs border-l-2 border-[#1a1a2e] pl-3 leading-relaxed italic line-clamp-2">
          &ldquo;{quote}&rdquo;
        </p>
      )}

      {/* Prices + PnL */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-[#555568] font-mono">
          {item.entry_price != null && (
            <span>
              <span className="text-[#555568]">Entry </span>
              <span className="text-[#c8c8d0]">{formatPrice(item.entry_price)}</span>
            </span>
          )}
          {item.entry_price != null && item.current_price != null && (
            <span className="text-[#1a1a2e]">→</span>
          )}
          {item.current_price != null && (
            <span>
              <span className="text-[#555568]">Now </span>
              <span className="text-[#c8c8d0]">{formatPrice(item.current_price)}</span>
            </span>
          )}
        </div>
        <PnlBadge pnl={item.pnl_pct} />
      </div>

      {/* Wager social proof */}
      {item.wager_count > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-[#555568] font-mono">
          <span className="text-[#f0f0f0]">&#x2B06; {item.wager_count}</span> backed
          <span>·</span>
          <span>{item.wager_total.toFixed(0)} USDC wagered</span>
        </div>
      )}

      {/* Footer: CTAs + Double Down */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1a1a2e]">
        <div className="flex items-center gap-3">
          <DoubleDownButton
            tradeId={item.id}
            ticker={item.ticker}
            direction={item.direction}
            authorHandle={handle}
            totalWagered={item.wager_total}
            backerCount={item.wager_count}
          />
          <a
            href={tradeHref}
            target={item.source_url ? "_blank" : undefined}
            rel={item.source_url ? "noopener noreferrer" : undefined}
            className="text-[11px] text-[#555568] hover:text-[#3b82f6] transition-colors font-mono"
          >
            View Trade
          </a>
        </div>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I'm backing @${handle}'s $${item.ticker.toUpperCase()} ${item.direction} call on paste.markets`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#555568] hover:text-[#3b82f6] transition-colors font-mono"
        >
          Share
        </a>
      </div>
    </div>
  );
}
