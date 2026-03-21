import type { Metadata } from "next";
import Link from "next/link";
import { getOrCreateAuthor, getAuthorMetrics, recordView, syncAuthor, isStale, getIntegrityStats, getTradesForReputation } from "@/lib/data";
import { IntegrityScoreBadge, IntegrityBreakdown } from "@/components/integrity-badge";
import { integrityTier, getIntegrityTierInfo } from "@/lib/integrity";
import { FadeScorecardWrapper } from "./fade-scorecard";
import { TradeHistory } from "@/components/trade-history";
import { ActionButtons } from "./action-buttons";
import { PlatformBreakdown } from "./platform-breakdown";
import { PnlChart } from "@/components/pnl-chart";
import { searchFullTrades } from "@/lib/paste-trade";
import { getCallerTipsEarned, getCallerWagerHistory } from "@/lib/wager-db";
import { calculateReputationScore, getCachedScore, setCachedScore } from "@/lib/reputation";
import { ReputationBadge, ScoreBreakdownPanel } from "@/components/reputation-badge";
import { computeBadges } from "@/lib/compute-badges";
import { BadgeShelf } from "@/components/badge-card";
import { PredictionStats } from "@/components/prediction-stats";
import { computeFadeScore } from "@/lib/metrics";
import { VenueBreakdown, computeVenueStats } from "@/components/venue-breakdown";

const PASTE_TRADE_BASE = "https://paste.trade";

interface PageProps {
  params: Promise<{ author: string }>;
}

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase().trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { author: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);

  const metrics = await getAuthorMetrics(handle);

  const description = metrics
    ? `@${handle}'s real trading performance: ${Math.round(metrics.winRate)}% win rate, ${metrics.avgPnl >= 0 ? "+" : ""}${metrics.avgPnl.toFixed(1)}% avg P&L across ${metrics.totalTrades} trades.`
    : `@${handle} — Trade Scorecard on paste.markets`;

  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  return {
    title: `@${handle} — Trade Scorecard | paste.markets`,
    description,
    openGraph: {
      title: `@${handle} — Trade Scorecard`,
      description,
      images: [
        { url: `${baseUrl}/api/og/author/${handle}`, width: 1200, height: 630 },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `@${handle} — Trade Scorecard`,
      description,
      images: [`${baseUrl}/api/og/author/${handle}`],
    },
  };
}

function NotFound({ handle }: { handle: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          @{handle}
        </h1>
        <p className="text-text-secondary mb-1">No data yet.</p>
        <p className="text-text-muted text-sm mb-8">
          We&apos;ll start tracking this account. Check back in an hour.
        </p>
        <Link
          href="/leaderboard"
          className="inline-block border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
        >
          &larr; Back to Leaderboard
        </Link>
      </div>
    </main>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function pnlColor(pct: number): string {
  return pct >= 0 ? "text-win" : "text-loss";
}

function formatPnl(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function winRateColor(pct: number): string {
  if (pct >= 65) return "text-win";
  if (pct >= 50) return "text-amber";
  return "text-loss";
}

export default async function AuthorPage({ params }: PageProps) {
  const { author: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);

  // Ensure author exists
  const author = await getOrCreateAuthor(handle);

  // Sync if stale
  if (isStale(author.last_fetched)) {
    try {
      await syncAuthor(handle);
    } catch (err) {
      console.error(`[author-page] Failed to sync ${handle}:`, err);
    }
  }

  // Get metrics
  const metrics = await getAuthorMetrics(handle);

  if (!metrics || metrics.totalTrades === 0) {
    return <NotFound handle={handle} />;
  }

  // Record the view
  await recordView(handle, "profile");

  // Re-read author for rank + last_fetched after potential sync
  const refreshed = await getOrCreateAuthor(handle);
  const lastUpdated = refreshed.last_fetched
    ? timeAgo(refreshed.last_fetched)
    : "never";

  // Fetch avatar (best-effort, non-blocking)
  let avatarUrl: string | null = null;
  try {
    const fullTrades = await searchFullTrades({ author: handle, top: "30d", limit: 3 });
    for (const t of fullTrades) {
      if (t.author_avatar_url) {
        const raw = t.author_avatar_url;
        avatarUrl = raw.startsWith("/") ? `${PASTE_TRADE_BASE}${raw}` : raw;
        break;
      }
    }
  } catch {
    // avatar is optional
  }

  // Build trades array for the table (TradeHistory doesn't need source_url)
  const trades = metrics.recentTrades.map((t) => ({
    ticker: t.ticker,
    direction: t.direction,
    pnl_pct: t.pnl_pct,
    platform: t.platform,
    entry_date: t.entry_date ?? t.posted_at ?? "",
  }));

  // Venue performance stats
  const venueStats = computeVenueStats(metrics.recentTrades);

  // Integrity stats (SQLite only — null in serverless mode)
  const integrityStats = await getIntegrityStats(handle);

  // Wager tips earned
  const tipsEarned = getCallerTipsEarned(handle);
  const wagerHistory = getCallerWagerHistory(handle).filter(
    (w) => w.wager_count > 0,
  );

  // Reputation score — use cache or compute fresh
  let repScore = getCachedScore(handle);
  if (!repScore) {
    try {
      const repTrades = await getTradesForReputation(handle);
      repScore = calculateReputationScore(handle, repTrades);
      setCachedScore(handle, repScore);
    } catch {
      // score is optional
    }
  }

  // Compute fade stats
  const fadeStats = computeFadeScore(metrics.recentTrades);

  // Compute achievement badges
  const earnedBadges = computeBadges(metrics, metrics.recentTrades);
  const badgeData = earnedBadges.map((e) => ({
    id: e.badge.id,
    earnedAt: e.earnedAt,
  }));

  // Best 5 trades sorted by PnL descending
  const best5 = [...metrics.recentTrades]
    .filter((t) => t.pnl_pct != null)
    .sort((a, b) => b.pnl_pct - a.pnl_pct)
    .slice(0, 5);

  // Streak display
  const streakCount = Math.abs(metrics.streak);
  const streakType = metrics.streak >= 0 ? "W" : "L";
  const streakLabel =
    streakCount > 0
      ? `${streakType}${streakCount}`
      : "--";

  return (
    <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        {/* Avatar */}
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`@${handle}`}
            className="w-14 h-14 rounded-full border border-border flex-shrink-0 object-cover"
          />
        )}
        {!avatarUrl && (
          <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted text-base font-bold flex-shrink-0">
            {handle.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[28px] font-bold text-text-primary">
              @{handle}
            </h1>
            <a
              href={`https://x.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] border border-border text-text-muted hover:border-accent hover:text-text-primary px-2 py-0.5 rounded transition-colors font-mono"
            >
              Follow on X
            </a>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {repScore && repScore.tier !== "Unranked" && (
              <ReputationBadge
                tier={repScore.tier}
                score={repScore.score}
                size="md"
                showScore
              />
            )}
            {repScore && repScore.tier === "New" && (
              <span className="text-[11px] text-text-muted font-mono">Not enough data yet</span>
            )}
            <p className="text-[13px] text-text-muted">Trade Scorecard</p>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          {refreshed.rank != null && (
            <div className="text-xs uppercase tracking-widest text-text-muted">
              Rank #{refreshed.rank}
            </div>
          )}
          <div className="text-xs text-text-muted mt-1">
            Updated {lastUpdated}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className={`grid gap-3 mb-8 p-4 bg-surface border border-border rounded-lg ${tipsEarned > 0 ? "grid-cols-3 sm:grid-cols-7" : "grid-cols-3 sm:grid-cols-6"}`}>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Calls</div>
          <div className="text-lg font-bold text-text-primary">{metrics.totalTrades}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Win Rate</div>
          <div className={`text-lg font-bold ${winRateColor(metrics.winRate)}`}>
            {Math.round(metrics.winRate)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Avg P&L</div>
          <div className={`text-lg font-bold ${pnlColor(metrics.avgPnl)}`}>
            {formatPnl(metrics.avgPnl)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Best</div>
          <div className="text-lg font-bold text-win">
            {metrics.bestTrade ? formatPnl(metrics.bestTrade.pnl) : "--"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Worst</div>
          <div className="text-lg font-bold text-loss">
            {metrics.worstTrade ? formatPnl(metrics.worstTrade.pnl) : "--"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Streak</div>
          <div
            className={`text-lg font-bold ${
              streakType === "W" && streakCount > 0
                ? "text-win"
                : streakCount > 0
                  ? "text-loss"
                  : "text-text-muted"
            }`}
          >
            {streakLabel}
          </div>
        </div>
        {tipsEarned > 0 && (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Tips</div>
            <div className="text-lg font-bold text-accent">
              ${tipsEarned.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Achievement badges */}
      <div className="mb-8">
        <h2 className="text-xs uppercase tracking-widest text-text-muted mb-3">
          Achievements
        </h2>
        <BadgeShelf earnedBadges={badgeData} />
      </div>

      {/* Reputation score breakdown */}
      {repScore && repScore.qualifyingCalls >= 5 && (
        <ScoreBreakdownPanel breakdown={repScore.breakdown} tier={repScore.tier} />
      )}

      {/* Scorecard with fade toggle */}
      <FadeScorecardWrapper
        handle={handle}
        metrics={{
          winRate: metrics.winRate,
          avgPnl: metrics.avgPnl,
          totalTrades: metrics.totalTrades,
          streak: metrics.streak,
          bestTrade: metrics.bestTrade,
          worstTrade: metrics.worstTrade,
        }}
        rank={refreshed.rank}
        fadeStats={fadeStats}
      />

      {/* Action buttons */}
      <ActionButtons
        handle={handle}
        metrics={{
          winRate: metrics.winRate,
          avgPnl: metrics.avgPnl,
          totalTrades: metrics.totalTrades,
          streak: metrics.streak,
          bestTrade: metrics.bestTrade
            ? { ticker: metrics.bestTrade.ticker, direction: metrics.bestTrade.direction, pnl: metrics.bestTrade.pnl }
            : null,
        }}
      />

      {/* PnL chart */}
      {metrics.pnlHistory.length >= 2 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            Cumulative P&L
          </h2>
          <div className="bg-surface border border-border rounded-lg p-4">
            <PnlChart data={metrics.pnlHistory} height={130} />
          </div>
        </div>
      )}

      {/* Best calls */}
      {best5.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            Best Calls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {best5.map((t, i) => {
              const date = t.entry_date ?? t.posted_at ?? "";
              const daysAgo = date
                ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
                : null;

              return (
                <div
                  key={`${t.ticker}-${t.direction}-${i}`}
                  className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-primary font-bold">{t.ticker}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          t.direction === "long" || t.direction === "yes"
                            ? "text-win bg-win/10"
                            : "text-loss bg-loss/10"
                        }`}
                      >
                        {t.direction}
                      </span>
                    </div>
                    {daysAgo !== null && (
                      <div className="text-[11px] text-text-muted">
                        {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-win font-bold text-lg">
                      +{t.pnl_pct.toFixed(1)}%
                    </span>
                    {t.source_url && (
                      <a
                        href={t.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-muted hover:text-accent transition-colors text-xs"
                        title="View original tweet"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Worst call */}
      {metrics.worstTrade && metrics.worstTrade.pnl < 0 && (
        <div className="mt-6">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-3">
            Worst Call
          </h2>
          <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-text-primary font-bold">{metrics.worstTrade.ticker}</span>
              <span
                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  metrics.worstTrade.direction === "long" || metrics.worstTrade.direction === "yes"
                    ? "text-win bg-win/10"
                    : "text-loss bg-loss/10"
                }`}
              >
                {metrics.worstTrade.direction}
              </span>
              {metrics.worstTrade.date && (
                <span className="text-[11px] text-text-muted">
                  {new Date(metrics.worstTrade.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            <span className="text-loss font-bold text-lg">
              {formatPnl(metrics.worstTrade.pnl)}
            </span>
          </div>
        </div>
      )}

      {/* Asset breakdown */}
      {metrics.topAssets.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            Asset Breakdown
          </h2>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2">
                    Asset
                  </th>
                  <th className="text-right text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2">
                    Calls
                  </th>
                  <th className="text-right text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2">
                    Win Rate
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2 hidden sm:table-cell">
                    Bar
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.topAssets.map((asset) => {
                  const filled = Math.round((asset.winRate / 100) * 8);
                  const empty = 8 - filled;
                  return (
                    <tr key={asset.ticker} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-bold text-text-primary">
                        <Link href={`/leaderboard/${encodeURIComponent(asset.ticker)}`} className="hover:text-accent transition-colors">
                          {asset.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right text-text-secondary">
                        {asset.callCount}
                      </td>
                      <td className={`px-4 py-2 text-right font-bold ${winRateColor(asset.winRate)}`}>
                        {Math.round(asset.winRate)}%
                      </td>
                      <td className="px-4 py-2 hidden sm:table-cell">
                        <span className="text-win text-xs font-mono">
                          {"\u2588".repeat(filled)}
                        </span>
                        <span className="text-text-muted/40 text-xs font-mono">
                          {"\u2591".repeat(empty)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade history */}
      <div className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
          Trade History
        </h2>
        <TradeHistory trades={trades} />
      </div>

      {/* Venue performance breakdown */}
      {venueStats.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            Venue Performance
          </h2>
          <VenueBreakdown stats={venueStats} />
        </div>
      )}

      {/* Platform breakdown (legacy) */}
      {Object.keys(metrics.tradesByPlatform).length > 0 && venueStats.length === 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            Platforms
          </h2>
          <PlatformBreakdown platforms={metrics.tradesByPlatform} />
        </div>
      )}

      {/* Prediction market stats */}
      <PredictionStats handle={handle} />

      {/* Integrity score */}
      {integrityStats && integrityStats.total > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            Call Integrity
          </h2>
          <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
            {/* Score + tier badge */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <IntegrityScoreBadge
                score={integrityStats.score}
                totalTrades={integrityStats.total}
              />
              {(() => {
                const tier = integrityTier(integrityStats.score);
                const info = getIntegrityTierInfo(tier);
                const color =
                  info.color === "green" ? "text-win border-win bg-win/10"
                  : info.color === "yellow" ? "text-amber border-amber bg-amber/10"
                  : "text-loss border-loss bg-loss/10";
                return (
                  <div className={`text-xs font-mono font-bold uppercase tracking-widest border px-2 py-1 ${color}`}>
                    {info.label}
                  </div>
                );
              })()}
            </div>

            {/* Breakdown bars */}
            <IntegrityBreakdown
              live={integrityStats.live}
              late={integrityStats.late}
              historical={integrityStats.historical}
              retroactive={integrityStats.retroactive}
              unknown={integrityStats.unknown}
              total={integrityStats.total}
            />

            <p className="text-[11px] text-text-muted">
              Integrity score measures how quickly calls were submitted to paste.trade after the original tweet.
              Live calls (&lt; 1 hour) count toward leaderboard rankings.
            </p>
          </div>
        </div>
      )}

      {/* Wager history */}
      {wagerHistory.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            Wager History
          </h2>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2">Call</th>
                  <th className="text-right text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2">Wagered</th>
                  <th className="text-right text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2">Backers</th>
                  <th className="text-right text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2 hidden sm:table-cell">Tip</th>
                  <th className="text-right text-[11px] uppercase tracking-widest text-text-muted font-normal px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {wagerHistory.map((w) => (
                  <tr key={w.trade_card_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-bold text-text-primary">
                      ${w.ticker.toUpperCase()}{" "}
                      <span className={`text-[11px] font-bold ${w.direction === "long" || w.direction === "yes" ? "text-win" : "text-loss"}`}>
                        {w.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-text-secondary font-mono">
                      ${w.total_wagered.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-text-secondary">
                      {w.wager_count}
                    </td>
                    <td className="px-4 py-2 text-right font-mono hidden sm:table-cell">
                      {w.caller_tip_earned != null && w.caller_tip_earned > 0 ? (
                        <span className="text-win">+${w.caller_tip_earned.toFixed(2)}</span>
                      ) : (
                        <span className="text-text-muted">--</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border ${
                          w.status === "settled"
                            ? "border-win/40 text-win"
                            : w.status === "cancelled"
                              ? "border-loss/40 text-loss"
                              : "border-amber/40 text-amber"
                        }`}
                      >
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tipsEarned > 0 && (
            <p className="text-xs text-text-muted mt-2 text-right font-mono">
              Total tips earned:{" "}
              <span className="text-accent font-bold">${tipsEarned.toFixed(2)} USDC</span>
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border flex justify-between text-[11px] text-text-muted">
        <span>paste.markets</span>
        <span>data from paste.trade</span>
      </div>
    </main>
  );
}
