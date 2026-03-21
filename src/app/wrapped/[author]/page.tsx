import type { Metadata } from "next";
import { WrappedStory } from "@/components/wrapped-story";

interface PageProps {
  params: Promise<{ author: string }>;
}

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase().trim();
}

interface WrappedApiResponse {
  handle: string;
  grades: {
    overall: string;
    timing: string;
    conviction: string;
    consistency: string;
    riskManagement: string;
  };
  personality: {
    id: string;
    label: string;
    description: string;
    color: string;
  };
  highlights: {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    bestMonth: string;
    favoriteTicker: string;
    favoriteDirection: string;
    longestStreak: number;
    biggestWin: { ticker: string; pnl: number };
    biggestLoss: { ticker: string; pnl: number };
  };
  funFacts: string[];
}

async function fetchWrapped(
  handle: string,
): Promise<WrappedApiResponse | null> {
  const baseUrl =
    process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/wrapped/${handle}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as WrappedApiResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { author: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);
  const data = await fetchWrapped(handle);

  const title = data
    ? `@${handle} -- CT Wrapped: ${data.personality.label} | paste.markets`
    : `@${handle} -- CT Wrapped | paste.markets`;

  const description = data
    ? `@${handle} is a "${data.personality.label}" -- ${data.grades.overall} overall across ${data.highlights.totalTrades} trades with ${Math.round(data.highlights.winRate)}% win rate.`
    : `@${handle}'s CT Wrapped on paste.markets`;

  const baseUrl =
    process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: `${baseUrl}/api/og/wrapped/${handle}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}/api/og/wrapped/${handle}`],
    },
  };
}

function NotFound({ handle }: { handle: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-[11px] uppercase tracking-[2px] text-text-muted mb-4">
          CT Wrapped
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          @{handle}
        </h1>
        <p className="text-text-secondary mb-1">Author not found.</p>
        <p className="text-text-muted text-sm mb-8">
          We don&apos;t have enough data to generate a Wrapped for this account
          yet. Check back later.
        </p>
        <a
          href="/"
          className="inline-block border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
        >
          &larr; Back to Home
        </a>
      </div>
    </main>
  );
}

export default async function WrappedPage({
  params,
}: {
  params: Promise<{ author: string }>;
}) {
  const { author: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);

  const data = await fetchWrapped(handle);

  if (!data) {
    return <NotFound handle={handle} />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <WrappedStory data={data} />
    </main>
  );
}

