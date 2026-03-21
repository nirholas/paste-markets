"use client";

import { useState } from "react";
import { TradeConfirmModal, type TradeParams } from "./trade-confirm-modal";

// ---------------------------------------------------------------------------
// Execute Trade button — add to trade cards and trade finder
// ---------------------------------------------------------------------------

interface ExecuteButtonProps {
  tradeId?: string;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform?: string | null;
  entryPrice?: number | null;
  leverage?: number | null;
  // Polymarket-specific
  conditionId?: string;
  contractTitle?: string;
  outcomePrice?: number;
  // Context
  authorHandle?: string;
  thesis?: string;
  // Styling
  className?: string;
  variant?: "default" | "compact";
}

function platformToVenue(
  platform?: string | null
): "hyperliquid" | "polymarket" | "robinhood" {
  const p = (platform ?? "").toLowerCase();
  if (p === "polymarket") return "polymarket";
  if (p === "robinhood") return "robinhood";
  return "hyperliquid";
}

export function ExecuteButton({
  tradeId,
  ticker,
  direction,
  platform,
  entryPrice,
  leverage,
  conditionId,
  contractTitle,
  outcomePrice,
  authorHandle,
  thesis,
  className,
  variant = "default",
}: ExecuteButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const venue = platformToVenue(platform);

  const tradeParams: TradeParams = {
    tradeId,
    venue,
    asset: ticker,
    direction,
    currentPrice: entryPrice ?? undefined,
    suggestedLeverage: leverage ?? (venue === "hyperliquid" ? 5 : undefined),
    conditionId,
    marketQuestion: contractTitle,
    outcomePrice,
    authorHandle,
    thesis,
  };

  const buttonClass =
    variant === "compact"
      ? `text-xs border border-accent text-accent px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors font-bold ${className ?? ""}`
      : `border border-accent text-accent px-4 py-2 text-sm font-bold rounded-lg hover:bg-accent/10 transition-colors ${className ?? ""}`;

  return (
    <>
      <button onClick={() => setShowModal(true)} className={buttonClass}>
        Execute Trade
      </button>

      {showModal && (
        <TradeConfirmModal
          params={tradeParams}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            // Modal shows success state internally
          }}
        />
      )}
    </>
  );
}
