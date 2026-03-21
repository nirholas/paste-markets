import Link from "next/link";
import { WinRateBar } from "@/components/ui/win-rate-bar";
import { IntegrityBadge } from "@/components/integrity-badge";
import { ExecuteButton } from "@/components/execution/execute-button";
import { TimeAgo } from "@/components/time-ago";
import type { IntegrityClass } from "@/lib/integrity";
import {
  probabilityToAmericanOdds,
  formatProbability,
  formatVolume,
} from "@/lib/category";
import { getVenueConfig, getDirectionLabel } from "@/lib/venues";

export interface TradeCardProps {
  tradeId?: string | null;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform?: string | null;
  entryPrice?: number | null;
  currentPrice?: number | null;
  pnlPct?: number | null;
  thesis?: string | null;
  headlineQuote?: string | null;
  chainSteps?: string[] | null;
  authorHandle?: string | null;
  winRate?: number;
  postedAt: string;
  sourceUrl?: string | null;
  // Integrity fields
  integrity?: IntegrityClass | null;
  delayMinutes?: number;
  priceAtTweetTime?: number | null;
  priceAtSubmission?: number | null;
  tweetDeleted?: boolean;
  // Polymarket-specific fields
  contractTitle?: string | null;   // Market question / contract name
  marketVolume?: number | null;    // USDC liquidity in the market
  expiresAt?: string | null;       // ISO date when market resolves
  polymarketUrl?: string | null;   // Direct link to the Polymarket market
  category?: string | null;        // sports | politics | macro_event | entertainment | prediction
  leverage?: number | null;         // For perps (e.g. 10x)
}


function DirectionBadge({ direction, platform }: { direction: TradeCardProps["direction"]; platform?: string | null }) {
  const isLong = direction === "long" || direction === "yes";
  const styles: Record<string, string> = {
    long: "text-win bg-win/10",
    yes: "text-accent bg-accent/10",
    short: "text-loss bg-loss/10",
    no: "text-loss bg-loss/10",
  };
  const label = getDirectionLabel(direction, platform);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs uppercase tracking-widest font-bold rounded-lg ${styles[direction]}`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        {isLong ? (
          <path d="M5 1L9 6H1L5 1Z" />
        ) : (
          <path d="M5 9L1 4H9L5 9Z" />
        )}
      </svg>
      {label}
    </span>
  );
}

function PnlSection({
  pnlPct,
  entryPrice,
  currentPrice,
  isPolymarket,
}: {
  pnlPct?: number | null;
  entryPrice?: number | null;
  currentPrice?: number | null;
  isPolymarket?: boolean;
}) {
  const hasPnl = pnlPct != null;
  const pnlColor = !hasPnl ? "text-amber" : pnlPct! > 0 ? "text-win" : "text-loss";
  const pnlLabel = !hasPnl
    ? "tracking..."
    : `${pnlPct! > 0 ? "+" : ""}${pnlPct!.toFixed(1)}%`;
  const barPct = !hasPnl ? 0 : Math.min(100, Math.max(0, Math.abs(pnlPct!)));

  // For Polymarket, entry/current prices are probabilities (0–1 scale)
  const entryIsProb = isPolymarket && entryPrice != null && entryPrice <= 1;
  const currentIsProb = isPolymarket && currentPrice != null && currentPrice <= 1;

  return (
    <div className="space-y-2">
      {(entryPrice != null || currentPrice != null) && (
        <div className="flex gap-6 text-sm flex-wrap">
          {entryPrice != null && (
            <span>
              <span className="text-text-muted">At call </span>
              <span className="text-text-primary">
                {entryIsProb
                  ? `${formatProbability(entryPrice)} (${probabilityToAmericanOdds(entryPrice)})`
                  : `$${entryPrice.toLocaleString()}`}
              </span>
            </span>
          )}
          {currentPrice != null && (
            <span>
              <span className="text-text-muted">Now </span>
              <span className="text-text-primary">
                {currentIsProb
                  ? `${formatProbability(currentPrice)} (${probabilityToAmericanOdds(currentPrice)})`
                  : `$${currentPrice.toLocaleString()}`}
              </span>
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-bold font-mono tracking-tight ${pnlColor}`}>{pnlLabel}</span>
        {hasPnl ? (
          <WinRateBar pct={barPct} length={12} />
        ) : (
          <span className="text-text-muted font-mono text-xs tracking-tight">
            {"░".repeat(12)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

/** Polymarket-specific metadata strip: volume, expiry, market link */
function PolymarketMeta({
  marketVolume,
  expiresAt,
  polymarketUrl,
}: {
  marketVolume?: number | null;
  expiresAt?: string | null;
  polymarketUrl?: string | null;
}) {
  if (!marketVolume && !expiresAt && !polymarketUrl) return null;
  return (
    <div className="flex flex-wrap gap-4 text-xs text-text-muted border border-border/50 px-3 py-2">
      {marketVolume != null && (
        <span>
          <span className="uppercase tracking-widest text-[10px]">Vol </span>
          <span className="text-text-secondary">{formatVolume(marketVolume)}</span>
        </span>
      )}
      {expiresAt && (
        <span>
          <span className="uppercase tracking-widest text-[10px]">Resolves </span>
          <span className="text-text-secondary">{formatShortDate(expiresAt)}</span>
        </span>
      )}
      {polymarketUrl && (
        <a
          href={polymarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent/80 transition-colors ml-auto"
        >
          polymarket →
        </a>
      )}
    </div>
  );
}

export function TradeCard({
  tradeId,
  ticker,
  direction,
  platform,
  entryPrice,
  currentPrice,
  pnlPct,
  thesis,
  headlineQuote,
  chainSteps,
  authorHandle,
  winRate,
  postedAt,
  sourceUrl,
  integrity,
  delayMinutes,
  priceAtTweetTime,
  priceAtSubmission,
  tweetDeleted,
  contractTitle,
  marketVolume,
  expiresAt,
  polymarketUrl,
  category,
  leverage,
}: TradeCardProps) {
  const quote = headlineQuote ?? thesis;
  const handle = authorHandle ? authorHandle.replace(/^@/, "") : null;
  const showIntegrity = integrity != null && integrity !== "unknown";
  const isPolymarket = platform?.toLowerCase() === "polymarket";
  const venueConfig = getVenueConfig(platform);
  const isPerps = venueConfig?.type === "perps";

  // For Polymarket, use contractTitle > instrument as the display ticker label
  const displayTitle = isPolymarket && contractTitle ? contractTitle : null;

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-4 hover:border-accent/30 transition-all shadow-lg shadow-black/20">
      {/* Header: ticker + direction + platform + category + time */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {venueConfig && (
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full text-xs"
              style={{ backgroundColor: `${venueConfig.color}20`, color: venueConfig.color }}
              title={venueConfig.name}
            >
              {venueConfig.icon}
            </span>
          )}
          <span className="text-xl font-bold text-text-primary tracking-tight font-mono">
            {isPolymarket ? ticker.toUpperCase() : `$${ticker.toUpperCase()}`}
          </span>
          <DirectionBadge direction={direction} platform={platform} />
          {isPerps && leverage != null && leverage > 1 && (
            <span className="text-xs font-bold px-1.5 py-0.5 border border-accent text-accent rounded">
              {leverage}x
            </span>
          )}
          {platform && (
            <span
              className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg"
              style={{
                color: venueConfig?.color ?? "#555568",
                backgroundColor: venueConfig ? `${venueConfig.color}14` : "#ffffff08",
              }}
            >
              {venueConfig?.name ?? platform}
            </span>
          )}
          {category && isPolymarket && (
            <span className="text-xs uppercase tracking-widest text-text-muted/70 border border-border/50 px-2 py-0.5">
              {category.replace("_", " ")}
            </span>
          )}
          {showIntegrity && (
            <IntegrityBadge
              integrity={integrity!}
              delayMinutes={delayMinutes}
              showDelay={!!delayMinutes && delayMinutes > 0}
            />
          )}
          {tweetDeleted && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted border border-border px-1.5 py-0.5">
              tweet deleted
            </span>
          )}
        </div>
        <TimeAgo date={postedAt} className="text-xs text-text-muted" />
      </div>

      {/* Polymarket contract title (market question) */}
      {displayTitle && (
        <p className="text-text-secondary text-sm font-medium leading-snug">
          {displayTitle}
        </p>
      )}

      {/* Author */}
      {handle && (
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/${handle}`}
            className="text-text-secondary hover:text-accent transition-colors"
          >
            @{handle}
          </Link>
          {winRate != null && winRate > 0 && (
            <span className="text-text-muted text-xs">({Math.round(winRate)}% WR)</span>
          )}
        </div>
      )}

      {/* Headline quote / thesis */}
      {quote && (
        <p className="text-text-secondary text-sm border-l-2 border-border pl-3 leading-relaxed italic">
          &ldquo;{quote}&rdquo;
        </p>
      )}

      {/* P&L */}
      <PnlSection
        pnlPct={pnlPct}
        entryPrice={entryPrice}
        currentPrice={currentPrice}
        isPolymarket={isPolymarket}
      />

      {/* Polymarket metadata strip */}
      {isPolymarket && (
        <PolymarketMeta
          marketVolume={marketVolume}
          expiresAt={expiresAt}
          polymarketUrl={polymarketUrl}
        />
      )}

      {/* Dual-price transparency (when submitted late and prices differ) */}
      {!isPolymarket && priceAtTweetTime != null && priceAtSubmission != null &&
       priceAtTweetTime !== priceAtSubmission && (
        <div className="text-xs text-text-muted border border-border/50 px-3 py-2 space-y-0.5">
          <p className="uppercase tracking-widest text-[10px] mb-1">Price Transparency</p>
          <p>At tweet time: <span className="text-text-secondary">${priceAtTweetTime.toLocaleString()}</span></p>
          <p>At submission: <span className="text-text-secondary">${priceAtSubmission.toLocaleString()}</span></p>
          <p className="text-[10px] text-text-muted mt-1">P&amp;L calculated from tweet-time price.</p>
        </div>
      )}

      {/* Chain steps */}
      {chainSteps && chainSteps.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-text-muted mb-2">Chain</p>
          {chainSteps.slice(0, 3).map((step, i) => (
            <div key={i} className="flex gap-2 text-sm text-text-secondary">
              <span className="text-text-muted shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border">
        <div className="flex items-center gap-3">
          <ExecuteButton
            tradeId={tradeId ?? undefined}
            ticker={ticker}
            direction={direction}
            platform={platform}
            entryPrice={entryPrice}
            leverage={leverage}
            authorHandle={handle ?? undefined}
            thesis={thesis ?? headlineQuote ?? undefined}
            variant="compact"
          />
          <span>
            {handle ? `@${handle}` : ""}
            {handle && postedAt ? " · " : ""}
            {formatDate(postedAt)}
          </span>
        </div>
        {sourceUrl && !polymarketUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            source →
          </a>
        )}
      </div>
    </div>
  );
}
