"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TIMEFRAMES = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "ALL" },
] as const;

interface SimTimeframeSelectorProps {
  handle: string;
  current: string;
}

export function SimTimeframeSelector({ handle, current }: SimTimeframeSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("t", value);
    router.push(`/sim/${handle}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1">
      {TIMEFRAMES.map(({ value, label }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            onClick={() => handleSelect(value)}
            className={[
              "text-[11px] uppercase tracking-widest px-2.5 py-1 rounded border transition-colors",
              isActive
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-muted hover:border-accent hover:text-text-secondary",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
