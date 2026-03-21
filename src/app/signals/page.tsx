import type { Metadata } from "next";
import Link from "next/link";
import type {
  SignalsResponse,
  SmartCallItem,
  ConsensusItem,
  FadeCallItem,
  HotStreak,
  NetPositioning,
} from "@/app/api/signals/route";
import { tierColor } from "@/lib/alpha";
import type { CallerTier } from "@/lib/alpha";

export const metadata: Metadata = {
  title: "Signals — paste.markets",
  description:
    "Alpha-scored trade signals from S/A-tier CT callers. Net positioning, consensus plays, and fade watch. Built on paste.trade.",
  openGraph: {
    title: "CT Signals — paste.markets",
    description: "Where smart money is positioned right now. Alpha-weighted signals from paste.trade data.",
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
};

export const revalidate = 300;

async function getSignals(): Promise<SignalsResponse> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/signals`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error("signals fetch failed");
    return res.json();
  } catch {
    return {
      smartCalls: [],
      consensus: [],
      fadeCalls: [],
      netPositioning: { long_pct: 50, short_pct: 50, total_signals: 0, net_bias: "NEUTRAL" },
      hotStreaks: [],
      generatedAt: new Date().toISOString(),
    };
  }
}

// ---------- Helpers ----------

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  const m = Math.floor(diff / 60_000);
  return m <= 1 ? "now" : `${m}m`;
}

function pnlStr(pnl: number | null): string {
  if (pnl == null) return "open";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

function pnlColor(pnl: number | null): string {
  if (pnl == null) return "#555568";
  return pnl >= 0 ? "#2ecc71" : "#e74c3c";
}

function dirColor(dir: string): string {
  return dir === "long" || dir === "yes" ? "#2ecc71" : "#e74c3c";
}

function alphaBar(alpha: number, len = 8): string {
  const filled = Math.round((alpha / 100) * len);
  return "█".repeat(filled) + "░".repeat(Math.max(0, len - filled));
}

// ---------- Components ----------

function TierBadge({ tier }: { tier: CallerTier }) {
  const color = tierColor(tier);
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
      style={{ color, border: `1px solid ${color}`, background: `${color}14` }}
    >
      {tier}
    </span>
  );
}

function NetPositioningBar({ net }: { net: NetPositioning }) {
  if (net.total_signals === 0) return null;
  const biasColor =
    net.net_bias === "LONG" ? "#2ecc71" : net.net_bias === "SHORT" ? "#e74c3c" : "#f39c12";
  const longFilled = Math.round((net.long_pct / 100) * 24);
  const shortFilled = 24 - longFilled;

  return (
    <div
      className="rounded-lg p-5 mb-8 font-mono"
      style={{ background: "#0f0f22", border: "1px solid #1a1a2e" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[2px] text-[#555568]">
          NET POSITIONING — S/A TIER CALLERS
        </span>
        <span
          className="text-xs font-bold tracking-widest"
          style={{ color: biasColor }}
        >
          {net.net_bias}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold" style={{ color: "#2ecc71" }}>
          {net.long_pct}%
        </span>
        <div className="flex-1 flex items-center gap-0.5 font-mono text-xs">
          <span style={{ color: "#2ecc71" }}>{"█".repeat(longFilled)}</span>
          <span style={{ color: "#e74c3c" }}>{"█".repeat(shortFilled)}</span>
        </div>
        <span className="text-sm font-bold" style={{ color: "#e74c3c" }}>
          {net.short_pct}%
        </span>
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-[#555568]">LONG / YES</span>
        <span className="text-[10px] text-[#555568]">
          {net.total_signals} signals from tracked S/A callers
        </span>
        <span className="text-[10px] text-[#555568]">SHORT / NO</span>
      </div>
    </div>
  );
}

function SmartCallRow({ call }: { call: SmartCallItem }) {
  return (
    <div className="border-b border-[#1a1a2e] py-3 font-mono">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              href={`/${call.author_handle}`}
              className="text-[#c8c8d0] text-sm hover:text-[#3b82f6] transition-colors"
            >
              @{call.author_handle}
            </Link>
            <TierBadge tier={call.tier} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#f0f0f0] font-bold text-sm">${call.ticker}</span>
            <span className="text-xs font-bold" style={{ color: dirColor(call.direction) }}>
              {call.direction.toUpperCase()}
            </span>
            <span className="text-xs" style={{ color: pnlColor(call.pnl_pct) }}>
              {pnlStr(call.pnl_pct)}
            </span>
            {call.platform && (
              <span className="text-[10px] text-[#555568]">{call.platform}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-[#555568] mb-1">{Math.round(call.win_rate)}% WR</div>
          <div className="text-[10px] text-[#555568]">{timeAgo(call.posted_at)}</div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[10px] font-mono" style={{ color: tierColor(call.tier) }}>
          {alphaBar(call.alpha_score)}
        </span>
        <span className="text-[10px] text-[#555568]">α {call.alpha_score.toFixed(0)}</span>
      </div>
    </div>
  );
}

function ConsensusRow({ signal }: { signal: ConsensusItem }) {
  const barFilled = Math.min(signal.caller_count, 8);
  return (
    <div className="border-b border-[#1a1a2e] py-3 font-mono">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[#f0f0f0] font-bold text-sm">${signal.ticker}</span>
            <span className="text-xs font-bold" style={{ color: dirColor(signal.direction) }}>
              {signal.direction.toUpperCase()}
            </span>
            {signal.avg_pnl != null && (
              <span className="text-xs" style={{ color: pnlColor(signal.avg_pnl) }}>
                avg {pnlStr(signal.avg_pnl)}
              </span>
            )}
          </div>
          <div className="text-[10px] text-[#555568]">
            {signal.callers.slice(0, 4).map((c) => `@${c}`).join(" · ")}
            {signal.callers.length > 4 && ` +${signal.callers.length - 4}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[#f0f0f0] text-sm font-bold">{signal.caller_count}×</div>
          <div className="text-[#555568] text-[10px]">{timeAgo(signal.latest_call)}</div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[10px] font-mono text-[#3b82f6]">
          {"█".repeat(barFilled)}{"░".repeat(Math.max(0, 8 - barFilled))}
        </span>
        <span className="text-[10px] text-[#555568]">
          {Math.round(signal.avg_caller_win_rate)}% avg WR · α-conviction {Math.round(signal.conviction)}
        </span>
      </div>
    </div>
  );
}

function FadeRow({ call }: { call: FadeCallItem }) {
  return (
    <div className="border-b border-[#1a1a2e] py-3 font-mono">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/${call.author_handle}`}
              className="text-[#c8c8d0] text-sm hover:text-[#3b82f6] transition-colors"
            >
              @{call.author_handle}
            </Link>
            <span className="text-[10px] px-1.5 py-0.5 rounded text-[#e74c3c] border border-[#e74c3c]">
              {Math.round(call.win_rate)}% WR
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#555568] text-xs">called</span>
            <span className="text-[#f0f0f0] font-bold text-sm">${call.ticker}</span>
            <span className="text-xs line-through text-[#555568]">
              {call.direction.toUpperCase()}
            </span>
            <span className="text-[#555568] text-xs">→</span>
            <span className="text-xs font-bold" style={{ color: dirColor(call.fade_direction) }}>
              FADE: {call.fade_direction.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[#555568] text-[10px]">{timeAgo(call.posted_at)}</div>
          <div className="text-[#555568] text-[10px] mt-0.5">{call.total_trades}t</div>
        </div>
      </div>
    </div>
  );
}

function HotStreakRow({ streak }: { streak: HotStreak }) {
  return (
    <div className="border-b border-[#1a1a2e] py-3 font-mono flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Link
          href={`/${streak.author_handle}`}
          className="text-[#c8c8d0] text-sm hover:text-[#3b82f6] transition-colors"
        >
          @{streak.author_handle}
        </Link>
        <TierBadge tier={streak.tier} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono" style={{ color: "#2ecc71" }}>
          {"█".repeat(Math.min(streak.streak, 8))}
        </span>
        <span className="text-xs font-bold" style={{ color: "#2ecc71" }}>
          {streak.streak} straight W
        </span>
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  subtitle,
  count,
}: {
  label: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xs uppercase tracking-[2px] font-bold text-[#f0f0f0] font-mono">
          {label}
        </h2>
        {count != null && <span className="text-xs text-[#555568]">{count}</span>}
      </div>
      <p className="text-[#555568] text-xs mt-0.5 font-mono">{subtitle}</p>
      <div className="border-t border-[#1a1a2e] mt-2" />
    </div>
  );
}

// ---------- Page ----------

export default async function SignalsPage() {
  const { smartCalls, consensus, fadeCalls, netPositioning, hotStreaks, generatedAt } =
    await getSignals();

  const updatedAt = timeAgo(generatedAt);
  const hasData = smartCalls.length > 0 || consensus.length > 0;

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-20">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-[#f0f0f0] font-mono">SMART MONEY SIGNALS</h1>
            <p className="text-[#555568] text-xs font-mono mt-1">
              Alpha-weighted intelligence from S/A-tier callers · not every trade makes the cut
            </p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <div className="text-[10px] text-[#555568] font-mono uppercase tracking-wider">
              Updated {updatedAt}
            </div>
          </div>
        </div>

        {/* Net Positioning */}
        <NetPositioningBar net={netPositioning} />

        {!hasData ? (
          <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-8 text-center font-mono">
            <p className="text-[#555568] text-sm mb-2">No signal data yet.</p>
            <p className="text-[#555568] text-xs">
              Run{" "}
              <code className="text-[#c8c8d0]">npm run db:sync</code> to populate the database,
              or visit{" "}
              <Link href="/leaderboard" className="text-[#3b82f6] hover:underline">
                /leaderboard
              </Link>{" "}
              to trigger an auto-sync.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-8">
            {/* Left 2 cols: Smart Calls */}
            <div className="lg:col-span-2">
              <SectionHeader
                label="Live Smart Calls"
                subtitle="S/A-tier callers · last 48h · alpha-ranked"
                count={smartCalls.length}
              />
              {smartCalls.length === 0 ? (
                <p className="text-[#555568] text-xs font-mono py-6">
                  No calls from S/A-tier callers in the last 48h.
                </p>
              ) : (
                smartCalls.map((call, i) => <SmartCallRow key={i} call={call} />)
              )}
            </div>

            {/* Right col: Consensus + Hot Streaks + Fade */}
            <div>
              {/* Consensus */}
              <SectionHeader
                label="Consensus"
                subtitle="2+ quality callers, same ticker · α-conviction"
                count={consensus.length}
              />
              {consensus.length === 0 ? (
                <p className="text-[#555568] text-xs font-mono py-4">
                  No consensus in the last 7 days.
                </p>
              ) : (
                consensus.map((signal, i) => <ConsensusRow key={i} signal={signal} />)
              )}

              {/* Hot Streaks */}
              {hotStreaks.length > 0 && (
                <div className="mt-8">
                  <SectionHeader
                    label="Hot Streaks"
                    subtitle="S/A-tier callers on win runs"
                    count={hotStreaks.length}
                  />
                  {hotStreaks.map((streak, i) => <HotStreakRow key={i} streak={streak} />)}
                </div>
              )}

              {/* Fade Watch */}
              {fadeCalls.length > 0 && (
                <div className="mt-8">
                  <SectionHeader
                    label="Fade Watch"
                    subtitle="Historically wrong · consider the inverse"
                    count={fadeCalls.length}
                  />
                  {fadeCalls.map((call, i) => <FadeRow key={i} call={call} />)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Methodology footer */}
        <div className="mt-14 border-t border-[#1a1a2e] pt-6">
          <p className="text-[10px] uppercase tracking-widest text-[#555568] font-mono mb-3">
            Alpha Score methodology
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-[11px] text-[#555568] font-mono">
            <div>
              <span className="text-[#f39c12]">α = winRate × magnitude × credibility</span>
            </div>
            <div>
              <span className="text-[#f39c12]">S</span> ≥70 &nbsp;
              <span className="text-[#2ecc71]">A</span> ≥50 &nbsp;
              <span className="text-[#3b82f6]">B</span> ≥30 &nbsp;
              <span className="text-[#555568]">C</span> &lt;30
            </div>
            <div>magnitude = 1 + avgPnl/200</div>
            <div>credibility = 0.3 + 0.7 × min(trades,50)/50</div>
          </div>
          <p className="text-[10px] text-[#555568] mt-4 font-mono">
            Trade data from{" "}
            <a
              href="https://paste.trade"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#c8c8d0] transition-colors"
            >
              paste.trade
            </a>{" "}
            by @frankdegods. Not financial advice.
          </p>
        </div>
      </div>
    </main>
  );
}
