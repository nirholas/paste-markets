"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface WrappedData {
  handle: string;
  grades: {
    overall: string;
    timing: string;
    conviction: string;
    consistency: string;
    riskManagement: string;
  };
  personality: {
    label: string;
    description: string;
  };
  highlights: {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    bestMonth: string;
    favoriteTicker: string;
    favoriteDirection: string;
    longestStreak: number;
    biggestWin: { ticker: string; pnl: number };
    biggestLoss: { ticker: string; pnl: number };
  };
  funFacts: string[];
}

function gradeColor(grade: string): string {
  const g = grade.toUpperCase().replace("+", "");
  if (g === "S") return "text-amber";
  if (g === "A") return "text-win";
  if (g === "B") return "text-accent";
  if (g === "C") return "text-text-secondary";
  return "text-loss";
}

function gradeGlow(grade: string): string {
  const g = grade.toUpperCase().replace("+", "");
  if (g === "S") return "drop-shadow-[0_0_8px_rgba(243,156,18,0.5)]";
  if (g === "A") return "drop-shadow-[0_0_6px_rgba(46,204,113,0.4)]";
  return "";
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function streakLabel(streak: number): string {
  if (streak === 0) return "--";
  const prefix = streak > 0 ? "W" : "L";
  return `${prefix}${Math.abs(streak)}`;
}

export function WrappedCard({ data }: { data: WrappedData }) {
  const router = useRouter();
  const [tryHandle, setTryHandle] = useState("");

  const gradeRows: { label: string; value: string }[] = [
    { label: "Overall", value: data.grades.overall },
    { label: "Timing", value: data.grades.timing },
    { label: "Conviction", value: data.grades.conviction },
    { label: "Consistency", value: data.grades.consistency },
    { label: "Risk Mgmt", value: data.grades.riskManagement },
  ];

  const handleTryYours = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tryHandle.replace(/^@/, "").trim().toLowerCase();
    if (cleaned) {
      router.push(`/wrapped/${cleaned}`);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* --- Main Card --- */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Header strip */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] uppercase tracking-[2px] text-text-muted">
              CT Wrapped
            </span>
            <span className="text-[11px] uppercase tracking-[2px] text-text-muted">
              paste.markets
            </span>
          </div>
          <div className="h-px bg-border mb-5" />

          {/* Handle */}
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            @{data.handle}
          </h1>
        </div>

        {/* Personality */}
        <div className="px-6 pb-5">
          <div className="bg-bg/60 border border-border rounded-lg p-4">
            <div className="text-[11px] uppercase tracking-[2px] text-text-muted mb-2">
              Trading Personality
            </div>
            <div className="text-lg font-bold text-amber mb-1">
              {data.personality.label}
            </div>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              {data.personality.description}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-6" />

        {/* Grades Table */}
        <div className="px-6 py-5">
          <div className="text-[11px] uppercase tracking-[2px] text-text-muted mb-3">
            Performance Grades
          </div>
          <div className="space-y-0">
            {gradeRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0"
              >
                <span className="text-[13px] text-text-secondary">
                  {row.label}
                </span>
                <span
                  className={`text-base font-bold ${gradeColor(row.value)} ${gradeGlow(row.value)}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-6" />

        {/* Key Stats Row */}
        <div className="px-6 py-5">
          <div className="text-[11px] uppercase tracking-[2px] text-text-muted mb-3">
            Key Stats
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xl font-bold text-text-primary">
                {data.highlights.totalTrades}
              </div>
              <div className="text-[11px] text-text-muted uppercase tracking-wider">
                Trades
              </div>
            </div>
            <div>
              <div
                className={`text-xl font-bold ${data.highlights.winRate >= 50 ? "text-win" : "text-loss"}`}
              >
                {Math.round(data.highlights.winRate)}%
              </div>
              <div className="text-[11px] text-text-muted uppercase tracking-wider">
                Win Rate
              </div>
            </div>
            <div>
              <div
                className={`text-xl font-bold ${data.highlights.avgPnl >= 0 ? "text-win" : "text-loss"}`}
              >
                {formatPnl(data.highlights.avgPnl)}
              </div>
              <div className="text-[11px] text-text-muted uppercase tracking-wider">
                Avg P&L
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-6" />

        {/* Highlights Grid */}
        <div className="px-6 py-5">
          <div className="text-[11px] uppercase tracking-[2px] text-text-muted mb-3">
            Highlights
          </div>
          <div className="space-y-3">
            {/* Biggest W / L */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg/60 border border-border rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
                  Biggest W
                </div>
                <div className="text-base font-bold text-win">
                  {formatPnl(data.highlights.biggestWin.pnl)}
                </div>
                <div className="text-[12px] text-text-secondary">
                  ${data.highlights.biggestWin.ticker}
                </div>
              </div>
              <div className="bg-bg/60 border border-border rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
                  Biggest L
                </div>
                <div className="text-base font-bold text-loss">
                  {formatPnl(data.highlights.biggestLoss.pnl)}
                </div>
                <div className="text-[12px] text-text-secondary">
                  ${data.highlights.biggestLoss.ticker}
                </div>
              </div>
            </div>

            {/* Streak / Fav Ticker / Fav Direction / Best Month */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-text-muted w-24 shrink-0">
                  Streak
                </span>
                <span
                  className={`text-[13px] font-bold ${data.highlights.longestStreak > 0 ? "text-win" : data.highlights.longestStreak < 0 ? "text-loss" : "text-text-muted"}`}
                >
                  {streakLabel(data.highlights.longestStreak)}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-text-muted w-24 shrink-0">
                  Best Month
                </span>
                <span className="text-[13px] font-bold text-text-primary">
                  {data.highlights.bestMonth}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-text-muted w-24 shrink-0">
                  Fav Ticker
                </span>
                <span className="text-[13px] font-bold text-accent">
                  ${data.highlights.favoriteTicker}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-text-muted w-24 shrink-0">
                  Direction
                </span>
                <span className="text-[13px] font-bold text-text-primary uppercase">
                  {data.highlights.favoriteDirection}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-6" />

        {/* Fun Facts */}
        {data.funFacts.length > 0 && (
          <div className="px-6 py-5">
            <div className="text-[11px] uppercase tracking-[2px] text-text-muted mb-3">
              Fun Facts
            </div>
            <ul className="space-y-2">
              {data.funFacts.map((fact, i) => (
                <li
                  key={i}
                  className="text-[13px] text-text-secondary leading-relaxed flex gap-2"
                >
                  <span className="text-text-muted shrink-0">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer watermark */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[3px] text-text-muted">
            paste.markets
          </span>
          <span className="text-[10px] text-text-muted">
            data by paste.trade
          </span>
        </div>
      </div>

      {/* --- Action Buttons --- */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => {
            const url = `${window.location.origin}/wrapped/${data.handle}`;
            const text = `My CT Wrapped is live. @${data.handle} -- ${data.personality.label}\n\n${url}`;
            window.open(
              `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
              "_blank",
            );
          }}
          className="flex-1 border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2.5 rounded-lg text-[13px] transition-colors"
        >
          Share Wrapped
        </button>
        <a
          href={`/${data.handle}`}
          className="flex-1 border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2.5 rounded-lg text-[13px] transition-colors text-center"
        >
          View Full Profile
        </a>
        <a
          href="/vs"
          className="flex-1 border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2.5 rounded-lg text-[13px] transition-colors text-center"
        >
          Compare
        </a>
      </div>

      {/* --- Try Yours --- */}
      <div className="mt-6 mb-8">
        <form
          onSubmit={handleTryYours}
          className="flex gap-2"
        >
          <input
            type="text"
            value={tryHandle}
            onChange={(e) => setTryHandle(e.target.value)}
            placeholder="@yourhandle"
            className="flex-1 bg-bg border border-border rounded-lg px-4 py-2.5 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            className="bg-accent hover:bg-accent/80 text-text-primary px-5 py-2.5 rounded-lg text-[13px] font-bold transition-colors"
          >
            Try Yours
          </button>
        </form>
      </div>
    </div>
  );
}
