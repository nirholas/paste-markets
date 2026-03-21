"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface Notification {
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

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userHandle, setUserHandle] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (handle: string) => {
    try {
      const res = await fetch(`/api/alerts/notifications?user=${encodeURIComponent(handle)}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    const handle = localStorage.getItem("paste_alerts_handle");
    if (handle) {
      setUserHandle(handle);
      fetchNotifications(handle);
      // Poll every 30 seconds
      const interval = setInterval(() => fetchNotifications(handle), 30000);
      return () => clearInterval(interval);
    }
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  async function markAllRead() {
    if (!userHandle) return;
    await fetch("/api/alerts/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userHandle }),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
  }

  if (!userHandle) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && userHandle) fetchNotifications(userHandle);
        }}
        className="relative text-text-muted hover:text-accent transition-colors p-1"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-loss text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-text-primary font-bold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-accent text-xs hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 10).map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-b border-border/50 hover:bg-background/50 transition-colors ${
                    notif.read_at ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read_at && (
                      <span className="w-2 h-2 rounded-full bg-loss flex-shrink-0 mt-1.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        {notif.caller_handle && (
                          <Link
                            href={`/${notif.caller_handle}`}
                            className="text-accent font-bold hover:underline"
                            onClick={() => setOpen(false)}
                          >
                            @{notif.caller_handle}
                          </Link>
                        )}
                        {notif.ticker && (
                          <span className="text-text-primary">
                            {" "}called {notif.direction?.toUpperCase()} ${notif.ticker}
                          </span>
                        )}
                      </div>
                      <div className="text-text-muted text-xs mt-0.5">
                        {formatTime(notif.created_at)}
                      </div>
                    </div>
                    {notif.caller_handle && (
                      <Link
                        href={`/${notif.caller_handle}`}
                        className="text-text-muted hover:text-accent text-xs flex-shrink-0"
                        onClick={() => setOpen(false)}
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-border flex items-center justify-between">
            <Link
              href="/alerts"
              className="text-accent text-xs hover:underline"
              onClick={() => setOpen(false)}
            >
              View All Notifications
            </Link>
            <Link
              href="/alerts"
              className="text-text-muted text-xs hover:text-accent transition-colors"
              onClick={() => setOpen(false)}
            >
              Manage Alerts
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
