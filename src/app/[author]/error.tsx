"use client";

import Link from "next/link";

export default function AuthorError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Failed to load scorecard
        </h1>
        <p className="text-text-secondary mb-1">
          {error.message || "Something went wrong loading this profile."}
        </p>
        <p className="text-text-muted text-sm mb-8">
          This is usually temporary. Try again in a moment.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Try again
          </button>
          <Link
            href="/leaderboard"
            className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
          >
            &larr; Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
