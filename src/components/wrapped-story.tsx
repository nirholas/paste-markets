"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
    id: string;
    label: string;
    description: string;
    color: string;
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

const SLIDE_COUNT = 5;
const AUTO_ADVANCE_MS = 6000;

// Per-personality gradient backgrounds (inline styles for dynamic colors)
function slideBackground(personalityColor: string, slideIndex: number): React.CSSProperties {
  const bases: string[] = [
    "#0a0a1a",  // slide 0: dark base
    "#080818",  // slide 1: slightly different
    "#0a0a1a",  // slide 2: back to base
    "#060614",  // slide 3: personality slide — darkest
    "#0a0a1a",  // slide 4: final
  ];
  const base = bases[slideIndex] ?? "#0a0a1a";

  // Personality color as subtle radial glow, stronger on personality slide
  const opacity = slideIndex === 3 ? "0.15" : "0.06";
  return {
    background: `radial-gradient(ellipse at 50% 40%, ${personalityColor}${slideIndex === 3 ? "26" : "0f"} 0%, ${base} 70%)`,
    backgroundColor: base,
  };
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function gradeColor(grade: string): string {
  const g = grade.toUpperCase();
  if (g === "S") return "text-amber";
  if (g === "A") return "text-win";
  if (g === "B") return "text-accent";
  if (g === "C") return "text-text-secondary";
  return "text-loss";
}

function gradeGlow(grade: string): string {
  const g = grade.toUpperCase();
  if (g === "S") return "drop-shadow-[0_0_12px_rgba(243,156,18,0.6)]";
  if (g === "A") return "drop-shadow-[0_0_8px_rgba(46,204,113,0.5)]";
  return "";
}

// ---------------------------------------------------------------------------
// Progress bar at top (Instagram Stories style)
// ---------------------------------------------------------------------------
function ProgressBar({
  total,
  current,
  progress,
}: {
  total: number;
  current: number;
  progress: number;
}) {
  return (
    <div className="flex gap-1.5 w-full px-4 pt-4 pb-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] flex-1 rounded-full bg-white/10 overflow-hidden"
        >
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-100 ease-linear"
            style={{
              width:
                i < current
                  ? "100%"
                  : i === current
                    ? `${progress}%`
                    : "0%",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated number counter
// ---------------------------------------------------------------------------
function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  duration = 1200,
  className = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    let raf: number;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased * 10) / 10);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const formatted =
    Number.isInteger(value) ? Math.round(display).toString() : display.toFixed(1);

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Slide 0 — Intro
// ---------------------------------------------------------------------------
function SlideIntro({ handle }: { handle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 story-slide-enter">
      <div className="text-[11px] uppercase tracking-[3px] text-text-muted mb-6">
        CT Wrapped 2026
      </div>
      <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4 tracking-tight">
        @{handle}
      </h1>
      <p className="text-text-secondary text-sm">
        Your trading year, distilled.
      </p>
      <div className="mt-8 text-[11px] text-text-muted animate-pulse">
        Tap to continue
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 1 — Volume & Activity
// ---------------------------------------------------------------------------
function SlideVolume({ data }: { data: WrappedData }) {
  const { totalTrades, favoriteTicker, favoriteDirection } = data.highlights;
  const uniqueTickers = new Set<string>();
  // Estimate from fun facts or use favoriteTicker
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 story-slide-enter">
      <div className="text-[11px] uppercase tracking-[3px] text-text-muted mb-8">
        Your Activity
      </div>
      <div className="mb-2 text-text-secondary text-sm">You made</div>
      <div className="text-5xl sm:text-6xl font-bold text-text-primary mb-2">
        <AnimatedNumber value={totalTrades} />
      </div>
      <div className="text-text-secondary text-sm mb-8">
        trades this year
      </div>

      <div className="flex gap-8 mt-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
            Favorite Ticker
          </div>
          <div className="text-xl font-bold text-accent">
            ${favoriteTicker}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
            Preferred Side
          </div>
          <div className="text-xl font-bold text-text-primary uppercase">
            {favoriteDirection}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 2 — Best Trade
// ---------------------------------------------------------------------------
function SlideBestTrade({ data }: { data: WrappedData }) {
  const { biggestWin, biggestLoss, winRate } = data.highlights;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 story-slide-enter">
      <div className="text-[11px] uppercase tracking-[3px] text-text-muted mb-8">
        Your Best Call
      </div>

      {biggestWin.pnl > 0 ? (
        <>
          <div className="text-sm text-text-secondary mb-2">
            LONG ${biggestWin.ticker}
          </div>
          <div className="text-5xl sm:text-6xl font-bold text-win mb-2">
            <AnimatedNumber value={biggestWin.pnl} prefix="+" suffix="%" />
          </div>
        </>
      ) : (
        <div className="text-2xl text-text-muted mb-4">
          No winning trades yet
        </div>
      )}

      <div className="h-px bg-border w-32 my-8" />

      <div className="flex gap-8">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
            Win Rate
          </div>
          <div
            className={`text-2xl font-bold ${winRate >= 50 ? "text-win" : "text-loss"}`}
          >
            <AnimatedNumber value={winRate} suffix="%" />
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
            Worst Trade
          </div>
          <div className="text-2xl font-bold text-loss">
            {biggestLoss.pnl < 0
              ? formatPnl(biggestLoss.pnl)
              : "--"}
          </div>
          <div className="text-[11px] text-text-muted">
            {biggestLoss.pnl < 0 ? `$${biggestLoss.ticker}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 3 — Personality Reveal
// ---------------------------------------------------------------------------
function SlidePersonality({ data }: { data: WrappedData }) {
  const { personality, grades } = data;

  const gradeRows = [
    { label: "Overall", value: grades.overall },
    { label: "Timing", value: grades.timing },
    { label: "Conviction", value: grades.conviction },
    { label: "Consistency", value: grades.consistency },
    { label: "Risk Mgmt", value: grades.riskManagement },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 story-slide-enter">
      <div className="text-[11px] uppercase tracking-[3px] text-text-muted mb-6">
        Your Trading Personality
      </div>

      <div
        className="text-4xl sm:text-5xl font-bold mb-3"
        style={{ color: personality.color }}
      >
        {personality.label}
      </div>
      <p className="text-text-secondary text-sm max-w-xs mb-8">
        {personality.description}
      </p>

      {/* Compact grades */}
      <div className="w-full max-w-xs">
        {gradeRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0"
          >
            <span className="text-[12px] text-text-muted">{row.label}</span>
            <span
              className={`text-sm font-bold ${gradeColor(row.value)} ${gradeGlow(row.value)}`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 4 — Final Summary + CTA
// ---------------------------------------------------------------------------
function SlideFinal({ data }: { data: WrappedData }) {
  const router = useRouter();
  const [tryHandle, setTryHandle] = useState("");

  const shareText = `My CT Wrapped: I'm "${data.personality.label}" with a ${Math.round(data.highlights.winRate)}% win rate across ${data.highlights.totalTrades} trades.\n\nGet yours: paste.markets/wrapped`;

  const handleTryYours = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tryHandle.replace(/^@/, "").trim().toLowerCase();
    if (cleaned) router.push(`/wrapped/${cleaned}`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 story-slide-enter">
      <div className="text-[11px] uppercase tracking-[3px] text-text-muted mb-6 text-center">
        Your Year in Review
      </div>

      {/* Summary stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-6 w-full max-w-sm text-center">
        <div>
          <div className="text-2xl font-bold text-text-primary">
            {data.highlights.totalTrades}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            Trades
          </div>
        </div>
        <div>
          <div
            className={`text-2xl font-bold ${data.highlights.winRate >= 50 ? "text-win" : "text-loss"}`}
          >
            {Math.round(data.highlights.winRate)}%
          </div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            Win Rate
          </div>
        </div>
        <div>
          <div
            className={`text-2xl font-bold ${data.highlights.avgPnl >= 0 ? "text-win" : "text-loss"}`}
          >
            {formatPnl(data.highlights.avgPnl)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            Avg P&L
          </div>
        </div>
      </div>

      {/* Personality badge */}
      <div
        className="px-4 py-2 rounded-lg border mb-6 text-sm font-bold"
        style={{
          borderColor: data.personality.color,
          color: data.personality.color,
        }}
      >
        {data.personality.label}
      </div>

      {/* Fun facts */}
      {data.funFacts.length > 0 && (
        <div className="w-full max-w-sm mb-6">
          {data.funFacts.slice(0, 3).map((fact, i) => (
            <p key={i} className="text-[12px] text-text-secondary mb-1.5 text-center">
              {fact}
            </p>
          ))}
        </div>
      )}

      {/* Share CTA */}
      <button
        onClick={() => {
          const url = `${window.location.origin}/wrapped/${data.handle}`;
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + "\n\n" + url)}`,
            "_blank",
          );
        }}
        className="w-full max-w-sm bg-accent hover:bg-accent/80 text-text-primary py-3 rounded-lg text-sm font-bold transition-colors mb-3"
      >
        Share on X
      </button>

      {/* Get yours */}
      <form onSubmit={handleTryYours} className="flex gap-2 w-full max-w-sm">
        <input
          type="text"
          value={tryHandle}
          onChange={(e) => setTryHandle(e.target.value)}
          placeholder="@anyhandle"
          className="flex-1 bg-bg border border-border rounded-lg px-4 py-2.5 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2.5 rounded-lg text-[13px] font-bold transition-colors"
        >
          Get Yours
        </button>
      </form>

      <div className="mt-4 text-[10px] text-text-muted">
        paste.markets · data by paste.trade
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Story Container
// ---------------------------------------------------------------------------
export function WrappedStory({ data }: { data: WrappedData }) {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const goNext = useCallback(() => {
    if (current < SLIDE_COUNT - 1) {
      setCurrent((c) => c + 1);
      setProgress(0);
    } else {
      setAutoPlay(false);
    }
  }, [current]);

  const goPrev = useCallback(() => {
    if (current > 0) {
      setCurrent((c) => c - 1);
      setProgress(0);
    }
  }, [current]);

  // Auto-advance timer
  useEffect(() => {
    if (!autoPlay || current >= SLIDE_COUNT - 1) return;

    const interval = 50; // update progress every 50ms
    const steps = AUTO_ADVANCE_MS / interval;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setProgress((step / steps) * 100);
      if (step >= steps) {
        goNext();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, current, goNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  // Tap navigation (left third = back, right two-thirds = forward)
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if they clicked a button/input/link
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (["button", "input", "a", "textarea"].includes(tag)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      goPrev();
    } else {
      goNext();
    }
    setAutoPlay(false);
  };

  // Touch swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0]!.clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0]!.clientX - touchStart;
    if (Math.abs(diff) > 50) {
      if (diff < 0) goNext();
      else goPrev();
      setAutoPlay(false);
    }
    setTouchStart(null);
  };

  const slides = [
    <SlideIntro key={0} handle={data.handle} />,
    <SlideVolume key={1} data={data} />,
    <SlideBestTrade key={2} data={data} />,
    <SlidePersonality key={3} data={data} />,
    <SlideFinal key={4} data={data} />,
  ];

  return (
    <div
      className="relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden border border-border/50 select-none"
      style={{
        height: "min(85vh, 720px)",
        ...slideBackground(data.personality.color, current),
      }}
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <ProgressBar total={SLIDE_COUNT} current={current} progress={progress} />

      <div className="h-[calc(100%-40px)] flex flex-col">
        {slides[current]}
      </div>

      {/* Slide dots at bottom */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setCurrent(i);
              setProgress(0);
              setAutoPlay(false);
            }}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i === current ? "bg-white/70 w-3" : "bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
