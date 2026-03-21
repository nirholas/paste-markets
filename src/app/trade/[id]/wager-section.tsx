/**
 * WagerSection — server component rendered inside the trade card page.
 * Fetches wager state from the local DB and passes it down to the
 * interactive WagerModal client component.
 */

import { getWagerStats, getWagersByTrade } from "@/lib/wager-db";
import { WagerModal } from "./wager-modal";

interface WagerSectionProps {
  tradeId: string;
  authorHandle: string;
}

function formatDeadlineCountdown(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const hrs = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d left to wager`;
  if (hrs > 0) return `${hrs}h ${mins}m left to wager`;
  return `${mins}m left to wager`;
}

function formatSettlementDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PnlTag({ pct }: { pct: number }) {
  const pos = pct >= 0;
  return (
    <span
      className={`text-xs font-mono font-bold ${pos ? "text-win" : "text-loss"}`}
    >
      {pos ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

export async function WagerSection({ tradeId, authorHandle }: WagerSectionProps) {
  const stats = await getWagerStats(tradeId);

  // Wagering not enabled for this trade
  if (!stats) return null;

  const now = new Date();
  const isWindowOpen = now < new Date(stats.wager_deadline);
  const isSettled = stats.is_settled;

  const wagers = await getWagersByTrade(tradeId);
  const avatarHandles = wagers
    .filter((w) => w.handle)
    .slice(0, 5)
    .map((w) => w.handle!);

  // ── Settled state ─────────────────────────────────────────────────────────
  if (isSettled) {
    const wonCount = wagers.filter((w) => w.status === "won").length;
    const lostCount = wagers.filter((w) => w.status === "lost").length;
    const totalPnl = wagers.reduce((s, w) => s + (w.pnl_amount ?? 0), 0);
    const netPct =
      stats.total_wagered > 0 ? (totalPnl / stats.total_wagered) * 100 : 0;

    return (
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-widest text-text-muted">
            Backing — Settled
          </h3>
          <span className="text-[11px] text-text-muted uppercase tracking-widest">
            {stats.total_wagered.toFixed(0)} USDC from {stats.wager_count} backer
            {stats.wager_count !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Net to wagerers</span>
            <PnlTag pct={netPct} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Caller tip earned</span>
            <span className="font-mono text-text-secondary">
              ${(stats.caller_tip_earned ?? 0).toFixed(2)} USDC
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Outcome</span>
            <span className="text-text-secondary font-mono text-xs">
              {wonCount}W / {lostCount}L
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Window closed, awaiting settlement ───────────────────────────────────
  if (!isWindowOpen) {
    return (
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-widest text-text-muted">
            Backing — Awaiting Settlement
          </h3>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-text-muted">Total wagered</span>
            <span className="font-mono text-text-secondary">
              {stats.total_wagered.toFixed(0)} USDC
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-text-muted">Backers</span>
            <span className="font-mono text-text-secondary">{stats.wager_count}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Settles</span>
            <span className="font-mono text-text-secondary">
              {formatSettlementDate(stats.settlement_date)}
            </span>
          </div>
          {avatarHandles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-1">
              {avatarHandles.map((h) => (
                <div
                  key={h}
                  className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-[9px] font-bold text-text-muted uppercase"
                  title={`@${h}`}
                >
                  {h.slice(0, 2)}
                </div>
              ))}
              {stats.wager_count > 5 && (
                <span className="text-[11px] text-text-muted ml-1">
                  +{stats.wager_count - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Window open — show "Back This Call" CTA ───────────────────────────────
  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-text-muted">
          Back This Call
        </h3>
        <span className="text-[11px] text-text-muted">
          {formatDeadlineCountdown(stats.wager_deadline)}
        </span>
      </div>

      {stats.wager_count > 0 && (
        <p className="text-xs text-text-muted mb-3">
          {stats.total_wagered.toFixed(0)} USDC wagered by {stats.wager_count} backer
          {stats.wager_count !== 1 ? "s" : ""}
          {avatarHandles.length > 0 && (
            <span className="ml-2">
              {avatarHandles.map((h) => `@${h}`).join(", ")}
            </span>
          )}
        </p>
      )}

      <WagerModal
        tradeId={tradeId}
        authorHandle={authorHandle}
        settlementDate={formatSettlementDate(stats.settlement_date)}
        callerTipBps={stats.wager_count > 0 ? 1000 : 1000}
      />
    </div>
  );
}
