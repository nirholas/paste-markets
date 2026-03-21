"use client";

import Link from "next/link";

export default function TickerError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#f0f0f0" }}>
          Ticker Unavailable
        </h1>
        <p className="text-sm mb-6" style={{ color: "#c8c8d0" }}>
          Could not load data for this ticker.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="border border-[#1a1a2e] hover:border-[#3b82f6] text-[#c8c8d0] hover:text-[#f0f0f0] px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Try again
          </button>
          <Link
            href="/leaderboard"
            className="border border-[#1a1a2e] hover:border-[#3b82f6] text-[#c8c8d0] hover:text-[#f0f0f0] px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
