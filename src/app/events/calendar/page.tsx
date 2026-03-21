import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Settlement Calendar -- paste.markets",
  description:
    "Upcoming Polymarket event settlements. Know when sports, politics, and crypto markets resolve.",
  openGraph: {
    title: "Settlement Calendar -- paste.markets",
    description: "Upcoming Polymarket event settlements.",
    images: [{ url: "/api/og/leaderboard", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Settlement Calendar -- paste.markets",
    images: ["/api/og/leaderboard"],
  },
};

export const dynamic = "force-dynamic";

interface CalendarEvent {
  id: string;
  title: string;
  category: string;
  current_probability: number | null;
  settlement_date: string | null;
  direction: string;
  author_handle: string;
  market_url: string | null;
}

interface CalendarDay {
  date: string;
  label: string;
  events: CalendarEvent[];
}

const CATEGORY_ICONS: Record<string, string> = {
  sports: "SPORTS",
  politics: "GOV",
  crypto: "CRYPTO",
  macro_event: "MACRO",
  entertainment: "ENT",
  prediction: "MKT",
};

export default async function CalendarPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let days: CalendarDay[] = [];

  try {
    const res = await fetch(`${baseUrl}/api/events/calendar`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      days = data.days ?? [];
    }
  } catch (err) {
    console.error("[events/calendar] Failed to fetch:", err);
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            <Link href="/" className="hover:text-accent transition-colors">paste.markets</Link>
            <span>/</span>
            <Link href="/events" className="hover:text-accent transition-colors">Events</Link>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            UPCOMING SETTLEMENTS
          </h1>
          <p className="text-text-muted text-xs mt-1">
            When Polymarket events resolve -- plan your positions
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {days.length === 0 ? (
          <div className="border border-border rounded-lg p-12 text-center">
            <p className="text-text-muted text-sm">No upcoming settlements found</p>
            <p className="text-text-muted text-xs mt-2">
              Settlement dates will appear as markets are tracked.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {days.map((day) => (
              <section key={day.date}>
                <h2 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                  <span className="text-amber font-mono">{day.label}</span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {day.events.length} market{day.events.length !== 1 ? "s" : ""}
                  </span>
                </h2>

                <div className="space-y-2">
                  {day.events.map((event) => {
                    const prob = event.current_probability;
                    const probPct = prob != null ? Math.round(prob * 100) : null;

                    return (
                      <div
                        key={event.id}
                        className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between hover:border-amber/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] uppercase tracking-widest font-mono text-text-muted shrink-0">
                            {CATEGORY_ICONS[event.category] ?? "MKT"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary font-bold truncate">
                              {event.title}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                              <Link
                                href={`/${encodeURIComponent(event.author_handle)}`}
                                className="hover:text-accent transition-colors"
                              >
                                @{event.author_handle}
                              </Link>
                              <span
                                className={`uppercase font-bold ${
                                  event.direction === "yes" ? "text-win" : "text-loss"
                                }`}
                              >
                                {event.direction}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {probPct != null && (
                            <span className="text-sm font-mono font-bold text-win">
                              {probPct}%
                            </span>
                          )}
                          {event.market_url && (
                            <a
                              href={event.market_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-accent hover:text-text-primary transition-colors font-mono"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Back link */}
        <div className="mt-8 pt-6 border-t border-border">
          <Link
            href="/events"
            className="text-xs text-text-muted hover:text-accent transition-colors font-mono"
          >
            &larr; Back to Event Markets
          </Link>
        </div>
      </div>

      <footer className="border-t border-border py-8 px-4 text-center text-xs text-text-muted mt-12">
        <p>
          paste.markets -- Settlement calendar powered by Polymarket
        </p>
      </footer>
    </main>
  );
}
