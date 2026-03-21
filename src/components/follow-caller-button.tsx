"use client";

import { useState, useEffect } from "react";

interface FollowCallerButtonProps {
  callerHandle: string;
}

export function FollowCallerButton({ callerHandle }: FollowCallerButtonProps) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userHandle, setUserHandle] = useState<string | null>(null);

  useEffect(() => {
    const handle = localStorage.getItem("paste_alerts_handle");
    setUserHandle(handle);

    if (handle) {
      // Check if already following this caller
      fetch(`/api/alerts/rules?user=${encodeURIComponent(handle)}`)
        .then((res) => res.json())
        .then((rules) => {
          const isFollowing = rules.some(
            (r: { conditions: Array<{ type: string; value: string }> }) =>
              r.conditions.some(
                (c) => c.type === "caller" && String(c.value).toLowerCase() === callerHandle.toLowerCase(),
              ),
          );
          setFollowing(isFollowing);
        })
        .catch(() => {});
    }
  }, [callerHandle]);

  async function handleFollow() {
    let handle = userHandle;
    if (!handle) {
      handle = prompt("Enter your Twitter handle to follow callers:");
      if (!handle) return;
      handle = handle.replace(/^@/, "").trim();
      localStorage.setItem("paste_alerts_handle", handle);
      setUserHandle(handle);
    }

    setLoading(true);
    try {
      if (following) {
        // Find and delete the follow rule
        const res = await fetch(`/api/alerts/rules?user=${encodeURIComponent(handle)}`);
        if (res.ok) {
          const rules = await res.json();
          const followRule = rules.find(
            (r: { conditions: Array<{ type: string; value: string }> }) =>
              r.conditions.some(
                (c) => c.type === "caller" && String(c.value).toLowerCase() === callerHandle.toLowerCase(),
              ),
          );
          if (followRule) {
            await fetch(`/api/alerts/rules/${followRule.id}?user=${encodeURIComponent(handle)}`, {
              method: "DELETE",
            });
          }
        }
        setFollowing(false);
      } else {
        // Create a follow rule
        const res = await fetch("/api/alerts/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: handle,
            name: `Follow @${callerHandle}`,
            conditions: [
              { type: "caller", operator: "eq", value: callerHandle.toLowerCase() },
            ],
            channels: [{ type: "browser", config: {} }],
          }),
        });
        if (res.ok) setFollowing(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-colors ${
        following
          ? "border-accent/50 text-accent bg-accent/5 hover:border-loss hover:text-loss hover:bg-loss/5"
          : "border-border text-text-primary hover:border-accent hover:text-accent"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={following ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {loading ? "..." : following ? "Following" : "Follow Calls"}
    </button>
  );
}
