"use client";

import { VENUE_FILTER_OPTIONS } from "@/lib/venues";

export type VenueFilterValue = "all" | "stocks" | "perps" | "prediction";

interface VenueFilterProps {
  value: VenueFilterValue;
  onChange: (value: VenueFilterValue) => void;
  counts?: Partial<Record<VenueFilterValue, number>>;
}

export function VenueFilter({ value, onChange, counts }: VenueFilterProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {VENUE_FILTER_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        const count = counts?.[opt.value as VenueFilterValue];

        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value as VenueFilterValue)}
            className="relative px-3 py-1.5 text-xs font-mono rounded-lg border transition-all duration-150"
            style={{
              borderColor: isActive ? opt.color : "#1a1a2e",
              color: isActive ? opt.color : "#555568",
              backgroundColor: isActive ? `${opt.color}10` : "transparent",
            }}
          >
            <span className="flex items-center gap-1.5">
              {opt.icon && <span>{opt.icon}</span>}
              <span>{opt.label}</span>
              {count != null && count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
                  style={{
                    backgroundColor: isActive ? `${opt.color}20` : "#1a1a2e",
                    color: isActive ? opt.color : "#555568",
                  }}
                >
                  {count}
                </span>
              )}
            </span>
            {/* Active underline */}
            {isActive && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-0.5 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
