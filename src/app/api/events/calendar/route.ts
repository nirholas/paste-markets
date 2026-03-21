import { NextResponse } from "next/server";
import { classifyCategory } from "@/lib/category";

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

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayDate = d.toISOString().slice(0, 10);
  const todayDate = today.toISOString().slice(0, 10);
  const tomorrowDate = tomorrow.toISOString().slice(0, 10);

  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (dayDate === todayDate) return `${label} (Today)`;
  if (dayDate === tomorrowDate) return `${label} (Tomorrow)`;
  return label;
}

export async function GET() {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      "https://paste.trade/api/trades?platform=polymarket&limit=50",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const body = await res.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    // Build calendar from expires_at dates
    const dayMap = new Map<string, CalendarEvent[]>();

    for (const raw of rawItems) {
      const expiresAt = raw["expires_at"] ?? raw["expiresAt"];
      if (!expiresAt) continue;

      const dateStr = String(expiresAt).slice(0, 10);
      const ticker = String(raw["ticker"] ?? "");
      const thesis = raw["thesis"] != null ? String(raw["thesis"]) : null;
      const marketQuestion = raw["market_question"] != null ? String(raw["market_question"]) : null;
      const instrument = raw["instrument"] != null ? String(raw["instrument"]) : null;

      const category = classifyCategory({
        platform: "polymarket",
        ticker,
        thesis,
        market_question: marketQuestion,
        instrument,
      });

      const sourceUrl = raw["source_url"] != null ? String(raw["source_url"]) : null;
      const polymarketUrl =
        sourceUrl?.includes("polymarket.com") ? sourceUrl :
        raw["polymarket_url"] != null ? String(raw["polymarket_url"]) : null;

      const event: CalendarEvent = {
        id: String(raw["id"] ?? ""),
        title: marketQuestion ?? ticker,
        category,
        current_probability: raw["current_price"] != null ? Number(raw["current_price"]) : null,
        settlement_date: dateStr,
        direction: String(raw["direction"] ?? "yes"),
        author_handle: String(raw["author_handle"] ?? ""),
        market_url: polymarketUrl,
      };

      const existing = dayMap.get(dateStr);
      if (existing) {
        // Deduplicate by title
        if (!existing.some((e) => e.title === event.title)) {
          existing.push(event);
        }
      } else {
        dayMap.set(dateStr, [event]);
      }
    }

    // Sort days chronologically, only future dates
    const today = new Date().toISOString().slice(0, 10);
    const days: CalendarDay[] = Array.from(dayMap.entries())
      .filter(([date]) => date >= today)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 30)
      .map(([date, events]) => ({
        date,
        label: formatDayLabel(date),
        events,
      }));

    return NextResponse.json(
      { days },
      { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" } },
    );
  } catch (err) {
    console.error("[api/events/calendar] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
