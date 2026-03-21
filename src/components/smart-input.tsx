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
  // $TICKER or pure uppercase letters like BTC, ETH (2-8 chars, no spaces)
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

  const borderClass =
    type === "url"
      ? "border-accent"
      : type === "handle"
        ? "border-[#2ecc71]"
        : type === "ticker"
          ? "border-[#f39c12]"
          : "border-border focus-within:border-accent";

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          className={`input-glow flex items-center bg-[#0f0f22] border rounded-lg px-5 py-4 transition-all ${borderClass}`}
        >
          <span className="text-[#555568] mr-3 text-lg select-none">/</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            className="flex-1 bg-transparent outline-none text-[#f0f0f0] placeholder:text-[#555568] font-mono text-base"
            autoComplete="off"
            spellCheck={false}
          />
          {type !== "empty" && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="text-[#555568] hover:text-[#c8c8d0] transition-colors ml-2 text-sm"
            >
              &times;
            </button>
          )}
        </div>

        {/* Label */}
        {type === "url" && (
          <p className="text-xs text-accent mt-1.5 font-mono">
            URL detected — we&apos;ll extract the trade
          </p>
        )}
        {type === "handle" && (
          <p className="text-xs text-[#2ecc71] mt-1.5 font-mono">
            Trader detected
          </p>
        )}
        {type === "ticker" && (
          <p className="text-xs text-[#f39c12] mt-1.5 font-mono">
            Ticker detected — view all calls
          </p>
        )}

        {/* Buttons */}
        <div className="mt-3 flex gap-2">
          {type === "url" && (
            <button
              type="submit"
              className="flex-1 border border-accent text-accent hover:bg-accent hover:text-white font-mono text-sm py-2 px-4 rounded transition-colors"
            >
              Find The Trade &rarr;
            </button>
          )}
          {type === "handle" && (
            <button
              type="submit"
              className="flex-1 border border-[#2ecc71] text-[#2ecc71] hover:bg-[#2ecc71] hover:text-black font-mono text-sm py-2 px-4 rounded transition-colors"
            >
              View Profile &rarr;
            </button>
          )}
          {type === "ticker" && (
            <button
              type="submit"
              className="flex-1 border border-[#f39c12] text-[#f39c12] hover:bg-[#f39c12] hover:text-black font-mono text-sm py-2 px-4 rounded transition-colors"
            >
              View Asset &rarr;
            </button>
          )}
          {type === "text" && (
            <>
              <button
                type="button"
                onClick={() => handleViewProfile()}
                className="flex-1 border border-border text-text-secondary hover:border-[#2ecc71] hover:text-[#2ecc71] font-mono text-sm py-2 px-4 rounded transition-colors"
              >
                Search Traders
              </button>
              <button
                type="submit"
                className="flex-1 border border-accent text-accent hover:bg-accent hover:text-white font-mono text-sm py-2 px-4 rounded transition-colors"
              >
                Find The Trade &rarr;
              </button>
            </>
          )}
          {type === "empty" && (
            <button
              type="submit"
              disabled
              className="flex-1 border border-border text-text-muted font-mono text-sm py-2 px-4 rounded opacity-50 cursor-not-allowed"
            >
              Search or paste a URL
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
