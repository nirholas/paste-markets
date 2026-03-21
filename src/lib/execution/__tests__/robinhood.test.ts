import { describe, it, expect } from "vitest";
import { getRobinhoodInstruction } from "../robinhood";

describe("getRobinhoodInstruction", () => {
  it("generates correct buy instruction", () => {
    const result = getRobinhoodInstruction("AAPL", "long");
    expect(result.ticker).toBe("AAPL");
    expect(result.direction).toBe("buy");
    expect(result.deepLink).toBe("robinhood://instrument/?symbol=AAPL");
    expect(result.webUrl).toBe("https://robinhood.com/stocks/AAPL");
  });

  it("generates correct sell instruction for short direction", () => {
    const result = getRobinhoodInstruction("TSLA", "short");
    expect(result.direction).toBe("sell");
  });

  it("normalizes ticker — strips $ and uppercases", () => {
    const result = getRobinhoodInstruction("$aapl", "long");
    expect(result.ticker).toBe("AAPL");
    expect(result.deepLink).toContain("AAPL");
  });

  it("maps 'no' direction to sell", () => {
    const result = getRobinhoodInstruction("SPY", "no");
    expect(result.direction).toBe("sell");
  });

  it("maps 'yes' direction to buy", () => {
    const result = getRobinhoodInstruction("SPY", "yes");
    expect(result.direction).toBe("buy");
  });

  it("includes suggestedAmount when provided", () => {
    const result = getRobinhoodInstruction("NVDA", "long", 500);
    expect(result.suggestedAmount).toBe(500);
  });

  it("suggestedAmount is undefined when not provided", () => {
    const result = getRobinhoodInstruction("NVDA", "long");
    expect(result.suggestedAmount).toBeUndefined();
  });
});
