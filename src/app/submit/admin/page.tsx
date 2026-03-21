"use client";

import { useState, useEffect, useCallback } from "react";
import Nav from "@/components/ui/nav";

interface Submission {
  id: number;
  caller_handle: string;
  submitted_by: string | null;
  reason: string | null;
  example_tweet_url: string | null;
  upvotes: number;
  status: string;
  created_at: string;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "tracked";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: "rgba(243, 156, 18, 0.1)", text: "#f39c12", border: "#f39c12" },
    approved: { bg: "rgba(46, 204, 113, 0.1)", text: "#2ecc71", border: "#2ecc71" },
    tracked: { bg: "rgba(46, 204, 113, 0.15)", text: "#2ecc71", border: "#2ecc71" },
    rejected: { bg: "rgba(231, 76, 60, 0.1)", text: "#e74c3c", border: "#e74c3c" },
  };
  const c = colors[status] ?? colors.pending!;
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-bold"
      style={{ background: c!.bg, color: c!.text, border: `1px solid ${c!.border}` }}
    >
      {status === "tracked" ? "Now Tracking" : status}
    </span>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filter === "all"
          ? "/api/nominate?sort=upvotes&limit=100"
          : `/api/nominate?status=${filter}&limit=100`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) setSubmissions(data.submissions);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (authenticated) fetchSubmissions();
  }, [authenticated, fetchSubmissions]);

  async function handleAction(id: number, status: string) {
    setActionLoading(id);
    try {
      const res = await fetch("/api/nominate/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status } : s)),
        );
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen">
        <Nav />
        <section className="flex flex-col items-center px-4 pt-32">
          <h1 className="text-2xl font-bold text-text-primary mb-8 font-mono">
            Admin Access
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (adminKey.trim()) setAuthenticated(true);
            }}
            className="w-full max-w-sm space-y-4"
          >
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Admin key"
              className="bg-surface border border-border text-text-primary rounded px-4 py-3 w-full font-mono text-sm focus:border-accent outline-none placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={!adminKey.trim()}
              className="w-full bg-accent text-white px-6 py-3 rounded hover:bg-blue-500 transition font-mono text-sm font-bold disabled:opacity-50"
            >
              Enter
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav />

      <section className="max-w-4xl mx-auto px-4 pt-12 pb-20">
        <h1 className="text-2xl font-bold text-text-primary mb-2 font-mono">
          Nomination Admin
        </h1>
        <p className="text-text-muted text-xs uppercase tracking-widest font-mono mb-8">
          Review and manage caller nominations
        </p>

        {/* Filters */}
        <div className="flex gap-2 mb-6 font-mono">
          {(["all", "pending", "approved", "rejected", "tracked"] as StatusFilter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider transition ${
                  filter === f
                    ? "bg-accent text-white"
                    : "border border-border text-text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {f}
              </button>
            ),
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-lg p-4 animate-pulse h-20"
              />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center font-mono">
            <p className="text-text-muted text-sm">No submissions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="bg-surface border border-border rounded-lg p-4 font-mono"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-text-primary text-sm font-bold">
                        @{s.caller_handle}
                      </span>
                      <StatusBadge status={s.status} />
                      <span className="text-text-muted text-xs">
                        {s.upvotes} upvote{s.upvotes !== 1 ? "s" : ""}
                      </span>
                      {s.submitted_by && (
                        <span className="text-text-muted text-xs">
                          submitted by @{s.submitted_by}
                        </span>
                      )}
                    </div>
                    {s.reason && (
                      <p className="text-text-secondary text-xs mt-1">
                        {s.reason}
                      </p>
                    )}
                    {s.example_tweet_url && (
                      <a
                        href={s.example_tweet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent text-xs hover:underline mt-1 inline-block"
                      >
                        View example tweet
                      </a>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    {s.status !== "approved" && s.status !== "tracked" && (
                      <button
                        onClick={() => handleAction(s.id, "approved")}
                        disabled={actionLoading === s.id}
                        className="border border-win text-win px-3 py-1 rounded text-xs font-bold hover:bg-win hover:text-white transition disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    {s.status === "approved" && (
                      <button
                        onClick={() => handleAction(s.id, "tracked")}
                        disabled={actionLoading === s.id}
                        className="border border-win text-win px-3 py-1 rounded text-xs font-bold hover:bg-win hover:text-white transition disabled:opacity-50"
                      >
                        Mark Tracked
                      </button>
                    )}
                    {s.status !== "rejected" && (
                      <button
                        onClick={() => handleAction(s.id, "rejected")}
                        disabled={actionLoading === s.id}
                        className="border border-loss/50 text-loss/50 px-3 py-1 rounded text-xs font-bold hover:bg-loss hover:text-white transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                    {(s.status === "rejected" || s.status === "tracked") && (
                      <button
                        onClick={() => handleAction(s.id, "pending")}
                        disabled={actionLoading === s.id}
                        className="border border-border text-text-muted px-3 py-1 rounded text-xs font-bold hover:border-accent hover:text-accent transition disabled:opacity-50"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
