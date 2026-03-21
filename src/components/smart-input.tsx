"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";

const PLACEHOLDERS = [
  "paste a tweet URL...",
  "search @frankdegods...",
  "$BTC — view all calls...",
  "nvidia earnings beat, short the pop...",
  "https://x.com/...",
];

function detectType(val: string): "url" | "handle" | "ticker" | "text" | "empty" {
  const v = val.trim();
  if (!v) return "empty";
  if (v.startsWith("http://") || v.startsWith("https://")) return "url";
  if (v.startsWith("@")) return "handle";
  if (/^\$[A-Za-z]{1,10}$/.test(v) || /^[A-Z]{2,8}$/.test(v)) return "ticker";
  return "text";
}

export function SmartInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const type = detectType(value);

  function handleFindTrade(e?: FormEvent) {
    e?.preventDefault();
    const v = value.trim();
    if (v) router.push(`/trade?q=${encodeURIComponent(v)}`);
  }

  function handleViewProfile(e?: FormEvent) {
    e?.preventDefault();
    const handle = value.trim().replace(/^@/, "");
    if (handle) router.push(`/${encodeURIComponent(handle)}`);
  }

  function handleViewAsset(e?: FormEvent) {
    e?.preventDefault();
    const ticker = value.trim().replace(/^\$/, "").toUpperCase();
    if (ticker) router.push(`/asset/${encodeURIComponent(ticker)}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (type === "url" || type === "text") handleFindTrade();
    else if (type === "handle") handleViewProfile();
    else if (type === "ticker") handleViewAsset();
  }

  const ringColor =
    type === "url"
      ? "ring-[#6366f1]"
      : type === "handle"
        ? "ring-[#22c55e]"
        : type === "ticker"
          ? "ring-[#f59e0b]"
          : "ring-transparent focus-within:ring-[#6366f1]/50";

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          className={`flex items-center bg-[#12121a] border border-[#ffffff14] rounded-2xl px-5 py-4 transition-all ring-2 ${ringColor}`}
        >
          <svg className="w-5 h-5 text-[#52525b] mr-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            className="flex-1 bg-transparent outline-none text-[#f5f5f7] placeholder:text-[#52525b] text-base"
            autoComplete="off"
            spellCheck={false}
          />
          {type !== "empty" && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="text-[#52525b] hover:text-[#a1a1aa] transition-colors ml-2 p-1 rounded-full hover:bg-[#ffffff0a]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Type label */}
        {type === "url" && (
          <p className="text-xs text-[#6366f1] mt-2 ml-1 font-medium">
            URL detected — we&apos;ll extract the trade
          </p>
        )}
        {type === "handle" && (
          <p className="text-xs text-[#22c55e] mt-2 ml-1 font-medium">
            Trader detected
          </p>
        )}
        {type === "ticker" && (
          <p className="text-xs text-[#f59e0b] mt-2 ml-1 font-medium">
            Ticker detected — view all calls
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-3 flex gap-2">
          {type === "url" && (
            <button
              type="submit"
              className="flex-1 bg-[#6366f1] text-white font-semibold text-sm py-2.5 px-4 rounded-xl hover:bg-[#5558e6] transition-colors"
            >
              Find The Trade
            </button>
          )}
          {type === "handle" && (
            <button
              type="submit"
              className="flex-1 bg-[#22c55e] text-black font-semibold text-sm py-2.5 px-4 rounded-xl hover:bg-[#16a34a] transition-colors"
            >
              View Profile
            </button>
          )}
          {type === "ticker" && (
            <button
              type="submit"
              className="flex-1 bg-[#f59e0b] text-black font-semibold text-sm py-2.5 px-4 rounded-xl hover:bg-[#d97706] transition-colors"
            >
              View Asset
            </button>
          )}
          {type === "text" && (
            <>
              <button
                type="button"
                onClick={() => handleViewProfile()}
                className="flex-1 bg-[#ffffff08] border border-[#ffffff14] text-[#a1a1aa] font-medium text-sm py-2.5 px-4 rounded-xl hover:bg-[#ffffff14] hover:text-[#f5f5f7] transition-colors"
              >
                Search Traders
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#6366f1] text-white font-semibold text-sm py-2.5 px-4 rounded-xl hover:bg-[#5558e6] transition-colors"
              >
                Find The Trade
              </button>
            </>
          )}
          {type === "empty" && (
            <button
              type="submit"
              disabled
              className="flex-1 bg-[#ffffff08] text-[#52525b] font-medium text-sm py-2.5 px-4 rounded-xl cursor-not-allowed"
            >
              Search or paste a URL
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
