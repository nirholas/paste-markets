"use client";

import { useState, useRef } from "react";
import type { CompletenessGrade } from "@/lib/completeness";

// ---------------------------------------------------------------------------
// Grade config
// ---------------------------------------------------------------------------

interface GradeConfig {
  label: string;
  symbol: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

const GRADE_CONFIG: Record<CompletenessGrade, GradeConfig> = {
  VERIFIED: {
    label: "VERIFIED",
    symbol: "\u2713",
    color: "#2ecc71",
    borderColor: "border-[#2ecc71]",
    bgColor: "bg-[#2ecc71]/10",
  },
  MOSTLY_COMPLETE: {
    label: "MOSTLY COMPLETE",
    symbol: "\u2248",
    color: "#3b82f6",
    borderColor: "border-[#3b82f6]",
    bgColor: "bg-[#3b82f6]/10",
  },
  PARTIAL: {
    label: "PARTIAL",
    symbol: "\u26A0",
    color: "#f39c12",
    borderColor: "border-[#f39c12]",
    bgColor: "bg-[#f39c12]/10",
  },
  CHERRY_PICKED: {
    label: "CHERRY PICKED",
    symbol: "\u2716",
    color: "#e74c3c",
    borderColor: "border-[#e74c3c]",
    bgColor: "bg-[#e74c3c]/10",
  },
  UNKNOWN: {
    label: "UNKNOWN",
    symbol: "?",
    color: "#555568",
    borderColor: "border-[#555568]",
    bgColor: "bg-[#555568]/10",
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AuditBadgeProps {
  grade: CompletenessGrade;
  completenessPercent?: number;
  showDetails?: boolean;
  auditDate?: string;
  tweetsSampled?: number;
  tradeRelatedFound?: number;
  matchedCount?: number;
  missingCount?: number;
  handle?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditBadge({
  grade,
  completenessPercent,
  showDetails = false,
  auditDate,
  tweetsSampled,
  tradeRelatedFound,
  matchedCount,
  missingCount,
  handle,
}: AuditBadgeProps) {
  const [hovered, setHovered] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const config = GRADE_CONFIG[grade];

  const showPopover = showDetails || hovered;

  return (
    <span
      ref={badgeRef}
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Badge */}
      <span
        className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono font-bold uppercase tracking-widest text-[10px] ${config.borderColor} ${config.bgColor}`}
        style={{ color: config.color }}
      >
        <span aria-hidden="true">{config.symbol}</span>
        {config.label}
        {completenessPercent != null && (
          <span className="opacity-70 font-normal normal-case tracking-normal ml-1">
            {completenessPercent}%
          </span>
        )}
      </span>

      {/* Popover */}
      {showPopover && auditDate && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 border border-[#1a1a2e] bg-[#0f0f22] rounded-lg p-3 shadow-xl">
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#555568]">Last Audited</span>
              <span className="text-[#c8c8d0]">
                {new Date(auditDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {tweetsSampled != null && (
              <div className="flex justify-between">
                <span className="text-[#555568]">Tweets Sampled</span>
                <span className="text-[#c8c8d0]">{tweetsSampled}</span>
              </div>
            )}

            {tradeRelatedFound != null && (
              <div className="flex justify-between">
                <span className="text-[#555568]">Trade-Related</span>
                <span className="text-[#c8c8d0]">{tradeRelatedFound}</span>
              </div>
            )}

            {matchedCount != null && completenessPercent != null && (
              <div className="flex justify-between">
                <span className="text-[#555568]">Matched</span>
                <span style={{ color: config.color }}>
                  {matchedCount} ({completenessPercent}%)
                </span>
              </div>
            )}

            {missingCount != null && (
              <div className="flex justify-between">
                <span className="text-[#555568]">Missing Calls</span>
                <span className={missingCount > 0 ? "text-[#e74c3c]" : "text-[#c8c8d0]"}>
                  {missingCount}
                </span>
              </div>
            )}

            {handle && (
              <a
                href={`/audit/${encodeURIComponent(handle)}`}
                className="block mt-2 text-center text-[10px] uppercase tracking-widest border border-[#1a1a2e] hover:border-[#3b82f6] px-2 py-1 transition-colors text-[#3b82f6]"
              >
                View Full Audit Report
              </a>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
