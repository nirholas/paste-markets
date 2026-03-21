"use client";

import { useState, useEffect, useCallback } from "react";

interface Alert {
  id: number;
  user_handle: string;
  alert_type: "caller" | "ticker" | "consensus";
  target: string;
  threshold_pnl: number | null;
  channel: string;
  active: number;
  created_at: string;
}

interface TriggeredAlert {
  alert_id: number;
  alert_type: string;
  target: string;
  trade_handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  posted_at: string | null;
  reason: string;
}

const CHANNELS = [
  { id: "web", label: "Web", icon: "globe", available: true },
  { id: "email", label: "Email", icon: "envelope", available: false },
  { id: "telegram", label: "Telegram", icon: "plane", available: false },
  { id: "webhook", label: "Webhook", icon: "link", available: false },
];

function ChannelIcon({ type }: { type: string }) {
  switch (type) {
    case "globe":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "envelope":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case "plane":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m22 2-7 20-4-9-9-4z" />
          <path d="m22 2-11 11" />
        </svg>
      );
    case "link":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    default:
      return null;
  }
}

function AlertTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "caller":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "ticker":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case "consensus":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return null;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AlertsPage() {
  const [userHandle, setUserHandle] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [feed, setFeed] = useState<TriggeredAlert[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [activeType, setActiveType] = useState<"caller" | "ticker" | "consensus" | null>(null);
  const [target, setTarget] = useState("");
  const [thresholdPnl, setThresholdPnl] = useState("");
  const [channel, setChannel] = useState("web");
  const [creating, setCreating] = useState(false);

  const loadAlerts = useCallback(async (handle: string) => {
    if (!handle) return;
    setLoading(true);
    try {
      const [alertsRes, feedRes] = await Promise.all([
        fetch(`/api/alerts?user=${encodeURIComponent(handle)}`),
        fetch(`/api/alerts/feed?user=${encodeURIComponent(handle)}`),
      ]);
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (feedRes.ok) setFeed(await feedRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("paste_alerts_handle");
    if (stored) {
      setUserHandle(stored);
      loadAlerts(stored);
    }
  }, [loadAlerts]);

  function saveHandle(handle: string) {
    setUserHandle(handle);
    localStorage.setItem("paste_alerts_handle", handle);
    loadAlerts(handle);
  }

  async function handleCreate() {
    if (!activeType || !target || !userHandle) return;
    setCreating(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_handle: userHandle,
          alert_type: activeType,
          target,
          threshold_pnl: thresholdPnl ? parseFloat(thresholdPnl) : null,
          channel,
        }),
      });
      if (res.ok) {
        setTarget("");
        setThresholdPnl("");
        setActiveType(null);
        loadAlerts(userHandle);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/alerts?id=${id}&user=${encodeURIComponent(userHandle)}`, {
      method: "DELETE",
    });
    loadAlerts(userHandle);
  }

  async function handleToggle(id: number) {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, user_handle: userHandle }),
    });
    loadAlerts(userHandle);
  }

  const alertTypes = [
    {
      type: "caller" as const,
      title: "Caller Alert",
      description: "Follow a caller",
      placeholder: "e.g. frankdegods",
      prefix: "@",
    },
    {
      type: "ticker" as const,
      title: "Ticker Alert",
      description: "Watch a ticker",
      placeholder: "e.g. SOL",
      prefix: "$",
    },
    {
      type: "consensus" as const,
      title: "Consensus Alert",
      description: "When X+ callers agree",
      placeholder: "e.g. 3",
      prefix: "",
    },
  ];

  return (
    <main className="min-h-screen px-4 py-12 max-w-4xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">
        Set up alerts
      </h1>
      <p className="text-text-secondary mb-8">
        Get notified when your followed callers make trades or tickers move.
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
              setAlerts([]);
              setFeed([]);
              localStorage.removeItem("paste_alerts_handle");
            }}
            className="text-text-muted text-xs hover:text-loss transition-colors ml-2"
          >
            change
          </button>
        </div>
      )}

      {/* Alert type cards */}
      {userHandle && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {alertTypes.map((at) => (
              <button
                key={at.type}
                onClick={() => setActiveType(activeType === at.type ? null : at.type)}
                className={`bg-surface border rounded-lg p-6 text-left transition-colors ${
                  activeType === at.type
                    ? "border-accent"
                    : "border-border hover:border-accent/50"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className={activeType === at.type ? "text-accent" : "text-text-muted"}>
                    <AlertTypeIcon type={at.type} />
                  </span>
                  <h3 className="text-text-primary font-bold">{at.title}</h3>
                </div>
                <p className="text-text-secondary text-sm">{at.description}</p>
              </button>
            ))}
          </div>

          {/* Create alert form */}
          {activeType && (
            <div className="bg-surface border border-accent/30 rounded-lg p-6 mb-8">
              <h3 className="text-text-primary font-bold mb-4">
                New {alertTypes.find((a) => a.type === activeType)?.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-widest block mb-2">
                    {activeType === "consensus" ? "Minimum callers" : "Target"}
                  </label>
                  <div className="flex items-center bg-background border border-border rounded overflow-hidden focus-within:border-accent transition-colors">
                    {alertTypes.find((a) => a.type === activeType)?.prefix && (
                      <span className="text-text-muted pl-3">
                        {alertTypes.find((a) => a.type === activeType)?.prefix}
                      </span>
                    )}
                    <input
                      type="text"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder={alertTypes.find((a) => a.type === activeType)?.placeholder}
                      className="flex-1 bg-transparent px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-widest block mb-2">
                    Min P&L threshold (optional)
                  </label>
                  <div className="flex items-center bg-background border border-border rounded overflow-hidden focus-within:border-accent transition-colors">
                    <input
                      type="number"
                      value={thresholdPnl}
                      onChange={(e) => setThresholdPnl(e.target.value)}
                      placeholder="e.g. 10"
                      step="0.1"
                      className="flex-1 bg-transparent px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                    <span className="text-text-muted pr-3">%</span>
                  </div>
                </div>
              </div>

              {/* Channel selector */}
              <div className="mb-4">
                <label className="text-text-muted text-xs uppercase tracking-widest block mb-2">
                  Channel
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CHANNELS.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => ch.available && setChannel(ch.id)}
                      disabled={!ch.available}
                      className={`flex items-center gap-2 px-4 py-2 rounded border text-sm transition-colors ${
                        channel === ch.id
                          ? "border-accent text-accent"
                          : ch.available
                            ? "border-border text-text-secondary hover:border-accent/50"
                            : "border-border/50 text-text-muted/50 cursor-not-allowed"
                      }`}
                    >
                      <ChannelIcon type={ch.icon} />
                      {ch.label}
                      {!ch.available && (
                        <span className="text-[10px] uppercase tracking-wider border border-amber rounded px-1.5 py-0.5 text-amber ml-1">
                          Soon
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={!target || creating}
                className="px-6 py-2.5 bg-accent text-white rounded font-bold hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create Alert"}
              </button>
            </div>
          )}

          {/* Active alerts */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-text-primary mb-4">Your Alerts</h2>
            {loading ? (
              <p className="text-text-muted">Loading...</p>
            ) : alerts.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg p-8 text-center">
                <p className="text-text-muted">No alerts yet. Create one above to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`bg-surface border border-border rounded-lg px-5 py-4 flex items-center gap-4 transition-opacity ${
                      alert.active ? "" : "opacity-50"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.active ? "bg-win" : "bg-text-muted"}`} />
                    <span className="text-text-muted flex-shrink-0">
                      <AlertTypeIcon type={alert.alert_type} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-text-primary font-bold">
                        {alert.alert_type === "caller" && `@${alert.target}`}
                        {alert.alert_type === "ticker" && `$${alert.target.toUpperCase()}`}
                        {alert.alert_type === "consensus" && `${alert.target}+ callers agree`}
                      </span>
                      {alert.threshold_pnl != null && (
                        <span className="text-text-muted text-sm ml-2">
                          P&L &gt; {alert.threshold_pnl}%
                        </span>
                      )}
                      <span className="text-text-muted text-xs ml-3">
                        via {alert.channel}
                      </span>
                    </div>
                    <span className="text-text-muted text-xs flex-shrink-0">
                      {formatDate(alert.created_at)}
                    </span>
                    <button
                      onClick={() => handleToggle(alert.id)}
                      className="text-text-muted hover:text-accent text-xs transition-colors flex-shrink-0"
                    >
                      {alert.active ? "pause" : "resume"}
                    </button>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="text-text-muted hover:text-loss text-xs transition-colors flex-shrink-0"
                    >
                      delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert feed */}
          {feed.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-text-primary mb-4">Recent Triggers</h2>
              <div className="space-y-2">
                {feed.map((item, i) => (
                  <div
                    key={`${item.alert_id}-${item.ticker}-${item.posted_at}-${i}`}
                    className="bg-surface border border-border rounded-lg px-5 py-4 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-text-primary font-bold">
                        @{item.trade_handle}
                      </span>
                      <span className="text-text-muted mx-2">called</span>
                      <span className="text-text-primary">
                        ${item.ticker}
                      </span>
                      <span className="text-text-muted ml-1">
                        {item.direction}
                      </span>
                      {item.pnl_pct != null && (
                        <span className={`ml-2 font-bold ${item.pnl_pct >= 0 ? "text-win" : "text-loss"}`}>
                          {item.pnl_pct >= 0 ? "+" : ""}{item.pnl_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <span className="text-text-muted text-xs flex-shrink-0">
                      {item.reason}
                    </span>
                    <span className="text-text-muted text-xs flex-shrink-0">
                      {formatDate(item.posted_at)}
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
