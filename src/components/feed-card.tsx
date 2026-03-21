"use client";

import Link from "next/link";
import type { FeedItem } from "@/app/api/feed/route";
import { tierColor } from "@/lib/alpha";
import { TimeAgo } from "@/components/time-ago";

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

const VENUE_COLORS: Record<string, { color: string; label: string }> = {
  robinhood: { color: "#2ecc71", label: "Robinhood" },
  hyperliquid: { color: "#3b82f6", label: "Hyperliquid" },
  polymarket: { color: "#f59e0b", label: "Polymarket" },
};

export interface FeedCardProps {
  item: FeedItem;
  showWagerCta?: boolean;
  onWagerClick?: (item: FeedItem) => void;
}

export function FeedCard({ item }: FeedCardProps) {
  const quote = (item.headline_quote ?? item.thesis ?? "").slice(0, 160);
  const handle = item.author_handle.replace(/^@/, "");
  const isLong = item.direction === "long" || item.direction === "yes";
  const dirColor = isLong ? "#22c55e" : "#ef4444";
  const tradeHref = item.source_url ?? `/${handle}`;
  const tierClr = item.author_tier ? tierColor(item.author_tier as Parameters<typeof tierColor>[0]) : null;

  const pnlLabel =
    item.pnl_pct == null
      ? "OPEN"
      : `${item.pnl_pct >= 0 ? "+" : ""}${item.pnl_pct.toFixed(1)}%`;
  const pnlColor =
    item.pnl_pct == null ? "#a1a1aa" : item.pnl_pct >= 0 ? "#22c55e" : "#ef4444";

  const venue = item.platform ? VENUE_COLORS[item.platform.toLowerCase()] : null;

  return (
    <div className="bg-[#111111] border border-[#ffffff0d] rounded-2xl p-5 sm:p-6 hover:border-[#ffffff1a] transition-all shadow-lg shadow-black/20">
      {/* Hero P&L + Ticker row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {/* Direction badge with arrow */}
          <span
            className="inline-flex items-center gap-1 text-xs font-bold uppercase px-2.5 py-1 rounded-lg"
            style={{ color: dirColor, backgroundColor: `${dirColor}14` }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              {isLong ? (
                <path d="M5 1L9 6H1L5 1Z" />
              ) : (
                <path d="M5 9L1 4H9L5 9Z" />
              )}
            </svg>
            {item.direction}
          </span>
          <Link
            href={`/ticker/${item.ticker.toUpperCase()}`}
            className="text-[#f5f5f7] font-bold text-xl hover:text-[#0066FF] transition-colors font-mono tracking-tight"
          >
            ${item.ticker.toUpperCase()}
          </Link>
          {/* Venue badge with branded color */}
          {venue && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
              style={{ color: venue.color, backgroundColor: `${venue.color}14` }}
            >
              {venue.label}
            </span>
          )}
          {item.platform && !venue && (
            <span className="text-[11px] text-[#52525b] bg-[#ffffff08] px-2 py-0.5 rounded-lg">
              {item.platform}
            </span>
          )}
        </div>

        {/* Hero P&L — big, bold, no pill background */}
        <div
          className="shrink-0 font-mono font-bold text-2xl tracking-tight"
          style={{ color: pnlColor }}
        >
          {pnlLabel}
        </div>
      </div>

      {/* Quote */}
      {quote && (
        <p className="text-[#a1a1aa] text-sm leading-relaxed mb-4 line-clamp-2">
          &ldquo;{quote}&rdquo;
        </p>
      )}

      {/* Price info */}
      {(item.entry_price != null || item.current_price != null) && (
        <div className="flex items-center gap-3 text-xs text-[#52525b] font-mono mb-4">
          {item.entry_price != null && (
            <span>
              Entry <span className="text-[#a1a1aa]">{formatPrice(item.entry_price)}</span>
            </span>
          )}
          {item.entry_price != null && item.current_price != null && (
            <span className="text-[#ffffff14]">&rarr;</span>
          )}
          {item.current_price != null && (
            <span>
              Now <span className="text-[#a1a1aa]">{formatPrice(item.current_price)}</span>
            </span>
          )}
        </div>
      )}

      {/* Social proof */}
      {item.wager_count > 0 && (
        <div className="flex items-center gap-2 text-xs text-[#52525b] mb-4">
          <span className="text-[#0066FF] font-semibold">{item.wager_count} backed</span>
          <span>&middot;</span>
          <span>{item.wager_total.toFixed(0)} USDC</span>
        </div>
      )}

      {/* Author + Actions footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#ffffff0d]">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/${handle}`} className="shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0066FF] to-[#3385FF] flex items-center justify-center text-white text-xs font-bold">
              {handle[0]?.toUpperCase()}
            </div>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/${handle}`}
                className="text-[#f5f5f7] font-medium text-sm hover:text-[#0066FF] transition-colors truncate"
              >
                @{handle}
              </Link>
              {tierClr && (
                <span
                  className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-lg"
                  style={{ color: tierClr, backgroundColor: `${tierClr}18` }}
                >
                  {item.author_tier}
                </span>
              )}
              {item.win_rate != null && item.win_rate > 0 && (
                <span className="text-[#52525b] text-[11px]">{Math.round(item.win_rate)}% WR</span>
              )}
            </div>
            <TimeAgo date={item.created_at} className="text-[#52525b] text-[11px]" />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <a
            href={tradeHref}
            target={item.source_url ? "_blank" : undefined}
            rel={item.source_url ? "noopener noreferrer" : undefined}
            className="text-[13px] text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-[#ffffff0a] px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            View
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`@${handle} called ${item.direction.toUpperCase()} $${item.ticker.toUpperCase()} on paste.markets — ${pnlLabel}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-[#a1a1aa] hover:text-[#0066FF] hover:bg-[#0066FF]/10 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </a>
        </div>
      </div>
    </div>
  );
}
