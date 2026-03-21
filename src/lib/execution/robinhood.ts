/**
 * Robinhood execution — deep links and instructions only.
 * Robinhood has no public trading API, so we guide users to the app.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RobinhoodInstruction {
  ticker: string;
  direction: "buy" | "sell";
  suggestedAmount?: number;
  deepLink: string;
  webUrl: string;
}

// ---------------------------------------------------------------------------
// Generate instruction
// ---------------------------------------------------------------------------

export function getRobinhoodInstruction(
  ticker: string,
  direction: string,
  suggestedAmount?: number
): RobinhoodInstruction {
  const normalizedTicker = ticker.replace(/^\$/, "").toUpperCase();
  const dir: "buy" | "sell" =
    direction === "short" || direction === "sell" || direction === "no"
      ? "sell"
      : "buy";

  return {
    ticker: normalizedTicker,
    direction: dir,
    suggestedAmount,
    deepLink: `robinhood://instrument/?symbol=${normalizedTicker}`,
    webUrl: `https://robinhood.com/stocks/${normalizedTicker}`,
  };
}
