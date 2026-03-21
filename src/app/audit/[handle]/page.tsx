import type { Metadata } from "next";
import { getLatestAudit, type CompletenessGrade } from "@/lib/completeness";
import { AuditBadge } from "@/components/audit-badge";
import { AuditRefreshButton } from "./audit-client";
import { neon } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// Grade colors (inline for server component)
// ---------------------------------------------------------------------------

const GRADE_COLORS: Record<CompletenessGrade, string> = {
  VERIFIED: "#2ecc71",
  MOSTLY_COMPLETE: "#3b82f6",
  PARTIAL: "#f39c12",
  CHERRY_PICKED: "#e74c3c",
  UNKNOWN: "#555568",
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  return {
    title: `Audit: @${handle} -- paste.markets`,
    description: `Full history audit trail for @${handle}. Anti-cherry-pick completeness report.`,
    openGraph: {
      title: `Audit: @${handle} -- paste.markets`,
      description: `Full history audit trail for @${handle}.`,
      images: [{ url: `${baseUrl}/api/og/audit/${handle}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Audit: @${handle} -- paste.markets`,
      images: [`${baseUrl}/api/og/audit/${handle}`],
    },
  };
}

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AuditPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  // Fetch audit
  const audit = await getLatestAudit(handle);

  // Fetch tracked trades for this handle
  let trackedTrades: Array<{
    ticker: string;
    direction: string;
    tweet_date: string;
    pnl_percent: number | null;
    source_url: string | null;
  }> = [];

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      SELECT ticker, direction, tweet_date, pnl_percent, source_url
      FROM trades
      WHERE LOWER(author_handle) = ${handle}
      ORDER BY tweet_date DESC
    `;
    trackedTrades = rows as typeof trackedTrades;
  } catch {
    // table may not exist yet
  }

  // ---------------------------------------------------------------------------
  // Not yet audited
  // ---------------------------------------------------------------------------

  if (!audit) {
    return (
      <main className="min-h-screen bg-[#0a0a1a] text-[#f0f0f0] font-mono">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="mb-8">
            <a href="/leaderboard" className="text-[#555568] text-xs uppercase tracking-widest hover:text-[#3b82f6] transition-colors">
              &larr; Leaderboard
            </a>
          </div>

          <div className="border border-[#1a1a2e] bg-[#0f0f22] rounded-lg p-8 text-center space-y-6">
            <h1 className="text-2xl font-bold">@{handle}</h1>
            <p className="text-[#555568] text-sm">
              This caller has not been audited yet. Run an audit to generate a completeness report.
            </p>
            <AuditRefreshButton handle={handle} />
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Audited view
  // ---------------------------------------------------------------------------

  const gradeColor = GRADE_COLORS[audit.grade];

  return (
    <main className="min-h-screen bg-[#0a0a1a] text-[#f0f0f0] font-mono">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <a href="/leaderboard" className="text-[#555568] text-xs uppercase tracking-widest hover:text-[#3b82f6] transition-colors">
            &larr; Leaderboard
          </a>
          <AuditRefreshButton handle={handle} />
        </div>

        {/* Header */}
        <div className="border border-[#1a1a2e] bg-[#0f0f22] rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">@{handle}</h1>
              <p className="text-[#555568] text-xs uppercase tracking-widest">
                Full History Audit Report
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <AuditBadge
                grade={audit.grade}
                completenessPercent={audit.completenessPercent}
              />
              <span className="text-[#555568] text-[10px]">
                Audited {new Date(audit.auditDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Score bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#555568] uppercase tracking-widest">Completeness</span>
              <span style={{ color: gradeColor }} className="font-bold">
                {audit.completenessPercent}%
              </span>
            </div>
            <div className="h-2 bg-[#0a0a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${audit.completenessPercent}%`,
                  backgroundColor: gradeColor,
                }}
              />
            </div>
          </div>
        </div>

        {/* Completeness Breakdown */}
        <div className="border border-[#1a1a2e] bg-[#0f0f22] rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#555568]">
            Completeness Breakdown
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Tweets Sampled" value={audit.tweetsSampled} />
            <StatCard label="Trade-Related" value={audit.tradeRelatedTweets} />
            <StatCard label="Matched" value={audit.matchedCalls} color="#2ecc71" />
            <StatCard label="Missing" value={audit.unmatchedTweets} color={audit.unmatchedTweets > 0 ? "#e74c3c" : "#2ecc71"} />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#1a1a2e]">
            <StatCard label="Tracked Calls (DB)" value={audit.trackedCalls} />
            <StatCard label="Unmatched Tracked" value={audit.unmatchedTrades} color={audit.unmatchedTrades > 0 ? "#f39c12" : "#555568"} />
          </div>
        </div>

        {/* Missing Calls */}
        {audit.missingCalls.length > 0 && (
          <div className="border border-[#1a1a2e] bg-[#0f0f22] rounded-lg p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#e74c3c]">
              Missing Calls ({audit.missingCalls.length})
            </h2>
            <p className="text-[#555568] text-xs">
              Trade-related tweets detected that are not tracked in the database.
            </p>

            <div className="space-y-3">
              {audit.missingCalls.map((call) => (
                <div
                  key={call.tweetId}
                  className="border border-[#1a1a2e] bg-[#0a0a1a] rounded p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[#c8c8d0] text-sm leading-relaxed flex-1">
                      {call.tweetText}
                    </p>
                    <a
                      href={call.tweetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3b82f6] text-[10px] uppercase tracking-widest whitespace-nowrap hover:underline"
                    >
                      View Tweet
                    </a>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-[#555568]">
                    <span>
                      Ticker: <span className="text-[#f0f0f0] font-bold">{call.detectedTicker}</span>
                    </span>
                    <span>
                      Direction: <span className="text-[#f0f0f0] font-bold">{call.detectedDirection}</span>
                    </span>
                    <span>
                      Confidence: <span className="text-[#f0f0f0] font-bold">{Math.round(call.confidence * 100)}%</span>
                    </span>
                    <span>
                      {new Date(call.tweetDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tracked Calls */}
        <div className="border border-[#1a1a2e] bg-[#0f0f22] rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#555568]">
            Tracked Calls ({trackedTrades.length})
          </h2>

          {trackedTrades.length === 0 ? (
            <p className="text-[#555568] text-xs">No tracked trades found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#555568] uppercase tracking-widest border-b border-[#1a1a2e]">
                    <th className="text-left py-2 pr-4">Ticker</th>
                    <th className="text-left py-2 pr-4">Direction</th>
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-right py-2 pr-4">P&L</th>
                    <th className="text-right py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedTrades.map((trade, i) => {
                    const pnl = trade.pnl_percent;
                    const pnlColor = pnl == null ? "#555568" : pnl >= 0 ? "#2ecc71" : "#e74c3c";
                    return (
                      <tr key={i} className="border-b border-[#1a1a2e]/50">
                        <td className="py-2 pr-4 font-bold text-[#f0f0f0]">{trade.ticker}</td>
                        <td className="py-2 pr-4 text-[#c8c8d0] uppercase">{trade.direction}</td>
                        <td className="py-2 pr-4 text-[#555568]">
                          {new Date(trade.tweet_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-2 pr-4 text-right font-bold" style={{ color: pnlColor }}>
                          {pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%` : "--"}
                        </td>
                        <td className="py-2 text-right">
                          {trade.source_url ? (
                            <a
                              href={trade.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#3b82f6] hover:underline"
                            >
                              Link
                            </a>
                          ) : (
                            <span className="text-[#555568]">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CTA for callers */}
        <div className="border border-[#1a1a2e] bg-[#0f0f22] rounded-lg p-6 text-center space-y-3">
          <h3 className="text-sm font-bold text-[#f0f0f0]">Are you @{handle}?</h3>
          <p className="text-[#555568] text-xs max-w-md mx-auto">
            Add your missing calls to improve your completeness score.
            Submit trades through paste.trade to get them tracked and verified.
          </p>
          <a
            href="https://paste.trade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border border-[#1a1a2e] hover:border-[#3b82f6] px-4 py-2 text-[#3b82f6] text-xs uppercase tracking-widest transition-colors"
          >
            Submit on paste.trade
          </a>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Stat card helper
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-[#555568]">{label}</p>
      <p className="text-xl font-bold" style={{ color: color ?? "#f0f0f0" }}>
        {value}
      </p>
    </div>
  );
}
