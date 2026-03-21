"use client";

import { useState, useEffect } from "react";

interface Backer {
  handle: string | null;
  amount: number;
  backer_avatar_url: string | null;
}

interface BackerStripProps {
  tradeId: string;
  totalWagered: number;
  backerCount: number;
  /** If provided, skip the fetch and use these backers directly */
  initialBackers?: Backer[];
}

function formatUSDC(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function AvatarCircle({ handle, avatarUrl }: { handle: string | null; avatarUrl: string | null }) {
  const letter = handle ? handle.replace(/^@/, "").charAt(0).toUpperCase() : "?";
  return (
    <div
      className="w-6 h-6 rounded-full bg-[#1a1a2e] border border-[#555568]/50 flex items-center justify-center text-[10px] font-bold text-[#c8c8d0] -ml-1 first:ml-0"
      title={handle ? `@${handle.replace(/^@/, "")}` : "Anonymous"}
    >
      {letter}
    </div>
  );
}

export function BackerStrip({ tradeId, totalWagered, backerCount, initialBackers }: BackerStripProps) {
  const [backers, setBackers] = useState<Backer[]>(initialBackers ?? []);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (initialBackers) return;
    if (backerCount === 0) return;

    fetch(`/api/wagers/${encodeURIComponent(tradeId)}/backers`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.backers) setBackers(data.backers);
      })
      .catch(() => {});
  }, [tradeId, backerCount, initialBackers]);

  if (backerCount === 0) return null;

  const topBackers = backers.slice(0, 3);
  const remaining = backerCount - topBackers.length;
  const topBacker = backers[0];

  return (
    <>
      <div className="flex items-center gap-3 text-xs font-mono">
        {/* Avatars */}
        {topBackers.length > 0 && (
          <div className="flex items-center">
            <span className="text-[#555568] mr-1.5 text-[10px] uppercase tracking-widest">Backed by</span>
            <div className="flex items-center">
              {topBackers.map((b, i) => (
                <AvatarCircle key={i} handle={b.handle} avatarUrl={b.backer_avatar_url} />
              ))}
            </div>
            {remaining > 0 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-[#555568] hover:text-[#3b82f6] ml-1 transition-colors"
              >
                +{remaining} other{remaining !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 text-[11px] text-[#555568] font-mono">
        <span>
          <span className="text-[#f0f0f0] font-bold">{formatUSDC(totalWagered)}</span> USDC wagered
        </span>
        <span>·</span>
        <span>{backerCount} backer{backerCount !== 1 ? "s" : ""}</span>
        {topBacker?.handle && (
          <>
            <span>·</span>
            <span>
              Top: <span className="text-[#c8c8d0]">@{topBacker.handle.replace(/^@/, "")}</span>{" "}
              ({formatUSDC(topBacker.amount)} USDC)
            </span>
          </>
        )}
      </div>

      {/* Expanded backer list */}
      {showAll && backers.length > 3 && (
        <div className="bg-[#0a0a1a] border border-[#1a1a2e] rounded p-3 space-y-1.5 mt-1">
          <p className="text-[10px] uppercase tracking-widest text-[#555568] mb-2">All Backers</p>
          {backers.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#c8c8d0]">
                {b.handle ? `@${b.handle.replace(/^@/, "")}` : "Anonymous"}
              </span>
              <span className="text-[#555568]">{formatUSDC(b.amount)} USDC</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
