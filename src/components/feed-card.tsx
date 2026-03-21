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

  return (
    <div className="bg-[#111111] border border-[#ffffff0d] rounded-2xl p-4 sm:p-5 hover:border-[#ffffff14] transition-colors">
      {/* Author row */}
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/${handle}`} className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0066FF] to-[#3385FF] flex items-center justify-center text-white text-sm font-bold">
            {handle[0]?.toUpperCase()}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/${handle}`}
              className="text-[#f5f5f7] font-semibold text-sm hover:text-[#0066FF] transition-colors truncate"
            >
              @{handle}
            </Link>
            {tierClr && (
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                style={{ color: tierClr, backgroundColor: `${tierClr}18` }}
              >
                {item.author_tier}
              </span>
            )}
            {item.win_rate != null && item.win_rate > 0 && (
              <span className="text-[#52525b] text-xs">{Math.round(item.win_rate)}% WR</span>
            )}
          </div>
          <TimeAgo date={item.created_at} className="text-[#52525b] text-xs" />
        </div>

        {/* P&L badge */}
        <div
          className="shrink-0 font-mono font-bold text-sm px-3 py-1.5 rounded-full"
          style={{
            color: pnlColor,
            backgroundColor: item.pnl_pct == null ? "#ffffff08" : `${pnlColor}14`,
          }}
        >
          {pnlLabel}
        </div>
      </div>

      {/* Trade call */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className="text-xs font-bold uppercase px-2.5 py-1 rounded-full"
          style={{ color: dirColor, backgroundColor: `${dirColor}14` }}
        >
          {item.direction}
        </span>
        <Link
          href={`/ticker/${item.ticker.toUpperCase()}`}
          className="text-[#f5f5f7] font-bold text-lg hover:text-[#0066FF] transition-colors font-mono"
        >
          ${item.ticker.toUpperCase()}
        </Link>
        {item.platform && (
          <span className="text-[11px] text-[#52525b] bg-[#ffffff08] px-2 py-0.5 rounded-full">
            {item.platform}
          </span>
        )}
      </div>

      {/* Quote */}
      {quote && (
        <p className="text-[#a1a1aa] text-sm leading-relaxed mb-3 line-clamp-2">
          &ldquo;{quote}&rdquo;
        </p>
      )}

      {/* Price info */}
      {(item.entry_price != null || item.current_price != null) && (
        <div className="flex items-center gap-3 text-xs text-[#52525b] font-mono mb-3">
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
        <div className="flex items-center gap-2 text-xs text-[#52525b] mb-3">
          <span className="text-[#0066FF] font-semibold">{item.wager_count} backed</span>
          <span>&middot;</span>
          <span>{item.wager_total.toFixed(0)} USDC</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-[#ffffff0d]">
        <div className="flex items-center gap-1">
          <a
            href={tradeHref}
            target={item.source_url ? "_blank" : undefined}
            rel={item.source_url ? "noopener noreferrer" : undefined}
            className="text-[13px] text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-[#ffffff0a] px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            View
          </a>
          <Link
            href={`/${handle}`}
            className="text-[13px] text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-[#ffffff0a] px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Profile
          </Link>
        </div>
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
  );
}
