/**
 * Alert Rules Engine — flexible rule system for copytrading signals.
 * Users define conditions (caller, ticker, direction, platform, confidence, tier)
 * and channels (browser, telegram, webhook) to get notified on matching trades.
 */

import { randomUUID } from "node:crypto";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  userId: string;             // wallet address or session ID / handle
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  channels: AlertChannel[];
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
}

export interface AlertCondition {
  type: "caller" | "ticker" | "direction" | "platform" | "confidence" | "tier";
  operator: "eq" | "in" | "gte" | "lte";
  value: string | string[] | number;
}

export interface AlertChannel {
  type: "browser" | "telegram" | "webhook";
  config: Record<string, string>;
}

/** A trade signal detected by the poller or submitted manually. */
export interface DetectedTrade {
  id?: string;
  callerHandle: string;
  ticker: string;
  direction: string;       // "long" | "short" | "yes" | "no"
  platform?: string;
  confidence?: number;
  tier?: string;            // S, A, B, C
  entryPrice?: number;
  pnlPct?: number;
  tweetUrl?: string;
  detectedAt?: string;
}

export interface MatchedAlert {
  rule: AlertRule;
  trade: DetectedTrade;
  channels: AlertChannel[];
}

// ── Condition Evaluation ─────────────────────────────────────────────────────

/**
 * Extract the relevant field from a trade for a given condition type.
 */
function getTradeField(trade: DetectedTrade, type: AlertCondition["type"]): string | number | undefined {
  switch (type) {
    case "caller":     return trade.callerHandle?.toLowerCase();
    case "ticker":     return trade.ticker?.toUpperCase();
    case "direction":  return trade.direction?.toLowerCase();
    case "platform":   return trade.platform?.toLowerCase();
    case "confidence": return trade.confidence;
    case "tier":       return trade.tier?.toUpperCase();
    default:           return undefined;
  }
}

/**
 * Evaluate a single condition against a trade.
 */
export function evaluateCondition(condition: AlertCondition, trade: DetectedTrade): boolean {
  const field = getTradeField(trade, condition.type);
  if (field === undefined || field === null) return false;

  const { operator, value } = condition;

  switch (operator) {
    case "eq": {
      const normalizedValue = typeof value === "string" ? value.toLowerCase() : value;
      const normalizedField = typeof field === "string" ? field.toLowerCase() : field;
      return normalizedField === normalizedValue;
    }
    case "in": {
      if (!Array.isArray(value)) return false;
      const normalizedField = typeof field === "string" ? field.toLowerCase() : String(field);
      return value.some((v) => String(v).toLowerCase() === normalizedField);
    }
    case "gte": {
      if (typeof field !== "number" || typeof value !== "number") return false;
      return field >= value;
    }
    case "lte": {
      if (typeof field !== "number" || typeof value !== "number") return false;
      return field <= value;
    }
    default:
      return false;
  }
}

/**
 * Check if ALL conditions in a rule match the trade (AND logic).
 */
export function evaluateRule(rule: AlertRule, trade: DetectedTrade): boolean {
  if (!rule.enabled || rule.conditions.length === 0) return false;
  return rule.conditions.every((c) => evaluateCondition(c, trade));
}

// ── Rule Helpers ─────────────────────────────────────────────────────────────

/** Create a new AlertRule object with defaults. */
export function createRuleObject(params: {
  userId: string;
  name: string;
  conditions: AlertCondition[];
  channels: AlertChannel[];
}): AlertRule {
  return {
    id: randomUUID(),
    userId: params.userId,
    name: params.name,
    enabled: true,
    conditions: params.conditions,
    channels: params.channels,
    matchCount: 0,
    lastMatchedAt: null,
    createdAt: new Date().toISOString(),
  };
}

/** Human-readable description of a rule's conditions. */
export function describeRule(rule: AlertRule): string {
  const parts = rule.conditions.map((c) => {
    const val = Array.isArray(c.value) ? c.value.join(", ") : String(c.value);
    switch (c.type) {
      case "caller":     return `@${val} calls`;
      case "ticker":     return `$${val}`;
      case "direction":  return val.toUpperCase();
      case "platform":   return `on ${val}`;
      case "confidence": return `confidence ${c.operator === "gte" ? ">=" : "<="} ${val}%`;
      case "tier":       return `${val} tier`;
      default:           return `${c.type} ${c.operator} ${val}`;
    }
  });
  return parts.join(" + ");
}

// ── Preset Templates ─────────────────────────────────────────────────────────

export interface AlertPreset {
  id: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
}

export const ALERT_PRESETS: AlertPreset[] = [
  {
    id: "s-tier",
    name: "S-Tier Callers Only",
    description: "Any S or A tier caller makes a call",
    conditions: [
      { type: "tier", operator: "in", value: ["S", "A"] },
    ],
  },
  {
    id: "btc-signals",
    name: "BTC Signals",
    description: "Any caller mentions BTC",
    conditions: [
      { type: "ticker", operator: "eq", value: "BTC" },
    ],
  },
  {
    id: "high-confidence",
    name: "High Confidence",
    description: "Calls with 85%+ confidence",
    conditions: [
      { type: "confidence", operator: "gte", value: 0.85 },
    ],
  },
  {
    id: "polymarket",
    name: "Polymarket Events",
    description: "New prediction market calls",
    conditions: [
      { type: "platform", operator: "eq", value: "polymarket" },
    ],
  },
  {
    id: "sol-longs",
    name: "SOL Longs",
    description: "Any caller goes long on SOL",
    conditions: [
      { type: "ticker", operator: "eq", value: "SOL" },
      { type: "direction", operator: "eq", value: "long" },
    ],
  },
  {
    id: "eth-signals",
    name: "ETH Signals",
    description: "Any caller mentions ETH",
    conditions: [
      { type: "ticker", operator: "eq", value: "ETH" },
    ],
  },
];
