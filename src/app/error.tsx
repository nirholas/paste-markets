"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-4">Something went wrong</h1>
        <p className="text-text-muted mb-6">{error.message || "An unexpected error occurred."}</p>
        <button
          onClick={reset}
          className="border border-border hover:border-accent px-4 py-2 rounded transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
