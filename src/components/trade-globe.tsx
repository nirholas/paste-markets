"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TradePoint, TradeArc, GlobeStats } from "@/lib/globe-types";

interface TradeGlobeProps {
  points: TradePoint[];
  arcs: TradeArc[];
  stats: GlobeStats;
}

function sanitize(text: string): string {
  return text.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

export default function TradeGlobe({ points, arcs, stats }: TradeGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedArc, setSelectedArc] = useState<TradeArc | null>(null);

  // Suppress THREE.Clock deprecation warning (from three-globe internals, no upgrade available)
  useEffect(() => {
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("THREE.Clock")) return;
      originalWarn.apply(console, args);
    };
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  // Initialize globe
  useEffect(() => {
    if (!containerRef.current || initialized) return;

    let cancelled = false;

    (async () => {
      const Globe = (await import("globe.gl")).default;
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      const globe = (Globe as any)()
        .width(width)
        .height(height)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-night.jpg")
        .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .atmosphereColor("#1a1a4a")
        .atmosphereAltitude(0.25)
        // Points (callers + tickers)
        .pointsData(points)
        .pointLat("lat")
        .pointLng("lng")
        .pointAltitude(() => 0.01)
        .pointColor("color")
        .pointRadius("size")
        .pointLabel((d: any) => {
          return `<div style="background:rgba(10,10,26,0.9);padding:6px 10px;border-radius:6px;font-size:12px;font-family:monospace;border:1px solid #1a1a2e;color:#f0f0f0;">
            <strong>${sanitize(d.label)}</strong>
          </div>`;
        })
        // Arcs (trades)
        .arcsData(arcs)
        .arcStartLat("startLat")
        .arcStartLng("startLng")
        .arcEndLat("endLat")
        .arcEndLng("endLng")
        .arcColor("color")
        .arcStroke("stroke")
        .arcDashLength(0.4)
        .arcDashGap("dashGap")
        .arcDashAnimateTime("dashAnimateTime")
        .arcLabel((d: any) => {
          const arc = d as TradeArc;
          const pnlColor = arc.pnl >= 0 ? "#2ecc71" : "#e74c3c";
          const sign = arc.pnl >= 0 ? "+" : "";
          return `<div style="background:rgba(10,10,26,0.9);padding:6px 10px;border-radius:6px;font-size:12px;font-family:monospace;border:1px solid #1a1a2e;">
            <span style="color:#c8c8d0">@${sanitize(arc.author)}</span>
            <span style="color:#555568"> → </span>
            <span style="color:#f39c12">$${sanitize(arc.ticker)}</span>
            <br/>
            <span style="color:${pnlColor};font-weight:700">${sign}${arc.pnl.toFixed(1)}%</span>
          </div>`;
        })
        .onArcClick((arc: any) => {
          setSelectedArc(arc as TradeArc);
        })(container);

      // Camera controls
      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.enableDamping = true;

      globeRef.current = globe;
      setInitialized(true);

      // Resize handling
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current) {
          globe
            .width(containerRef.current.clientWidth)
            .height(containerRef.current.clientHeight);
        }
      });
      resizeObserver.observe(container);

      return () => resizeObserver.disconnect();
    })();

    return () => { cancelled = true; };
  }, [initialized]);

  // Update data when props change
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointsData(points).arcsData(arcs);
  }, [points, arcs]);

  // Escape to reset camera
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedArc(null);
        const globe = globeRef.current;
        if (globe) {
          globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1000);
          globe.controls().autoRotate = true;
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: "#0a0a1a" }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Stats overlay */}
      <div
        className="absolute top-5 left-5 p-4 rounded-lg font-mono text-sm"
        style={{
          background: "rgba(10,10,26,0.85)",
          border: "1px solid #1a1a2e",
        }}
      >
        <div className="font-bold mb-2" style={{ color: "#f0f0f0", fontSize: 15 }}>
          TRADE GLOBE
        </div>
        <div className="space-y-1">
          <div>
            <span style={{ color: "#555568" }}>Trades:</span>{" "}
            <span style={{ color: "#f0f0f0" }}>{stats.totalTrades}</span>
          </div>
          <div>
            <span style={{ color: "#555568" }}>Callers:</span>{" "}
            <span style={{ color: "#3b82f6" }}>{stats.activeCallers}</span>
          </div>
          <div>
            <span style={{ color: "#555568" }}>Tickers:</span>{" "}
            <span style={{ color: "#f39c12" }}>{stats.activeTickers}</span>
          </div>
          <div>
            <span style={{ color: "#555568" }}>Avg P&L:</span>{" "}
            <span style={{ color: stats.avgPnl >= 0 ? "#2ecc71" : "#e74c3c" }}>
              {stats.avgPnl >= 0 ? "+" : ""}{stats.avgPnl.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        className="absolute bottom-5 left-5 p-3 rounded-lg font-mono text-xs"
        style={{
          background: "rgba(10,10,26,0.85)",
          border: "1px solid #1a1a2e",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />
          <span style={{ color: "#c8c8d0" }}>Callers</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#f39c12" }} />
          <span style={{ color: "#c8c8d0" }}>Tickers</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#2ecc71" }} />
          <span style={{ color: "#c8c8d0" }}>Winning trade</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#e74c3c" }} />
          <span style={{ color: "#c8c8d0" }}>Losing trade</span>
        </div>
      </div>

      {/* Selected arc detail */}
      {selectedArc && (
        <div
          className="absolute top-5 right-5 p-4 rounded-lg font-mono text-sm max-w-xs"
          style={{
            background: "rgba(10,10,26,0.95)",
            border: `1px solid ${selectedArc.pnl >= 0 ? "#2ecc71" : "#e74c3c"}44`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold" style={{ color: "#f0f0f0" }}>Trade Detail</span>
            <button
              onClick={() => setSelectedArc(null)}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "#555568", border: "1px solid #1a1a2e" }}
            >
              ESC
            </button>
          </div>
          <div className="space-y-1">
            <div>
              <span style={{ color: "#555568" }}>Caller:</span>{" "}
              <span style={{ color: "#3b82f6" }}>@{selectedArc.author}</span>
            </div>
            <div>
              <span style={{ color: "#555568" }}>Ticker:</span>{" "}
              <span style={{ color: "#f39c12" }}>${selectedArc.ticker}</span>
            </div>
            <div>
              <span style={{ color: "#555568" }}>P&L:</span>{" "}
              <span style={{ color: selectedArc.pnl >= 0 ? "#2ecc71" : "#e74c3c", fontWeight: 700 }}>
                {selectedArc.pnl >= 0 ? "+" : ""}{selectedArc.pnl.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
