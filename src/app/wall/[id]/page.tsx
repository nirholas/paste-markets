import type { Metadata } from "next";
import Link from "next/link";
import { getWallPostById } from "@/lib/db";
import { notFound } from "next/navigation";
import ShareButton from "./share-button";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://paste.markets";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getWallPostById(id);
  if (!post) return {};

  const title = `@${post.author_handle} on paste.trade`;
  const description = post.content;
  const ogImage = `${BASE_URL}/api/og/quote/${encodeURIComponent(id)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function QuotePage({ params }: Props) {
  const { id } = await params;
  const post = await getWallPostById(id);
  if (!post) notFound();

  const isFeatured = post.featured === 1;

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 font-mono">
      <div className="max-w-2xl w-full">
        {/* Card */}
        <div className="bg-surface border border-border rounded-lg p-10 relative overflow-hidden">
          {/* Green accent line */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-win" />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 40px)",
            }}
          />

          {/* Quote */}
          <div className="relative mb-8">
            <span className="text-accent text-6xl font-bold leading-none block mb-2">
              &ldquo;
            </span>
            <p className="text-text-primary text-xl md:text-2xl leading-relaxed">
              {post.content}
            </p>
            <span className="text-accent text-6xl font-bold leading-none block text-right mt-2">
              &rdquo;
            </span>
          </div>

          {/* Handle */}
          <div className="flex items-center gap-4 mb-6">
            {post.author_avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={post.author_avatar_url}
                alt={post.author_handle}
                className="w-12 h-12 rounded-full border-2 border-accent"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-border border-2 border-accent flex items-center justify-center text-accent text-lg font-bold">
                {post.author_handle[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-bold text-lg">
                  {post.author_display_name ?? `@${post.author_handle}`}
                </span>
                {isFeatured && (
                  <span className="text-[10px] text-amber uppercase tracking-wider border border-amber/30 rounded px-2 py-0.5">
                    Featured
                  </span>
                )}
              </div>
              <div className="text-text-muted text-sm">
                @{post.author_handle} &middot; {formatDate(post.posted_at)}
              </div>
            </div>
          </div>

          {/* Stats */}
          {(post.likes > 0 || post.retweets > 0) && (
            <div className="flex items-center gap-4 text-text-muted text-xs mb-6">
              {post.likes > 0 && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  {post.likes.toLocaleString()}
                </span>
              )}
              {post.retweets > 0 && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                  </svg>
                  {post.retweets.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Brand bar */}
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-text-primary font-bold text-sm">
                paste.markets
              </span>
              <span className="text-text-muted text-xs">
                Real P&amp;L for Crypto Twitter
              </span>
            </div>
            <span className="text-win text-[11px] uppercase tracking-wider">
              VERIFIED
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <Link
            href="/wall"
            className="text-text-muted hover:text-accent transition text-sm"
          >
            &larr; Back to Wall
          </Link>
          <div className="flex items-center gap-3">
            <ShareButton />
            {post.tweet_url && (
              <a
                href={post.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-border hover:border-accent text-text-secondary hover:text-accent transition px-4 py-2 rounded text-sm"
              >
                View Tweet
              </a>
            )}
            <a
              href={`/api/og/quote/${encodeURIComponent(id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border hover:border-accent text-text-secondary hover:text-accent transition px-4 py-2 rounded text-sm"
            >
              View Card Image
            </a>
          </div>
        </div>

        {/* OG Image Preview */}
        <div className="mt-8 border border-border rounded-lg overflow-hidden">
          <div className="text-text-muted text-[11px] uppercase tracking-wider px-4 py-2 bg-surface border-b border-border">
            SHARE PREVIEW
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/og/quote/${encodeURIComponent(id)}`}
            alt={`Quote card for @${post.author_handle}`}
            className="w-full"
          />
        </div>
      </div>
    </main>
  );
}
