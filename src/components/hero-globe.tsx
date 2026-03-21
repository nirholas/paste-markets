"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TradePoint, TradeArc } from "@/lib/globe-types";

interface VisitorRing {
  lat: number;
  lng: number;
  maxR: number;
  propagationSpeed: number;
  repeatPeriod: number;
  color: string;
  city: string | null;
  country: string | null;
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

export default function HeroGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [initialized, setInitialized] = useState(false);
  const [points, setPoints] = useState<TradePoint[]>([]);
  const [arcs, setArcs] = useState<TradeArc[]>([]);
  const [rings, setRings] = useState<VisitorRing[]>([]);

  // Fetch trade data for points + arcs
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/globe?window=7d&limit=80");
      if (!res.ok) return;
      const data = await res.json();
      setPoints(data.points ?? []);
      setArcs(data.arcs ?? []);
    } catch {
      // silent fail — globe is decorative
    }
  }, []);

  // Fetch recent visitor rings
  const fetchVisitors = useCallback(async () => {
    try {
      const res = await fetch("/api/globe/visitors");
      if (!res.ok) return;
      const data = await res.json();
      setRings(data.rings ?? []);
    } catch {
      // silent fail
    }
  }, []);

  // Ping this visitor's location on mount
  useEffect(() => {
    fetch("/api/globe/ping", { method: "POST" }).catch(() => {});
  }, []);

  // Fetch trade data once
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll visitor rings every 5 seconds
  useEffect(() => {
    fetchVisitors();
    const interval = setInterval(fetchVisitors, 5000);
    return () => clearInterval(interval);
  }, [fetchVisitors]);

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
        .backgroundColor("rgba(0,0,0,0)")
        .atmosphereColor("#1a1a4a")
        .atmosphereAltitude(0.25)
        // Trade points
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
        // Trade arcs
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
        // Visitor rings — animated expanding circles
        .ringsData(rings)
        .ringLat("lat")
        .ringLng("lng")
        .ringMaxRadius("maxR")
        .ringPropagationSpeed("propagationSpeed")
        .ringRepeatPeriod("repeatPeriod")
        .ringColor("color")(container);

      // Camera
      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableDamping = true;
      controls.enableZoom = false;

      // Start zoomed in a bit more for hero
      globe.pointOfView({ lat: 20, lng: -20, altitude: 2.2 }, 0);

      globeRef.current = globe;
      setInitialized(true);

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

  // Update data when fetched
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointsData(points).arcsData(arcs);
  }, [points, arcs]);

  // Update visitor rings
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.ringsData(rings);
  }, [rings]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: "420px", background: "transparent" }}
    />
  );
}
