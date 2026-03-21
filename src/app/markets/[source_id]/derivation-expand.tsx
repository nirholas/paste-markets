"use client";

import { useState } from "react";

interface DerivationExpandProps {
  explanation: string;
}

export function DerivationExpand({ explanation }: DerivationExpandProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3">
      <span
        className="text-[11px] uppercase tracking-widest mr-2"
        style={{ color: "#555568" }}
      >
        Why:
      </span>
      <span
        className="text-sm"
        style={{
          color: "#c8c8d0",
          display: expanded ? "inline" : "-webkit-box",
          WebkitLineClamp: expanded ? undefined : 2,
          WebkitBoxOrient: expanded ? undefined : "vertical",
          overflow: expanded ? "visible" : "hidden",
        }}
      >
        {explanation}
      </span>
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="ml-2 text-[11px] transition-colors"
          style={{ color: "#3b82f6" }}
        >
          more
        </button>
      )}
    </div>
  );
}
