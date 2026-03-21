"use client";

import { useEffect, useState, useCallback } from "react";
import TradeGlobe from "@/components/trade-globe";
import type { TradePoint, TradeArc, GlobeStats } from "@/lib/globe-types";

type TimeWindow = "24h" | "7d" | "30d";

const WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
];

export default function GlobePage() {
  const [points, setPoints] = useState<TradePoint[]>([]);
  const [arcs, setArcs] = useState<TradeArc[]>([]);
  const [stats, setStats] = useState<GlobeStats>({
    totalTrades: 0,
    activeTickers: 0,
    activeCallers: 0,
    avgPnl: 0,
  });
  const [window, setWindow] = useState<TimeWindow>("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (w: TimeWindow) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/globe?window=${w}&limit=100`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setPoints(data.points ?? []);
      setArcs(data.arcs ?? []);
      setStats(data.stats ?? { totalTrades: 0, activeTickers: 0, activeCallers: 0, avgPnl: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(window);
  }, [window, fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchData(window), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [window, fetchData]);

  return (
    <main className="h-screen w-screen overflow-hidden font-mono" style={{ background: "#0a0a1a" }}>
      {/* Timeframe toggle */}
      <div className="absolute top-5 right-5 z-10 flex gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            onClick={() => setWindow(w.value)}
            className="px-3 py-1.5 text-xs font-mono rounded-lg transition-all"
            style={{
              background: window === w.value ? "#3b82f622" : "rgba(10,10,26,0.85)",
              border: `1px solid ${window === w.value ? "#3b82f6" : "#1a1a2e"}`,
              color: window === w.value ? "#3b82f6" : "#555568",
            }}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-sm font-mono" style={{ color: "#555568" }}>
            Loading trade data...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute bottom-5 right-5 z-20 p-3 rounded-lg font-mono text-xs"
          style={{ background: "rgba(231,76,60,0.15)", border: "1px solid #e74c3c44", color: "#e74c3c" }}>
          {error}
        </div>
      )}

      {/* Globe */}
      <TradeGlobe points={points} arcs={arcs} stats={stats} />
    </main>
  );
}
