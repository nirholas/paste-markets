import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

interface PageProps {
  params: Promise<{ source_id: string }>;
}

interface Segment {
  quote: string;
  speaker: string;
}

interface Derivation {
  explanation: string;
  segments: Segment[];
}

interface Trade {
  id: string;
  thesis: string;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  author_price: number | null;
  posted_price: number | null;
  author_handle: string;
  source_url: string;
  author_date: string;
  instrument: string;
  platform: string;
  headline_quote: string;
  ticker_context: string;
  horizon: string;
  author_avatar_url: string;
  card_headline: string;
  derivation: Derivation;
}

interface Source {
  id: string;
  url: string;
  title: string;
  platform: string;
  published_at: string;
  created_at: string;
  source_images: string[];
  summary: string;
  source_summary: string;
  status: string;
}

interface Author {
  id: string;
  handle: string;
  name: string | null;
  avatar_url: string;
  twitter_url: string;
  platform: string;
}

interface SourceData {
  source: Source;
  author: Author;
  trades: Trade[];
}

async function fetchSourceData(source_id: string): Promise<SourceData | null> {
  try {
    const res = await fetch(`https://paste.trade/api/sources/${source_id}`, {
      headers: { Authorization: `Bearer ${process.env.PASTE_TRADE_KEY}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function computePnl(trade: Trade): number | null {
  const { author_price, posted_price, direction } = trade;
  if (!author_price || !posted_price) return null;
  const isShort = direction === "short" || direction === "no";
  if (isShort) {
    return ((author_price - posted_price) / author_price) * 100;
  }
  return ((posted_price - author_price) / author_price) * 100;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPnl(pnl: number | null): { text: string; color: string } {
  if (pnl === null) return { text: "–", color: "#555568" };
  const sign = pnl >= 0 ? "+" : "";
  return {
    text: `${sign}${pnl.toFixed(2)}%`,
    color: pnl >= 0 ? "#2ecc71" : "#e74c3c",
  };
}

function PlatformBadge({ platform }: { platform: string }) {
  const labels: Record<string, string> = {
    x: "X",
    twitter: "X",
    youtube: "YouTube",
    article: "Article",
    substack: "Substack",
  };
  return (
    <span
      className="inline-block text-[11px] uppercase tracking-widest px-2 py-0.5 rounded border"
      style={{ borderColor: "#1a1a2e", color: "#555568" }}
    >
      {labels[platform.toLowerCase()] ?? platform}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isLong = direction === "long" || direction === "yes";
  return (
    <span
      className="inline-block text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
      style={{
        backgroundColor: isLong ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
        color: isLong ? "#2ecc71" : "#e74c3c",
        border: `1px solid ${isLong ? "#2ecc71" : "#e74c3c"}`,
      }}
    >
      {direction.toUpperCase()}
    </span>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const pnl = computePnl(trade);
  const { text: pnlText, color: pnlColor } = formatPnl(pnl);

  return (
    <div
      className="rounded-lg p-6 mb-4"
      style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#f0f0f0] font-bold text-base">{trade.ticker}</span>
          <DirectionBadge direction={trade.direction} />
          <span className="text-[11px] uppercase tracking-widest" style={{ color: "#555568" }}>
            {trade.platform} &middot; {trade.instrument}
          </span>
        </div>
        <div className="text-right ml-4 shrink-0">
          <span className="text-base font-bold" style={{ color: pnlColor }}>
            {pnlText}
          </span>
          <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "#555568" }}>
            P&L since call
          </div>
          <div className="text-[9px]" style={{ color: "#555568" }}>
            (vs posted price)
          </div>
        </div>
      </div>

      {/* Headline quote */}
      {trade.headline_quote && (
        <p className="text-sm italic mb-3" style={{ color: "#c8c8d0" }}>
          &ldquo;{trade.headline_quote}&rdquo;
        </p>
      )}

      {/* Thesis */}
      {trade.thesis && (
        <p className="text-sm mb-4" style={{ color: "#c8c8d0" }}>
          <span className="text-[11px] uppercase tracking-widest mr-2" style={{ color: "#555568" }}>
            Thesis:
          </span>
          {trade.thesis}
        </p>
      )}

      {/* Entry + Horizon */}
      <div className="flex gap-6 mb-4 text-sm">
        {trade.author_price && (
          <div>
            <span className="text-[11px] uppercase tracking-widest mr-1" style={{ color: "#555568" }}>
              Entry:
            </span>
            <span style={{ color: "#f0f0f0" }}>
              ${trade.author_price.toFixed(2)}
            </span>
          </div>
        )}
        {trade.horizon && (
          <div>
            <span className="text-[11px] uppercase tracking-widest mr-1" style={{ color: "#555568" }}>
              Horizon:
            </span>
            <span style={{ color: "#f0f0f0" }}>{trade.horizon}</span>
          </div>
        )}
      </div>

      {/* Derivation explanation */}
      {trade.derivation?.explanation && (
        <div className="mb-3">
          <span className="text-[11px] uppercase tracking-widest mr-2" style={{ color: "#555568" }}>
            Why:
          </span>
          <span
            className="text-sm"
            style={{
              color: "#c8c8d0",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {trade.derivation.explanation}
          </span>
        </div>
      )}

      {/* Ticker context */}
      {trade.ticker_context && (
        <p className="text-xs mt-3 pt-3" style={{ color: "#555568", borderTop: "1px solid #1a1a2e" }}>
          {trade.ticker_context}
        </p>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { source_id } = await params;
  const data = await fetchSourceData(source_id);

  if (!data) {
    return { title: "Market not found | paste.markets" };
  }

  const { source, author, trades } = data;
  const title = source.title ?? "Trade on paste.markets";
  const description = `${trades.length} trade${trades.length !== 1 ? "s" : ""} tracked · @${author.handle}`;

  return {
    title: `${title} | paste.markets`,
    description,
    openGraph: {
      title,
      description,
      images: source.source_images?.[0] ? [source.source_images[0]] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: source.source_images?.[0] ? [source.source_images[0]] : [],
    },
  };
}

export default async function MarketPage({ params }: PageProps) {
  const { source_id } = await params;
  const data = await fetchSourceData(source_id);

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-[28px] font-bold mb-2" style={{ color: "#f0f0f0" }}>
            Market not found
          </h1>
          <p className="text-sm mb-8" style={{ color: "#555568" }}>
            This source ID does not exist or has not been processed yet.
          </p>
          <Link
            href="/leaderboard"
            className="inline-block text-sm px-4 py-2 rounded-lg transition-colors"
            style={{ border: "1px solid #1a1a2e", color: "#c8c8d0" }}
          >
            &larr; Browse Leaderboard
          </Link>
        </div>
      </main>
    );
  }

  const { source, author, trades } = data;
  const avatarUrl = author.avatar_url?.startsWith("/")
    ? `https://paste.trade${author.avatar_url}`
    : author.avatar_url;

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      {/* Source header */}
      <div
        className="rounded-lg p-6 mb-8"
        style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
      >
        {/* Top row: platform badge + view original */}
        <div className="flex items-center justify-between mb-4">
          <PlatformBadge platform={source.platform} />
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-colors"
            style={{ color: "#3b82f6" }}
          >
            View Original &rarr;
          </a>
        </div>

        {/* Title */}
        <h1 className="text-[22px] font-bold mb-3 leading-snug" style={{ color: "#f0f0f0" }}>
          {source.title ?? source.source_summary}
        </h1>

        {/* Author row */}
        <div className="flex items-center gap-3 mb-4">
          {avatarUrl && (
            <Image
              src={avatarUrl}
              alt={author.handle}
              width={32}
              height={32}
              className="rounded-full"
              unoptimized
            />
          )}
          <div className="flex items-center gap-2 text-sm" style={{ color: "#c8c8d0" }}>
            <a
              href={author.twitter_url ?? `https://x.com/${author.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#3b82f6]"
            >
              @{author.handle}
            </a>
            <span style={{ color: "#555568" }}>&middot;</span>
            <span style={{ color: "#555568" }}>
              {formatDate(source.published_at ?? source.created_at)}
            </span>
          </div>
        </div>

        {/* Summary */}
        {source.summary && (
          <p className="text-sm mb-4" style={{ color: "#c8c8d0" }}>
            {source.summary}
          </p>
        )}

        {/* Source image */}
        {source.source_images?.[0] && (
          <div className="mt-4 overflow-hidden rounded-lg" style={{ maxHeight: "192px" }}>
            <Image
              src={source.source_images[0]}
              alt="Source image"
              width={800}
              height={192}
              className="w-full object-cover"
              style={{ maxHeight: "192px", objectFit: "cover" }}
              unoptimized
            />
          </div>
        )}
      </div>

      {/* Trades section */}
      <div className="mb-8">
        <h2 className="text-[20px] font-bold mb-4" style={{ color: "#f0f0f0" }}>
          {trades.length} Trade{trades.length !== 1 ? "s" : ""} Extracted
        </h2>

        {trades.length === 0 ? (
          <div
            className="rounded-lg p-6 text-center"
            style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
          >
            <p className="text-sm" style={{ color: "#555568" }}>
              No trades extracted from this source.
            </p>
          </div>
        ) : (
          trades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
        )}
      </div>

      {/* Footer navigation */}
      <div
        className="flex items-center justify-between pt-6 text-sm"
        style={{ borderTop: "1px solid #1a1a2e" }}
      >
        <Link
          href="/leaderboard"
          className="transition-colors"
          style={{ color: "#555568" }}
        >
          &larr; Browse Leaderboard
        </Link>
        <Link
          href={`/${author.handle}`}
          className="transition-colors"
          style={{ color: "#555568" }}
        >
          View @{author.handle}&apos;s profile &rarr;
        </Link>
      </div>
    </main>
  );
}
