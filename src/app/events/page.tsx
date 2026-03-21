import type { Metadata } from "next";
import { Suspense } from "react";
import { EventsClient } from "./client";
import type { EventItem } from "@/app/api/events/route";

export const metadata: Metadata = {
  title: "Event Markets — paste.markets",
  description:
    "Browse sports, politics, crypto & entertainment prediction markets from Polymarket. See who is calling what — real P&L tracked.",
  openGraph: {
    title: "Event Markets — paste.markets",
    description: "Sports betting, elections, crypto milestones — Polymarket event markets tracked by CT callers.",
    images: [{ url: "/api/og/events", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Event Markets — paste.markets",
    images: ["/api/og/events"],
  },
};

export const dynamic = "force-dynamic";

async function getInitialEvents(): Promise<EventItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/events?limit=20`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as EventItem[];
  } catch {
    return [];
  }
}

async function getTrendingEvents(): Promise<EventItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/events/trending`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as EventItem[];
  } catch {
    return [];
  }
}

export default async function EventsPage() {
  const [initialItems, trendingItems] = await Promise.all([
    getInitialEvents(),
    getTrendingEvents(),
  ]);

  return (
    <Suspense fallback={null}>
      <EventsClient
        initialItems={initialItems}
        initialCategory="all"
        trendingItems={trendingItems}
      />
    </Suspense>
  );
}
