"use client";

import { useState } from "react";

type FormatType = "landscape" | "square" | "story";

interface ShareButtonProps {
  tradeId: string;
  ticker: string;
  direction: string;
  handle: string;
  pnlPct: number | null;
  tradeUrl: string;
}

const FORMAT_LABELS: Record<FormatType, string> = {
  square: "Square",
  landscape: "Landscape",
  story: "Story",
};

const FORMAT_DIMS: Record<FormatType, string> = {
  square: "1080×1080",
  landscape: "1200×630",
  story: "1080×1920",
};

const FORMAT_ASPECT: Record<FormatType, string> = {
  square: "1 / 1",
  landscape: "1200 / 630",
  story: "9 / 16",
};

export function ShareButton({ tradeId, ticker, direction, handle, pnlPct, tradeUrl }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<FormatType>("square");
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const isWinner = pnlPct != null && pnlPct >= 0;
  const pnlStr = pnlPct != null ? ` ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%` : "";
  const tweetText = isWinner
    ? `Called it! @${handle} nailed $${ticker} ${direction.toUpperCase()}${pnlStr} — tracking on @paste_markets`
    : `@${handle}'s $${ticker} ${direction.toUpperCase()} call is currently${pnlStr} — tracking on @paste_markets`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(tradeUrl)}`;
  const ogImageUrl = `/api/og/trade/${tradeId}?format=${format}&author=${handle}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(tradeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — no-op
    }
  }

  async function copyEmbed() {
    const origin = window.location.origin;
    const code = `<iframe src="${origin}/embed/${tradeId}" width="400" height="200" frameborder="0" scrolling="no" style="border:none;overflow:hidden;"></iframe>`;
    try {
      await navigator.clipboard.writeText(code);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch {
      // fallback — no-op
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-accent text-accent hover:bg-accent/10 px-4 py-2 rounded-lg text-sm transition-colors"
      >
        Share Card
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="bg-surface border border-border rounded-lg w-full max-w-lg p-6 space-y-5"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-text-primary uppercase tracking-[2px]">
                Share This Call
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-text-primary text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Format selector */}
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">Format</div>
              <div className="flex gap-2">
                {(["square", "landscape", "story"] as FormatType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-2 px-1 text-xs border rounded-lg transition-colors ${
                      format === f
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-text-muted hover:border-accent hover:text-text-secondary"
                    }`}
                  >
                    <div className="font-bold">{FORMAT_LABELS[f]}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">{FORMAT_DIMS[f]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Card preview */}
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">Preview</div>
              <div
                className="border border-border rounded-lg overflow-hidden bg-black flex items-center justify-center"
                style={{ maxHeight: "300px" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ogImageUrl}
                  alt="PnL card preview"
                  className="w-full"
                  style={{ aspectRatio: FORMAT_ASPECT[format], objectFit: "contain" }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={copyLink}
                className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg text-sm transition-colors"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg text-sm transition-colors"
              >
                Tweet This
              </a>
              <a
                href={ogImageUrl}
                download={`${ticker}-${direction}-pnl.png`}
                className="border border-border hover:border-accent text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg text-sm transition-colors"
              >
                Download
              </a>
            </div>

            {/* Embed section */}
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">Embed</div>
              <div className="bg-[#0a0a1a] border border-border rounded-lg p-3 font-mono text-[11px] text-text-muted break-all">
                {`<iframe src="paste.markets/embed/${tradeId}" width="400" height="200" frameborder="0"></iframe>`}
              </div>
              <button
                onClick={copyEmbed}
                className="mt-2 border border-border hover:border-accent text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg text-xs transition-colors"
              >
                {embedCopied ? "Copied!" : "Copy Embed Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
