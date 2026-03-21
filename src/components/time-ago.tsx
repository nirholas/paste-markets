"use client";

import { useState, useEffect } from "react";

function computeTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatStatic(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Hydration-safe relative time display.
 * Renders a static date on the server, then switches to relative time on mount.
 */
export function TimeAgo({
  date,
  className,
  style,
}: {
  date: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState(() => formatStatic(date));

  useEffect(() => {
    setText(computeTimeAgo(date));
    const id = setInterval(() => setText(computeTimeAgo(date)), 60_000);
    return () => clearInterval(id);
  }, [date]);

  return (
    <span className={className} style={style} suppressHydrationWarning>
      {text}
    </span>
  );
}
