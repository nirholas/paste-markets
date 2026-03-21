"use client";

import { useState } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://paste.markets";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      onClick={copy}
      className="border border-[#1a1a2e] hover:border-[#3b82f6] text-[#555568] hover:text-[#f0f0f0] text-xs px-3 py-1.5 rounded transition-colors font-mono"
    >
      {copied ? "COPIED" : label}
    </button>
  );
}

function EmbedBlock({
  label,
  code,
}: {
  label: string;
  code: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[#555568] text-xs uppercase tracking-widest font-mono">
          {label}
        </span>
        <CopyButton text={code} label="COPY" />
      </div>
      <pre className="bg-[#0f0f22] border border-[#1a1a2e] rounded p-3 text-xs text-[#c8c8d0] font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

export default function WidgetGenerator() {
  const [input, setInput] = useState("frankdegods");
  const [handle, setHandle] = useState("frankdegods");

  const fullUrl = `${BASE}/api/widget/${handle}`;
  const badgeUrl = `${BASE}/api/widget/${handle}?style=badge`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = input.replace(/^@/, "").toLowerCase().trim();
    if (clean) setHandle(clean);
  }

  return (
    <div className="space-y-10">
      {/* Handle input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="@yourhandle"
            className="w-full bg-[#0f0f22] border border-[#1a1a2e] focus:border-[#3b82f6] rounded px-4 py-2 text-sm text-[#f0f0f0] font-mono outline-none transition-colors placeholder:text-[#555568]"
          />
        </div>
        <button
          type="submit"
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm px-5 py-2 rounded font-mono font-bold transition-colors"
        >
          GENERATE
        </button>
      </form>

      {/* Previews */}
      <div className="space-y-8">
        {/* Full widget preview */}
        <div className="space-y-4">
          <h2 className="text-[#555568] text-xs uppercase tracking-widest font-mono">
            Full Widget — 400 × 180
          </h2>
          <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={handle}
              src={`/api/widget/${handle}`}
              alt={`${handle} trade scorecard`}
              width={400}
              height={180}
              className="block"
            />
          </div>
        </div>

        {/* Badge preview */}
        <div className="space-y-4">
          <h2 className="text-[#555568] text-xs uppercase tracking-widest font-mono">
            Badge — 320 × 28
          </h2>
          <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={handle + "-badge"}
              src={`/api/widget/${handle}?style=badge`}
              alt={`${handle} trade badge`}
              width={320}
              height={28}
              className="block"
            />
          </div>
        </div>
      </div>

      {/* Embed codes */}
      <div className="space-y-6">
        <h2 className="text-[#f0f0f0] text-sm font-mono font-bold uppercase tracking-widest">
          Embed Code
        </h2>

        <div className="space-y-5">
          <EmbedBlock
            label="HTML (Full)"
            code={`<img src="${fullUrl}" alt="@${handle} scorecard" width="400" height="180" />`}
          />
          <EmbedBlock
            label="HTML (Badge)"
            code={`<img src="${badgeUrl}" alt="@${handle} scorecard" width="320" height="28" />`}
          />
          <EmbedBlock
            label="Markdown (Full)"
            code={`[![${handle} scorecard](${fullUrl})](https://paste.markets/${handle})`}
          />
          <EmbedBlock
            label="Markdown (Badge)"
            code={`[![${handle} badge](${badgeUrl})](https://paste.markets/${handle})`}
          />
          <EmbedBlock label="URL (Full)" code={fullUrl} />
          <EmbedBlock label="URL (Badge)" code={badgeUrl} />
        </div>
      </div>

      {/* Usage notes */}
      <div className="border border-[#1a1a2e] rounded-lg p-5 space-y-2">
        <p className="text-[#555568] text-xs font-mono uppercase tracking-widest">
          Usage Notes
        </p>
        <ul className="space-y-1.5 text-[#c8c8d0] text-sm font-mono">
          <li>
            · Works anywhere{" "}
            <span className="text-[#555568]">{`<img>`}</span> tags are supported
            — Twitter/X bio links, GitHub READMEs, Linktree, Notion
          </li>
          <li>
            · SVG format — crisp at any size, no JavaScript, no cookies
          </li>
          <li>
            · Updates every hour automatically — no re-embedding needed
          </li>
          <li>
            · Your full profile:{" "}
            <a
              href={`/${handle}`}
              className="text-[#3b82f6] hover:underline"
            >
              paste.markets/{handle}
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
