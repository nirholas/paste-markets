import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Learn how paste.markets works — leaderboard, author profiles, head-to-head comparisons, CT Wrapped, and more.",
  openGraph: {
    title: "paste.markets Docs",
    description: "How to use paste.markets — every feature explained.",
  },
};

const SECTIONS = [
  {
    id: "overview",
    title: "OVERVIEW",
    content: `paste.markets is a real-time leaderboard and analytics platform for Crypto Twitter traders. All data is sourced from paste.trade — an independent service that tracks real trade calls made publicly on X (Twitter) and measures their actual P&L outcomes.

No self-reported numbers. No fake wins. Just verified call history and real performance metrics.`,
  },
  {
    id: "data",
    title: "DATA & METHODOLOGY",
    content: `Trade data is fetched from the paste.trade API. Every trade entry represents a public call made on X, with the entry price, direction, and outcome tracked automatically.

Metrics:
  WIN RATE    — percentage of calls that closed in profit
  AVG P&L     — average percentage return across all closed trades
  TOTAL TRADES — number of tracked calls

Timeframes: 7d / 30d / all-time. All leaderboard rankings default to 30-day performance.

Data updates continuously as paste.trade processes new calls.`,
  },
  {
    id: "leaderboard",
    title: "LEADERBOARD",
    href: "/leaderboard",
    content: `The leaderboard ranks CT traders by win rate and avg P&L over a selected timeframe. Traders are listed publicly — if you've made calls on X and paste.trade has tracked them, you appear here.

Filters:
  7D / 30D / ALL   — select timeframe
  Sort by win rate or avg P&L

Each row links to the trader's full profile page.`,
  },
  {
    id: "profiles",
    title: "AUTHOR PROFILES",
    content: `Every tracked trader has a profile at paste.markets/[handle].

Profile pages include:
  — Scorecard with win rate, avg P&L, total trades
  — Full trade history with individual call outcomes
  — Platform breakdown (crypto, stocks, prediction markets)
  — Shareable OG image for Twitter/X cards

Example: paste.markets/frankdegods`,
  },
  {
    id: "head-to-head",
    title: "HEAD-TO-HEAD",
    href: "/vs",
    content: `Compare any two CT traders directly — win rate, avg P&L, total trades, and a head-to-head record side by side.

Navigate to /vs/[handle1]/[handle2] or use the VS tool at /vs to search and compare.

The comparison generates a shareable OG image optimized for Twitter cards.`,
  },
  {
    id: "wrapped",
    title: "CT WRAPPED",
    href: "/wrapped",
    content: `A Spotify Wrapped-style trading report card for any CT caller.

Enter a handle at /wrapped to generate a shareable card showing:
  — Trading personality archetype
  — Win rate and P&L summary
  — Best and worst calls
  — Performance tier badge

Designed to be screenshot and posted on X.`,
  },
  {
    id: "circle",
    title: "CT CALLER CIRCLE",
    href: "/circle",
    content: `Generate a "Twitter Circle"-style graphic featuring the top CT callers on your custom list.

Choose traders, set a title, and export a shareable image showing their handles and performance stats in a grid layout.

Navigate to /circle to create your circle.`,
  },
  {
    id: "trade",
    title: "WHAT'S THE TRADE?",
    href: "/trade",
    content: `Paste any news URL or headline and get an AI-generated trade thesis.

Powered by Claude (Anthropic). The tool reads the article, identifies the market-moving signal, and suggests the optimal trade direction, ticker, and timeframe with reasoning.

Navigate to /trade to use it.`,
  },
  {
    id: "feed",
    title: "LIVE FEED",
    href: "/feed",
    content: `A real-time stream of new trade calls being tracked across all monitored CT accounts.

Shows:
  — Trader handle
  — Ticker and direction (long/short)
  — Time of call
  — Platform (crypto/stock/prediction)

Updates automatically. Navigate to /feed for the full stream.`,
  },
  {
    id: "og-images",
    title: "OG IMAGES & SHARING",
    content: `Every page on paste.markets generates a dynamic Open Graph image optimized for Twitter/X cards.

Images are generated server-side at /api/og/[...slug] using @vercel/og (Satori). They include:
  — Trader handle and stats for profile pages
  — Head-to-head comparison cards
  — Leaderboard snapshots

When you share any paste.markets URL on X, the preview card is automatically populated with live data.`,
  },
  {
    id: "api",
    title: "DATA API",
    content: `Internal API routes (not a public API):

  GET /api/leaderboard?timeframe=30d&limit=50&offset=0
  GET /api/author/[handle]
  GET /api/vs?a=[handle]&b=[handle]
  GET /api/wrapped/[handle]
  GET /api/feed?limit=20
  GET /api/trending
  GET /api/search?q=[query]
  GET /api/consensus?ticker=[ticker]
  GET /api/trade  (POST — submit URL for trade analysis)

All routes return JSON. Rate limits apply.`,
  },
  {
    id: "built-by",
    title: "BUILT BY",
    content: `paste.markets is built by @swarminged.

Data sourced from paste.trade by @frankdegods.

If you have feedback, feature requests, or want to report a data issue, reach out on X.`,
  },
];

export default function DocsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-16">
      <div className="mb-12">
        <h1 className="text-2xl font-bold text-text-primary mb-2">DOCS</h1>
        <p className="text-text-secondary text-sm">
          How paste.markets works — features, data, and methodology.
        </p>
      </div>

      {/* Table of contents */}
      <nav className="mb-12 border border-border rounded-lg p-4 bg-surface">
        <p className="text-xs uppercase tracking-widest text-text-muted mb-3">Contents</p>
        <ul className="space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-sm text-text-secondary hover:text-accent transition-colors"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sections */}
      <div className="space-y-12">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <div className="flex items-baseline gap-3 mb-4 border-b border-border pb-2">
              <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold">
                {section.title}
              </h2>
              {section.href && (
                <Link
                  href={section.href}
                  className="text-xs text-accent hover:underline"
                >
                  Open &rarr;
                </Link>
              )}
            </div>
            <pre className="text-sm text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
              {section.content}
            </pre>
          </section>
        ))}
      </div>

      <div className="mt-16 border-t border-border pt-8 text-center text-xs text-text-muted">
        <Link href="/" className="hover:text-accent transition-colors">
          &larr; Back to paste.markets
        </Link>
      </div>
    </main>
  );
}
