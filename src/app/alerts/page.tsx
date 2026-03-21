"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface AlertCondition {
  type: "caller" | "ticker" | "direction" | "platform" | "confidence" | "tier";
  operator: "eq" | "in" | "gte" | "lte";
  value: string | string[] | number;
}

interface AlertChannel {
  type: "browser" | "telegram" | "webhook";
  config: Record<string, string>;
}

interface AlertRule {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  channels: AlertChannel[];
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
}

interface AlertNotification {
  id: string;
  rule_id: string;
  caller_handle: string | null;
  ticker: string | null;
  direction: string | null;
  message: string;
  channel: string;
  read_at: string | null;
  created_at: string;
}

interface TestResult {
  ruleName: string;
  totalTested: number;
  matchCount: number;
  matches: Array<{
    caller: string;
    ticker: string;
    direction: string;
    platform?: string;
    confidence?: number;
    tier?: string;
  }>;
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: "s-tier",
    name: "S-Tier Callers Only",
    description: "Any S or A tier caller makes a call",
    conditions: [{ type: "tier" as const, operator: "in" as const, value: ["S", "A"] }],
  },
  {
    id: "btc-signals",
    name: "BTC Signals",
    description: "Any caller mentions BTC",
    conditions: [{ type: "ticker" as const, operator: "eq" as const, value: "BTC" }],
  },
  {
    id: "high-confidence",
    name: "High Confidence",
    description: "Calls with 85%+ confidence",
    conditions: [{ type: "confidence" as const, operator: "gte" as const, value: 0.85 }],
  },
  {
    id: "polymarket",
    name: "Polymarket Events",
    description: "New prediction market calls",
    conditions: [{ type: "platform" as const, operator: "eq" as const, value: "polymarket" }],
  },
  {
    id: "sol-longs",
    name: "SOL Longs",
    description: "Any caller goes long on SOL",
    conditions: [
      { type: "ticker" as const, operator: "eq" as const, value: "SOL" },
      { type: "direction" as const, operator: "eq" as const, value: "long" },
    ],
  },
  {
    id: "eth-signals",
    name: "ETH Signals",
    description: "Any caller mentions ETH",
    conditions: [{ type: "ticker" as const, operator: "eq" as const, value: "ETH" }],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONDITION_TYPES = [
  { value: "caller", label: "Caller" },
  { value: "ticker", label: "Ticker" },
  { value: "direction", label: "Direction" },
  { value: "platform", label: "Platform" },
  { value: "confidence", label: "Confidence" },
  { value: "tier", label: "Tier" },
];

const OPERATORS: Record<string, Array<{ value: string; label: string }>> = {
  caller: [{ value: "eq", label: "equals" }],
  ticker: [{ value: "eq", label: "equals" }, { value: "in", label: "is one of" }],
  direction: [{ value: "eq", label: "equals" }],
  platform: [{ value: "eq", label: "equals" }],
  confidence: [{ value: "gte", label: ">=" }, { value: "lte", label: "<=" }],
  tier: [{ value: "eq", label: "equals" }, { value: "in", label: "is one of" }],
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function describeCondition(c: AlertCondition): string {
  const val = Array.isArray(c.value) ? c.value.join(", ") : String(c.value);
  switch (c.type) {
    case "caller": return `@${val}`;
    case "ticker": return `$${val.toUpperCase()}`;
    case "direction": return val.toUpperCase();
    case "platform": return `on ${val}`;
    case "confidence": return `confidence ${c.operator === "gte" ? ">=" : "<="} ${typeof c.value === "number" ? Math.round(c.value * 100) : c.value}%`;
    case "tier": return `${val} tier`;
    default: return `${c.type} ${c.operator} ${val}`;
  }
}

function describeRule(rule: AlertRule): string {
  return rule.conditions.map(describeCondition).join(" + ");
}

// ── Components ───────────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ConditionBuilder({
  conditions,
  onChange,
}: {
  conditions: AlertCondition[];
  onChange: (conditions: AlertCondition[]) => void;
}) {
  function updateCondition(index: number, updates: Partial<AlertCondition>) {
    const next = [...conditions];
    next[index] = { ...next[index], ...updates };
    // Reset value when type changes
    if (updates.type) {
      const newOps = OPERATORS[updates.type] ?? [];
      next[index].operator = (newOps[0]?.value ?? "eq") as AlertCondition["operator"];
      next[index].value = "";
    }
    onChange(next);
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  function addCondition() {
    onChange([...conditions, { type: "caller", operator: "eq", value: "" }]);
  }

  return (
    <div className="space-y-3">
      {conditions.map((c, i) => (
        <div key={i}>
          {i > 0 && (
            <div className="text-text-muted text-xs uppercase tracking-widest mb-2 ml-1">AND</div>
          )}
          <div className="flex items-center gap-2 bg-[#0a0a1a] border border-border rounded-lg p-3">
            <select
              value={c.type}
              onChange={(e) => updateCondition(i, { type: e.target.value as AlertCondition["type"] })}
              className="bg-surface border border-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent"
            >
              {CONDITION_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>

            <select
              value={c.operator}
              onChange={(e) => updateCondition(i, { operator: e.target.value as AlertCondition["operator"] })}
              className="bg-surface border border-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent"
            >
              {(OPERATORS[c.type] ?? []).map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>

            <input
              type={c.type === "confidence" ? "number" : "text"}
              value={Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}
              onChange={(e) => {
                const raw = e.target.value;
                let val: string | string[] | number = raw;
                if (c.operator === "in") {
                  val = raw.split(",").map((s) => s.trim()).filter(Boolean);
                } else if (c.type === "confidence") {
                  val = parseFloat(raw) || 0;
                }
                updateCondition(i, { value: val });
              }}
              placeholder={
                c.type === "caller" ? "frankdegods" :
                c.type === "ticker" ? "BTC" :
                c.type === "direction" ? "long" :
                c.type === "platform" ? "polymarket" :
                c.type === "confidence" ? "0.85" :
                "S, A"
              }
              step={c.type === "confidence" ? "0.01" : undefined}
              className="flex-1 bg-surface border border-border rounded px-3 py-1.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent min-w-0"
            />

            {conditions.length > 1 && (
              <button
                onClick={() => removeCondition(i)}
                className="text-text-muted hover:text-loss transition-colors flex-shrink-0 p-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={addCondition}
        className="text-accent text-sm hover:text-accent/80 transition-colors"
      >
        + Add Condition
      </button>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [userHandle, setUserHandle] = useState("");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [conditions, setConditions] = useState<AlertCondition[]>([
    { type: "caller", operator: "eq", value: "" },
  ]);
  const [browserChannel, setBrowserChannel] = useState(true);
  const [telegramChannel, setTelegramChannel] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [webhookChannel, setWebhookChannel] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // Test result
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const loadData = useCallback(async (handle: string) => {
    if (!handle) return;
    setLoading(true);
    try {
      const [rulesRes, notifsRes] = await Promise.all([
        fetch(`/api/alerts/rules?user=${encodeURIComponent(handle)}`),
        fetch(`/api/alerts/notifications?user=${encodeURIComponent(handle)}&all=1`),
      ]);
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (notifsRes.ok) {
        const data = await notifsRes.json();
        setNotifications(data.notifications ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("paste_alerts_handle");
    if (stored) {
      setUserHandle(stored);
      loadData(stored);
    }
  }, [loadData]);

  function saveHandle(handle: string) {
    setUserHandle(handle);
    localStorage.setItem("paste_alerts_handle", handle);
    loadData(handle);
  }

  function buildChannels(): AlertChannel[] {
    const channels: AlertChannel[] = [];
    if (browserChannel) channels.push({ type: "browser", config: {} });
    if (telegramChannel && telegramChatId) channels.push({ type: "telegram", config: { chatId: telegramChatId } });
    if (webhookChannel && webhookUrl) channels.push({ type: "webhook", config: { webhookUrl } });
    if (channels.length === 0) channels.push({ type: "browser", config: {} });
    return channels;
  }

  async function handleCreate() {
    if (!ruleName || !userHandle) return;
    const validConditions = conditions.filter((c) => {
      if (Array.isArray(c.value)) return c.value.length > 0;
      return c.value !== "" && c.value !== 0;
    });
    if (validConditions.length === 0) return;

    setCreating(true);
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userHandle,
          name: ruleName,
          conditions: validConditions,
          channels: buildChannels(),
        }),
      });
      if (res.ok) {
        setRuleName("");
        setConditions([{ type: "caller", operator: "eq", value: "" }]);
        setBrowserChannel(true);
        setTelegramChannel(false);
        setTelegramChatId("");
        setWebhookChannel(false);
        setWebhookUrl("");
        setShowCreate(false);
        loadData(userHandle);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handlePreset(preset: typeof PRESETS[number]) {
    if (!userHandle) return;
    setCreating(true);
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userHandle,
          name: preset.name,
          conditions: preset.conditions,
          channels: [{ type: "browser", config: {} }],
        }),
      });
      if (res.ok) loadData(userHandle);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(ruleId: string) {
    await fetch(`/api/alerts/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userHandle, action: "toggle" }),
    });
    loadData(userHandle);
  }

  async function handleDelete(ruleId: string) {
    await fetch(`/api/alerts/rules/${ruleId}?user=${encodeURIComponent(userHandle)}`, {
      method: "DELETE",
    });
    loadData(userHandle);
  }

  async function handleTest(ruleId: string) {
    setTesting(ruleId);
    setTestResult(null);
    try {
      const res = await fetch(`/api/alerts/test/${ruleId}`);
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } finally {
      setTesting(null);
    }
  }

  return (
    <main className="min-h-screen px-4 py-12 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <BellIcon />
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary">
          Signal Alerts
        </h1>
      </div>
      <p className="text-text-secondary mb-8">
        Set up personalized rules to get notified when matching trade signals appear.
        Follow callers, tickers, or strategies.
      </p>

      {/* Handle input */}
      {!userHandle ? (
        <div className="bg-surface border border-border rounded-lg p-6 mb-8">
          <label className="text-text-muted text-xs uppercase tracking-widest block mb-3">
            Your handle
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.target as HTMLFormElement).elements.namedItem("handle") as HTMLInputElement;
              if (input.value.trim()) saveHandle(input.value.trim().replace(/^@/, ""));
            }}
            className="flex gap-3"
          >
            <input
              name="handle"
              type="text"
              placeholder="your twitter handle"
              className="flex-1 bg-background border border-border rounded px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <button
              type="submit"
              className="px-6 py-2.5 border border-border rounded hover:border-accent text-text-primary transition-colors"
            >
              Continue
            </button>
          </form>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-8">
          <span className="text-text-muted text-sm">Alerts for</span>
          <span className="text-accent font-bold">@{userHandle}</span>
          <button
            onClick={() => {
              setUserHandle("");
              setRules([]);
              setNotifications([]);
              localStorage.removeItem("paste_alerts_handle");
            }}
            className="text-text-muted text-xs hover:text-loss transition-colors ml-2"
          >
            change
          </button>
        </div>
      )}

      {userHandle && (
        <>
          {/* ── Your Signal Alerts ──────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary">Your Signal Alerts</h2>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="px-4 py-2 bg-accent text-white rounded font-bold text-sm hover:bg-accent/80 transition-colors"
              >
                + Create New Alert
              </button>
            </div>

            {loading ? (
              <p className="text-text-muted">Loading...</p>
            ) : rules.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg p-8 text-center">
                <p className="text-text-muted mb-4">No signal alerts yet. Create one or pick a preset below.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`bg-surface border border-border rounded-lg p-5 transition-opacity ${
                      rule.enabled ? "" : "opacity-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-text-primary font-bold">{rule.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            rule.enabled
                              ? "bg-win/10 text-win border border-win/20"
                              : "bg-text-muted/10 text-text-muted border border-text-muted/20"
                          }`}>
                            {rule.enabled ? "ON" : "OFF"}
                          </span>
                        </div>
                        <p className="text-text-secondary text-sm mb-2">
                          When {describeRule(rule)}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-text-muted">
                          <span>Via: {rule.channels.map((c) => c.type).join(", ")}</span>
                          <span>Matched {rule.matchCount} times</span>
                          {rule.lastMatchedAt && (
                            <span>Last: {formatDate(rule.lastMatchedAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleTest(rule.id)}
                          disabled={testing === rule.id}
                          className="text-text-muted hover:text-accent text-xs transition-colors px-2 py-1 border border-border rounded hover:border-accent/50"
                        >
                          {testing === rule.id ? "Testing..." : "Test"}
                        </button>
                        <button
                          onClick={() => handleToggle(rule.id)}
                          className="text-text-muted hover:text-accent text-xs transition-colors px-2 py-1 border border-border rounded hover:border-accent/50"
                        >
                          {rule.enabled ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="text-text-muted hover:text-loss text-xs transition-colors px-2 py-1 border border-border rounded hover:border-loss/50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Test Result ─────────────────────────────────────────── */}
          {testResult && (
            <div className="bg-surface border border-accent/30 rounded-lg p-5 mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-text-primary font-bold">
                  Test: &quot;{testResult.ruleName}&quot;
                </h3>
                <button
                  onClick={() => setTestResult(null)}
                  className="text-text-muted hover:text-text-primary text-xs"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-text-secondary text-sm mb-3">
                Tested against {testResult.totalTested} recent trades.{" "}
                <span className="text-accent font-bold">{testResult.matchCount} matches</span> found.
              </p>
              {testResult.matches.length > 0 && (
                <div className="space-y-1">
                  {testResult.matches.slice(0, 10).map((m, i) => (
                    <div key={i} className="text-sm text-text-secondary">
                      <Link href={`/${m.caller}`} className="text-accent hover:underline">@{m.caller}</Link>
                      {" "}{m.direction.toUpperCase()} ${m.ticker}
                      {m.confidence != null && ` (${Math.round(m.confidence * 100)}%)`}
                      {m.tier && ` [${m.tier}]`}
                    </div>
                  ))}
                  {testResult.matchCount > 10 && (
                    <p className="text-text-muted text-xs">...and {testResult.matchCount - 10} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Create Alert Form ──────────────────────────────────── */}
          {showCreate && (
            <div className="bg-surface border border-accent/30 rounded-lg p-6 mb-8">
              <h3 className="text-text-primary font-bold text-lg mb-4">Create Alert</h3>

              <div className="mb-4">
                <label className="text-text-muted text-xs uppercase tracking-widest block mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Frank's BTC calls"
                  className="w-full bg-background border border-border rounded px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="mb-4">
                <label className="text-text-muted text-xs uppercase tracking-widest block mb-2">
                  When
                </label>
                <ConditionBuilder conditions={conditions} onChange={setConditions} />
              </div>

              <div className="mb-6">
                <label className="text-text-muted text-xs uppercase tracking-widest block mb-2">
                  Notify via
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={browserChannel}
                      onChange={(e) => setBrowserChannel(e.target.checked)}
                      className="accent-accent"
                    />
                    <span className="text-text-primary text-sm">Browser notifications</span>
                  </label>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={telegramChannel}
                        onChange={(e) => setTelegramChannel(e.target.checked)}
                        className="accent-accent"
                      />
                      <span className="text-text-primary text-sm">Telegram (@paste_markets_bot)</span>
                    </label>
                    {telegramChannel && (
                      <input
                        type="text"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        placeholder="Telegram Chat ID"
                        className="mt-2 ml-7 bg-background border border-border rounded px-3 py-1.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhookChannel}
                        onChange={(e) => setWebhookChannel(e.target.checked)}
                        className="accent-accent"
                      />
                      <span className="text-text-primary text-sm">Webhook URL</span>
                    </label>
                    {webhookChannel && (
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://your-server.com/webhook"
                        className="mt-2 ml-7 w-80 bg-background border border-border rounded px-3 py-1.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={!ruleName || creating}
                  className="px-6 py-2.5 bg-accent text-white rounded font-bold hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Saving..." : "Save Alert"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-6 py-2.5 border border-border rounded text-text-secondary hover:border-accent/50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Popular Alert Templates ─────────────────────────────── */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-text-primary mb-4">Popular Alert Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePreset(preset)}
                  disabled={creating}
                  className="bg-surface border border-border rounded-lg p-4 text-left hover:border-accent/50 transition-colors group"
                >
                  <h3 className="text-text-primary font-bold text-sm mb-1 group-hover:text-accent transition-colors">
                    {preset.name}
                  </h3>
                  <p className="text-text-muted text-xs">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Recent Notifications ────────────────────────────────── */}
          {notifications.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-text-primary mb-4">Recent Notifications</h2>
              <div className="space-y-2">
                {notifications.slice(0, 20).map((notif) => (
                  <div
                    key={notif.id}
                    className={`bg-surface border border-border rounded-lg px-5 py-4 flex items-center gap-4 ${
                      notif.read_at ? "opacity-60" : ""
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      notif.read_at ? "bg-text-muted" : "bg-loss"
                    }`} />
                    <div className="flex-1 min-w-0">
                      {notif.caller_handle && (
                        <Link
                          href={`/${notif.caller_handle}`}
                          className="text-accent font-bold hover:underline"
                        >
                          @{notif.caller_handle}
                        </Link>
                      )}
                      {notif.ticker && (
                        <span className="text-text-primary ml-2">
                          {notif.direction?.toUpperCase()} ${notif.ticker}
                        </span>
                      )}
                      <span className="text-text-secondary text-sm ml-2">
                        {notif.message}
                      </span>
                    </div>
                    <span className="text-text-muted text-xs flex-shrink-0">
                      via {notif.channel}
                    </span>
                    <span className="text-text-muted text-xs flex-shrink-0">
                      {formatDate(notif.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
