"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const GREEN = "#2ecc71";
const RED = "#e74c3c";
const MUTED = "#555568";

interface CallerData {
  handle: string;
  displayName: string;
  stats: {
    totalCalls: number;
    winRate: number;
    avgPnlPercent: number;
    totalPnlPercent: number;
    currentStreak: { type: "W" | "L"; count: number };
  };
  recentTrades: Array<{
    ticker: string;
    direction: string;
    pnl_pct: number;
  }>;
}

function formatPnl(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function winRateBar(pct: number, length = 10): string {
  const filled = Math.round((pct / 100) * length);
  const empty = length - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

function pnlColor(v: number) {
  return v >= 0 ? GREEN : RED;
}

function MiniWidget({ data, light }: { data: CallerData; light: boolean }) {
  const bg = light ? "#ffffff" : "transparent";
  const text = light ? "#1a1a2e" : "#f0f0f0";
  const muted = light ? "#888" : MUTED;

  return (
    <div
      style={{ background: bg, color: text, padding: "12px 16px", fontFamily: "monospace", fontSize: 13, display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box" }}
    >
      <span style={{ fontWeight: 700 }}>@{data.handle}</span>
      <span style={{ color: pnlColor(data.stats.winRate - 50) }}>
        {Math.round(data.stats.winRate)}% WR
      </span>
      <span style={{ color: pnlColor(data.stats.avgPnlPercent) }}>
        {formatPnl(data.stats.avgPnlPercent)} avg
      </span>
      <span style={{ color: muted, marginLeft: "auto", fontSize: 11 }}>
        paste.markets
      </span>
    </div>
  );
}

function CardWidget({ data, light }: { data: CallerData; light: boolean }) {
  const bg = light ? "#ffffff" : "#0f0f22";
  const text = light ? "#1a1a2e" : "#f0f0f0";
  const secondary = light ? "#555" : "#c8c8d0";
  const muted = light ? "#999" : MUTED;
  const border = light ? "#e0e0e0" : "#1a1a2e";
  const last5 = data.recentTrades.slice(0, 5);

  return (
    <div
      style={{
        background: bg,
        color: text,
        padding: 20,
        fontFamily: "monospace",
        borderRadius: 8,
        border: `1px solid ${border}`,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>@{data.handle}</span>
        <span style={{ color: muted, fontSize: 11 }}>paste.markets</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Win Rate
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: pnlColor(data.stats.winRate - 50), fontWeight: 700, fontSize: 18 }}>
            {Math.round(data.stats.winRate)}%
          </span>
          <span style={{ color: secondary, fontSize: 13, letterSpacing: 1 }}>
            {winRateBar(data.stats.winRate)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Avg P&L</div>
          <div style={{ color: pnlColor(data.stats.avgPnlPercent), fontWeight: 700, fontSize: 15 }}>
            {formatPnl(data.stats.avgPnlPercent)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Trades</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{data.stats.totalCalls}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Streak</div>
          <div style={{ color: data.stats.currentStreak.type === "W" ? GREEN : RED, fontWeight: 700, fontSize: 15 }}>
            {data.stats.currentStreak.count}{data.stats.currentStreak.type}
          </div>
        </div>
      </div>

      {last5.length > 0 && (
        <div style={{ display: "flex", gap: 4 }}>
          {last5.map((t, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: t.pnl_pct > 0 ? GREEN : RED,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FullWidget({ data, light }: { data: CallerData; light: boolean }) {
  const bg = light ? "#ffffff" : "#0f0f22";
  const text = light ? "#1a1a2e" : "#f0f0f0";
  const secondary = light ? "#555" : "#c8c8d0";
  const muted = light ? "#999" : MUTED;
  const border = light ? "#e0e0e0" : "#1a1a2e";
  const surfaceBg = light ? "#f5f5f5" : "#0a0a1a";
  const recent = data.recentTrades.slice(0, 8);

  return (
    <div
      style={{
        background: bg,
        color: text,
        padding: 24,
        fontFamily: "monospace",
        borderRadius: 8,
        border: `1px solid ${border}`,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontWeight: 700, fontSize: 18 }}>@{data.handle}</span>
        <span style={{ color: muted, fontSize: 11 }}>paste.markets</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Win Rate
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: pnlColor(data.stats.winRate - 50), fontWeight: 700, fontSize: 22 }}>
            {Math.round(data.stats.winRate)}%
          </span>
          <span style={{ color: secondary, fontSize: 14, letterSpacing: 1 }}>
            {winRateBar(data.stats.winRate)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 32, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Avg P&L</div>
          <div style={{ color: pnlColor(data.stats.avgPnlPercent), fontWeight: 700, fontSize: 18 }}>
            {formatPnl(data.stats.avgPnlPercent)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Total P&L</div>
          <div style={{ color: pnlColor(data.stats.totalPnlPercent), fontWeight: 700, fontSize: 18 }}>
            {formatPnl(data.stats.totalPnlPercent)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Trades</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{data.stats.totalCalls}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Streak</div>
          <div style={{ color: data.stats.currentStreak.type === "W" ? GREEN : RED, fontWeight: 700, fontSize: 18 }}>
            {data.stats.currentStreak.count}{data.stats.currentStreak.type}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Recent Trades
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recent.map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  background: surfaceBg,
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <span>
                  <span style={{ color: secondary }}>{t.ticker}</span>
                  <span style={{ color: muted, marginLeft: 6 }}>{t.direction}</span>
                </span>
                <span style={{ color: pnlColor(t.pnl_pct), fontWeight: 600 }}>
                  {formatPnl(t.pnl_pct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <a
          href={`https://paste.markets/@${data.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: MUTED, fontSize: 11, textDecoration: "none" }}
        >
          Powered by paste.markets
        </a>
      </div>
    </div>
  );
}

export default function EmbedHandlePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawHandle = (params.handle as string) ?? "";
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  const size = (searchParams.get("size") ?? "card") as "mini" | "card" | "full";
  const theme = searchParams.get("theme") ?? "dark";
  const light = theme === "light";

  const [data, setData] = useState<CallerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) return;
    fetch(`/api/caller/${encodeURIComponent(handle)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError("Caller not found"));
  }, [handle]);

  if (error) {
    return (
      <div style={{ fontFamily: "monospace", color: MUTED, padding: 16, fontSize: 13 }}>
        @{handle} not found on paste.markets
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ fontFamily: "monospace", color: MUTED, padding: 16, fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  if (size === "mini") return <MiniWidget data={data} light={light} />;
  if (size === "full") return <FullWidget data={data} light={light} />;
  return <CardWidget data={data} light={light} />;
}
