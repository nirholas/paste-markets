"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function MatchupForm() {
  const router = useRouter();
  const [handleA, setHandleA] = useState("");
  const [handleB, setHandleB] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const a = handleA.replace(/^@/, "").trim().toLowerCase();
    const b = handleB.replace(/^@/, "").trim().toLowerCase();
    if (a && b && a !== b) {
      router.push(`/vs/${encodeURIComponent(a)}/${encodeURIComponent(b)}`);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
        Try Another Matchup
      </h2>
      <form
        onSubmit={onSubmit}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        <input
          type="text"
          value={handleA}
          onChange={(e) => setHandleA(e.target.value)}
          placeholder="@handle_a"
          required
          className="flex-1 bg-bg border border-border rounded-lg px-4 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
        <span className="text-center text-xs uppercase tracking-widest text-text-muted py-1">
          vs
        </span>
        <input
          type="text"
          value={handleB}
          onChange={(e) => setHandleB(e.target.value)}
          placeholder="@handle_b"
          required
          className="flex-1 bg-bg border border-border rounded-lg px-4 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-5 py-2 rounded-lg text-sm font-mono transition-colors"
        >
          Fight
        </button>
      </form>
      <p className="text-[11px] text-text-muted mt-3">
        Enter two handles to see who comes out on top.
      </p>
    </div>
  );
}
