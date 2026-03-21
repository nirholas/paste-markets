import type { Metadata } from "next";
import { getWallPosts, getWallCount } from "@/lib/db";
import { WallGrid } from "@/components/wall-grid";

export const metadata: Metadata = {
  title: "The Wall — paste.markets",
  description:
    "Real reactions from CT. See what the community is saying about paste.markets — unfiltered tweets, replies, and hype.",
  openGraph: {
    title: "The Wall — paste.markets",
    description:
      "Real reactions from CT. Hundreds of traders, unfiltered.",
    images: [{ url: "/api/og/wall", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Wall — paste.markets",
    description:
      "Real reactions from CT. Hundreds of traders, unfiltered.",
    images: ["/api/og/wall"],
  },
};

export default function WallPage() {
  const posts = getWallPosts("all", 20, 0);
  const total = getWallCount("all");

  return (
    <main className="min-h-screen">
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-16">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-text-muted mb-2">
            SOCIAL PROOF
          </p>
          <h1 className="text-2xl font-bold text-text-primary">The Wall</h1>
          <p className="text-text-secondary text-sm mt-2">
            Real reactions from CT. Every tweet, reply, and quote-tweet — unfiltered.
          </p>
        </div>

        <WallGrid
          initialPosts={posts}
          initialTotal={total}
          initialHasMore={posts.length < total}
        />
      </section>
    </main>
  );
}
