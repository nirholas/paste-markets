import type { Metadata } from "next";
import { Suspense } from "react";
import { EventsClient } from "./client";
import type { EventItem } from "@/app/api/events/route";

export const metadata: Metadata = {
  title: "Events & Predictions — paste.markets",
  description:
    "Polymarket prediction calls on sports, politics, macro events, and entertainment. Real P&L from CT callers.",
  openGraph: {
    title: "Events & Predictions — paste.markets",
    description: "Sports, politics, and macro prediction calls from CT. Real P&L data.",
    images: [{ url: "/api/og/events", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Events & Predictions — paste.markets",
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

export default async function EventsPage() {
  const initialItems = await getInitialEvents();

  return (
    <Suspense fallback={null}>
      <EventsClient initialItems={initialItems} initialCategory="all" />
    </Suspense>
  );
}
