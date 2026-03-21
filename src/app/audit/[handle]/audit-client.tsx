"use client";

import { useState } from "react";

interface AuditRefreshButtonProps {
  handle: string;
}

export function AuditRefreshButton({ handle }: AuditRefreshButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function triggerAudit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/audit/${encodeURIComponent(handle)}`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Audit failed (${res.status})`);
      }

      // Reload page to show new results
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={triggerAudit}
        disabled={loading}
        className="border border-[#1a1a2e] hover:border-[#3b82f6] bg-[#0f0f22] px-4 py-2 font-mono text-sm text-[#3b82f6] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Auditing..." : "Run Audit Now"}
      </button>
      {error && (
        <p className="text-[#e74c3c] text-xs font-mono">{error}</p>
      )}
    </div>
  );
}
