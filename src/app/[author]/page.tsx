import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateAuthor, getAuthorMetrics, recordView, syncAuthor, isStale, getIntegrityStats, getTradesForReputation, updateXProfile, isXProfileStale } from "@/lib/data";
import { fetchProfile } from "@/lib/twitter-fetch";
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
import { FollowCallerButton } from "@/components/follow-caller-button";

const PASTE_TRADE_BASE = "https://paste.trade";

// Slugs that should never be treated as author handles
const BLOCKED_SLUGS = new Set([
  "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
  "manifest.webmanifest", ".well-known", "apple-touch-icon.png",
  "apple-icon.png", "icon.svg", "icon.png",
]);

interface PageProps {
  params: Promise<{ author: string }>;
}

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase().trim();
}

function isValidHandle(handle: string): boolean {
  if (BLOCKED_SLUGS.has(handle)) return false;
  // X handles: 1-15 alphanumeric or underscore chars
  return /^[a-z0-9_]{1,15}$/.test(handle);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { author: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);

  if (!isValidHandle(handle)) return {};

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

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function winRateColor(pct: number): string {
  if (pct >= 65) return "text-win";
  if (pct >= 50) return "text-amber";
  return "text-loss";
}

export default async function AuthorPage({ params }: PageProps) {
  const { author: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);

  if (!isValidHandle(handle)) notFound();

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

  // Fetch X profile data (cached in DB, refreshed every 24h)
  let xProfile = {
    avatarUrl: refreshed.avatar_url as string | null,
    bannerUrl: refreshed.banner_url as string | null,
    displayName: refreshed.display_name as string | null,
    bio: refreshed.bio as string | null,
    location: refreshed.location as string | null,
    website: refreshed.website as string | null,
    verified: refreshed.verified ?? false,
    followers: refreshed.followers as number | null,
    following: refreshed.following as number | null,
    tweetCount: refreshed.tweet_count as number | null,
    joinedAt: refreshed.x_joined_at as string | null,
  };

  if (isXProfileStale(refreshed.x_profile_fetched_at)) {
    try {
      const profile = await fetchProfile(handle);
      if (profile) {
        xProfile = {
          avatarUrl: profile.avatarUrl,
          bannerUrl: profile.bannerUrl,
          displayName: profile.displayName,
          bio: profile.bio,
          location: profile.location,
          website: profile.website,
          verified: profile.verified,
          followers: profile.followers,
          following: profile.following,
          tweetCount: profile.tweetCount,
          joinedAt: profile.joined,
        };
        await updateXProfile(handle, {
          ...xProfile,
          followers: xProfile.followers ?? 0,
          following: xProfile.following ?? 0,
          tweetCount: xProfile.tweetCount ?? 0,
        });
      }
    } catch {
      // X profile fetch is optional
    }
  }

  // Fallback avatar from paste.trade if X didn't provide one
  let avatarUrl = xProfile.avatarUrl;
  if (!avatarUrl) {
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
  const tipsEarned = await getCallerTipsEarned(handle);
  const wagerHistory = (await getCallerWagerHistory(handle)).filter(
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
      {/* Banner */}
      {xProfile.bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={xProfile.bannerUrl}
          alt=""
          className="w-full h-32 sm:h-40 object-cover rounded-lg border border-border mb-4 -mt-4"
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`@${handle}`}
            className={`w-14 h-14 rounded-full border border-border flex-shrink-0 object-cover ${xProfile.bannerUrl ? "-mt-10 ring-2 ring-[#0a0a1a]" : ""}`}
          />
        ) : (
          <div className={`w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted text-base font-bold flex-shrink-0 ${xProfile.bannerUrl ? "-mt-10 ring-2 ring-[#0a0a1a]" : ""}`}>
            {handle.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {xProfile.displayName && xProfile.displayName !== handle && (
              <h1 className="text-[28px] font-bold text-text-primary">
                {xProfile.displayName}
              </h1>
            )}
            {(!xProfile.displayName || xProfile.displayName === handle) && (
              <h1 className="text-[28px] font-bold text-text-primary">
                @{handle}
              </h1>
            )}
            {xProfile.verified && (
              <span className="text-accent text-sm" title="Verified on X">
                <svg viewBox="0 0 22 22" className="w-5 h-5 fill-accent inline-block" aria-label="Verified">
                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.223 1.26.27 1.89.14.63-.134 1.21-.439 1.68-.884.445-.47.749-1.055.878-1.69.13-.634.08-1.29-.144-1.897.587-.273 1.084-.704 1.438-1.246.355-.54.552-1.17.57-1.817zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                </svg>
              </span>
            )}
            <a
              href={`https://x.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] border border-border text-text-muted hover:border-accent hover:text-text-primary px-2 py-0.5 rounded transition-colors font-mono"
            >
              Follow on X
            </a>
            <FollowCallerButton callerHandle={handle} />
          </div>
          {xProfile.displayName && xProfile.displayName !== handle && (
            <div className="text-[13px] text-text-muted -mt-0.5">@{handle}</div>
          )}
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

      {/* X Bio & Info */}
      {(xProfile.bio || xProfile.followers != null) && (
        <div className="mb-8 bg-surface border border-border rounded-lg p-4">
          {xProfile.bio && (
            <p className="text-[13px] text-text-secondary mb-3 leading-relaxed">{xProfile.bio}</p>
          )}
          <div className="flex items-center gap-4 flex-wrap text-[12px] text-text-muted">
            {xProfile.location && (
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-text-muted"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                {xProfile.location}
              </span>
            )}
            {xProfile.website && (
              <a
                href={xProfile.website.startsWith("http") ? xProfile.website : `https://${xProfile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-accent transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-text-muted"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                {xProfile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
            {xProfile.joinedAt && (
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-text-muted"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
                Joined {new Date(xProfile.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[12px]">
            {xProfile.followers != null && (
              <span>
                <span className="font-bold text-text-primary">{formatCompact(xProfile.followers)}</span>
                <span className="text-text-muted ml-1">Followers</span>
              </span>
            )}
            {xProfile.following != null && (
              <span>
                <span className="font-bold text-text-primary">{formatCompact(xProfile.following)}</span>
                <span className="text-text-muted ml-1">Following</span>
              </span>
            )}
            {xProfile.tweetCount != null && (
              <span>
                <span className="font-bold text-text-primary">{formatCompact(xProfile.tweetCount)}</span>
                <span className="text-text-muted ml-1">Posts</span>
              </span>
            )}
          </div>
        </div>
      )}

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
