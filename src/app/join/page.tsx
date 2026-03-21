"use client";

import { useState, useEffect, useRef } from "react";
import type { Metadata } from "next";

interface JoinResult {
  handle: string;
  position: number;
  referralCode: string;
  total: number;
  isExisting: boolean;
}

export default function JoinPage() {
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [referralInput, setReferralInput] = useState("");
  const [result, setResult] = useState<JoinResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read referral code from URL on mount + fetch count
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralInput(ref);

    fetch("/api/join")
      .then((r) => r.json())
      .then((d) => setTotalCount(d.total))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          email: email || undefined,
          referredBy: referralInput || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setResult(data);
      setTotalCount(data.total);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const referralLink = result
    ? `https://paste.markets/join?ref=${result.referralCode}`
    : "";

  const tweetText = result
    ? `Just joined the @paste_markets waitlist. Paste a source, AI finds the trade, P&L tracks from there. Get in → ${referralLink}`
    : "";

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {!result ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3 tracking-tight">
              Get early access to paste.markets
            </h1>
            <p className="text-text-secondary text-sm mb-8">
              Drop your Twitter handle. We&apos;ll let you in.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Handle input */}
              <div>
                <label className="block text-[11px] uppercase tracking-[1px] text-text-muted mb-1.5">
                  Twitter Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    @
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                    placeholder="yourhandle"
                    maxLength={15}
                    required
                    className="w-full bg-surface border border-border rounded-lg px-3 pl-7 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-win focus:ring-1 focus:ring-win/30 transition"
                  />
                </div>
              </div>

              {/* Email input */}
              <div>
                <label className="block text-[11px] uppercase tracking-[1px] text-text-muted mb-1.5">
                  Email <span className="text-text-muted/50">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-win focus:ring-1 focus:ring-win/30 transition"
                />
              </div>

              {/* Referral code */}
              <div>
                <label className="block text-[11px] uppercase tracking-[1px] text-text-muted mb-1.5">
                  Referral Code <span className="text-text-muted/50">(optional)</span>
                </label>
                <input
                  type="text"
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value)}
                  placeholder="ABC12345"
                  maxLength={8}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-win focus:ring-1 focus:ring-win/30 transition"
                />
              </div>

              {error && (
                <p className="text-loss text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !handle}
                className="w-full bg-win/10 border border-win text-win font-bold py-2.5 rounded-lg text-sm hover:bg-win/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Joining..." : "Join Waitlist"}
              </button>
            </form>

            {totalCount > 0 && (
              <p className="text-center text-text-muted text-xs mt-6">
                <span className="text-text-secondary font-bold tabular-nums">
                  {totalCount.toLocaleString()}
                </span>{" "}
                traders waiting
              </p>
            )}
          </>
        ) : (
          <div className="animate-slide-up">
            <p className="text-text-muted text-xs uppercase tracking-[1px] mb-2">
              {result.isExisting ? "Already on the list" : "You're in"}
            </p>

            <div className="mb-6">
              <span className="text-[11px] uppercase tracking-[1px] text-text-muted block mb-1">
                Your position
              </span>
              <span className="text-5xl md:text-6xl font-bold text-win tabular-nums">
                #{result.position.toLocaleString()}
              </span>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4 mb-6">
              <p className="text-[11px] uppercase tracking-[1px] text-text-muted mb-2">
                Your referral code
              </p>
              <p className="text-lg font-bold text-text-primary tracking-widest mb-3">
                {result.referralCode}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyReferralLink}
                  className="flex-1 border border-border text-text-secondary text-xs py-2 rounded hover:border-accent hover:text-accent transition"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-accent/10 border border-accent text-accent text-xs py-2 rounded text-center hover:bg-accent/20 transition"
                >
                  Share to Move Up
                </a>
              </div>
            </div>

            <p className="text-text-muted text-xs text-center">
              <span className="text-text-secondary font-bold tabular-nums">
                {result.total.toLocaleString()}
              </span>{" "}
              traders waiting &middot; every referral bumps you up
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
