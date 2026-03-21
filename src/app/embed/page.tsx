"use client";

import { useState, useMemo } from "react";

const BASE_URL = "https://paste.markets";

type Size = "mini" | "card" | "full";
type Theme = "dark" | "light";

const SIZE_DIMENSIONS: Record<Size, { width: number; height: number }> = {
  mini: { width: 300, height: 80 },
  card: { width: 400, height: 200 },
  full: { width: 600, height: 400 },
};

export default function EmbedBuilderPage() {
  const [handle, setHandle] = useState("");
  const [size, setSize] = useState<Size>("card");
  const [theme, setTheme] = useState<Theme>("dark");
  const [copied, setCopied] = useState<string | null>(null);

  const cleanHandle = handle.replace(/^@/, "").toLowerCase().trim();
  const { width, height } = SIZE_DIMENSIONS[size];

  const embedUrl = useMemo(() => {
    if (!cleanHandle) return "";
    return `${BASE_URL}/embed/@${cleanHandle}?size=${size}&theme=${theme}`;
  }, [cleanHandle, size, theme]);

  const iframeCode = `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0"></iframe>`;

  const badgeMarkdown = `[![paste.markets](${BASE_URL}/api/og/badge/${cleanHandle})](${BASE_URL}/@${cleanHandle})`;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Embed Your Scorecard</h1>
        <p className="text-text-secondary text-sm mb-8">
          Add your live win rate and P&L to your Twitter bio, website, or Notion page.
        </p>

        {/* Handle input */}
        <div className="mb-6">
          <label className="text-xs text-text-muted uppercase tracking-wider block mb-2">
            Handle
          </label>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@frankdegods"
            className="w-full bg-surface border border-border rounded px-4 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        {/* Size selector */}
        <div className="mb-6">
          <label className="text-xs text-text-muted uppercase tracking-wider block mb-2">
            Size
          </label>
          <div className="flex gap-2">
            {(["mini", "card", "full"] as Size[]).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-4 py-2 border rounded text-sm transition-colors ${
                  size === s
                    ? "border-accent text-accent"
                    : "border-border text-text-secondary hover:border-text-muted"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <span className="text-text-muted text-xs ml-2">
                  {SIZE_DIMENSIONS[s].width}x{SIZE_DIMENSIONS[s].height}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme selector */}
        <div className="mb-8">
          <label className="text-xs text-text-muted uppercase tracking-wider block mb-2">
            Theme
          </label>
          <div className="flex gap-2">
            {(["dark", "light"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 border rounded text-sm transition-colors ${
                  theme === t
                    ? "border-accent text-accent"
                    : "border-border text-text-secondary hover:border-text-muted"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {cleanHandle && (
          <>
            <div className="mb-8">
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-2">
                Preview
              </label>
              <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-center" style={{ minHeight: height + 40 }}>
                <iframe
                  src={`/embed/@${cleanHandle}?size=${size}&theme=${theme}`}
                  width={width}
                  height={height}
                  style={{ border: "none" }}
                  title="Widget preview"
                />
              </div>
            </div>

            {/* Embed code */}
            <div className="mb-6">
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-2">
                Embed Code
              </label>
              <div className="relative">
                <pre className="bg-surface border border-border rounded p-4 text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap break-all">
                  {iframeCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(iframeCode, "iframe")}
                  className="absolute top-2 right-2 px-3 py-1 text-xs border border-border rounded hover:border-accent transition-colors text-text-secondary"
                >
                  {copied === "iframe" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Markdown badge */}
            <div className="mb-6">
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-2">
                Markdown Badge
              </label>
              <div className="relative">
                <pre className="bg-surface border border-border rounded p-4 text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap break-all">
                  {badgeMarkdown}
                </pre>
                <button
                  onClick={() => copyToClipboard(badgeMarkdown, "badge")}
                  className="absolute top-2 right-2 px-3 py-1 text-xs border border-border rounded hover:border-accent transition-colors text-text-secondary"
                >
                  {copied === "badge" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
