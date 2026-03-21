"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEventStream } from "@/lib/use-event-stream";
import { LiveSignalCard } from "@/components/live-signal-card";
import type { NewTradeEvent } from "@/lib/tweet-poller";

interface StoredSignal {
  id: number;
  handle: string;
  tweetId: string;
  tweetText: string;
  tweetUrl: string;
  tweetDate: string;
  ticker: string;
  direction: string;
  platform: string | null;
  confidence: number;
  entryPrice: number | null;
  tradeUrl: string | null;
  detectedAt: string;
  detectionLatencyMs: number | null;
}

function storedToEvent(s: StoredSignal): NewTradeEvent {
  return {
    handle: s.handle,
    displayName: null,
    ticker: s.ticker,
    direction: s.direction,
    platform: s.platform,
    confidence: s.confidence,
    tweetUrl: s.tweetUrl,
    tweetText: s.tweetText,
    tweetDate: s.tweetDate,
    tradeUrl: s.tradeUrl,
    entryPrice: s.entryPrice,
    detectionLatencyMs: s.detectionLatencyMs ?? 0,
  };
}

function formatLatency(ms: number | null): string {
  if (!ms) return "--";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 85 ? "#2ecc71" : pct >= 70 ? "#f39c12" : "#e74c3c";
  return (
    <div className="flex items-center gap-2 w-20">
      <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

const DIRECTION_OPTIONS = [
  { value: "", label: "All" },
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

const MIN_CONFIDENCE_OPTIONS = [
  { value: 0.65, label: "65%" },
  { value: 0.75, label: "75%" },
  { value: 0.85, label: "85%" },
  { value: 0.9, label: "90%" },
];

export function SignalsClient() {
  const [historical, setHistorical] = useState<StoredSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [minConfidence, setMinConfidence] = useState(0.75);
  const [directionFilter, setDirectionFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const stream = useEventStream(true);

  // Fetch historical signals
  useEffect(() => {
    setLoading(true);
    fetch(`/api/signals/live?minConfidence=${minConfidence}&limit=50`)
      .then((r) => r.ok ? r.json() : { signals: [] })
      .then((data) => setHistorical(data.signals ?? []))
      .catch(() => setHistorical([]))
      .finally(() => setLoading(false));
  }, [minConfidence]);

  // Merge live stream events with historical
  const liveEvents = stream.liveEvents.filter(
    (e) => e.confidence >= minConfidence,
  );

  const allSignals: NewTradeEvent[] = [
    ...liveEvents,
    ...historical.map(storedToEvent),
  ];

  // Apply filters
  const filtered = allSignals.filter((s) => {
    if (directionFilter && s.direction !== directionFilter) return false;
    if (platformFilter && s.platform !== platformFilter) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            LIVE SIGNALS
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono ${stream.connected ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
              {stream.connected ? "STREAMING" : "CONNECTING..."}
            </span>
            {stream.connected && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ecc71] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2ecc71]" />
              </span>
            )}
          </div>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">
          High-Confidence Detections
        </h1>
        <p className="text-text-secondary text-sm mt-2">
          Real-time trade calls detected from monitored CT callers.
          Showing confidence &ge; {Math.round(minConfidence * 100)}%.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-3 text-center">
          <div className="text-[10px] text-[#555568] uppercase tracking-widest mb-1">Monitoring</div>
          <div className="text-lg font-bold text-[#f0f0f0] font-mono">{stream.activeCallers}</div>
          <div className="text-[10px] text-[#555568]">callers</div>
        </div>
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-3 text-center">
          <div className="text-[10px] text-[#555568] uppercase tracking-widest mb-1">Signals Today</div>
          <div className="text-lg font-bold text-[#2ecc71] font-mono">{stream.tradesFoundToday}</div>
          <div className="text-[10px] text-[#555568]">detected</div>
        </div>
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-3 text-center">
          <div className="text-[10px] text-[#555568] uppercase tracking-widest mb-1">Showing</div>
          <div className="text-lg font-bold text-[#f0f0f0] font-mono">{filtered.length}</div>
          <div className="text-[10px] text-[#555568]">signals</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Confidence threshold */}
        <div className="flex items-center gap-1 border border-[#1a1a2e] rounded overflow-hidden">
          <span className="text-[10px] text-[#555568] px-2 uppercase tracking-widest">Min</span>
          {MIN_CONFIDENCE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setMinConfidence(o.value)}
              className={`px-2.5 py-1.5 text-xs font-mono transition-colors ${
                minConfidence === o.value
                  ? "bg-[#3b82f6] text-[#f0f0f0]"
                  : "text-[#555568] hover:text-[#c8c8d0]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Direction filter */}
        <div className="flex items-center border border-[#1a1a2e] rounded overflow-hidden">
          {DIRECTION_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setDirectionFilter(o.value)}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                directionFilter === o.value
                  ? "bg-[#3b82f6] text-[#f0f0f0]"
                  : "text-[#555568] hover:text-[#c8c8d0]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <Link
          href="/feed"
          className="ml-auto text-[10px] text-[#555568] hover:text-[#3b82f6] transition-colors font-mono"
        >
          ← Back to Feed
        </Link>
      </div>

      {/* Signal cards */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-5 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-5 w-16 rounded bg-[#1a1a2e]" />
                <div className="h-5 w-20 rounded bg-[#1a1a2e]" />
              </div>
              <div className="h-4 w-full rounded bg-[#1a1a2e]" />
              <div className="h-4 w-3/4 rounded bg-[#1a1a2e]" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[#555568] text-sm font-mono">
              No signals yet at this confidence level.
            </p>
            <p className="text-[#555568] text-xs mt-2">
              Signals appear as callers tweet new trade calls.
            </p>
          </div>
        ) : (
          filtered.map((signal, i) => (
            <div key={`${signal.handle}-${signal.tweetUrl}-${i}`}>
              <LiveSignalCard event={signal} animate={i < liveEvents.length} />
              {/* Detection latency overlay */}
              {signal.detectionLatencyMs > 0 && (
                <div className="flex justify-end mt-1 pr-1">
                  <span className="text-[10px] text-[#555568] font-mono">
                    Detected {formatLatency(signal.detectionLatencyMs)} after tweet
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
