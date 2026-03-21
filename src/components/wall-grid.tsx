"use client";

import { useState, useCallback } from "react";

interface WallPost {
  id: string;
  author_handle: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  content: string;
  tweet_url: string | null;
  posted_at: string;
  likes: number;
  retweets: number;
  category: "reaction" | "testimonial" | "feature_request";
  featured: number;
}

interface WallResponse {
  posts: WallPost[];
  total: number;
  page: number;
  hasMore: boolean;
}

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "reaction", label: "Hype" },
  { key: "testimonial", label: "Testimonials" },
  { key: "feature_request", label: "Feature Requests" },
] as const;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PostCard({ post }: { post: WallPost }) {
  const isFeatured = post.featured === 1;

  return (
    <a
      href={post.tweet_url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`block bg-surface border rounded-lg p-5 transition-all duration-200 hover:scale-[1.02] wall-card-glow ${
        isFeatured
          ? "border-[#f39c12] shadow-[0_0_12px_rgba(243,156,18,0.15)]"
          : "border-border hover:border-accent"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {post.author_avatar_url ? (
          <img
            src={post.author_avatar_url}
            alt={post.author_handle}
            className="w-8 h-8 rounded-full bg-border"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-text-muted text-xs">
            {post.author_handle[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          {post.author_display_name && (
            <p className="text-text-primary text-sm font-bold truncate leading-tight">
              {post.author_display_name}
            </p>
          )}
          <p className="text-text-muted text-xs truncate">
            @{post.author_handle}
          </p>
        </div>
        {isFeatured && (
          <span className="ml-auto text-[#f39c12] text-[10px] uppercase tracking-widest font-bold">
            Featured
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-text-secondary text-sm leading-relaxed mb-3 whitespace-pre-wrap break-words">
        {post.content}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-4 text-text-muted text-xs">
        <span>{formatDate(post.posted_at)}</span>
        {post.likes > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {post.likes.toLocaleString()}
          </span>
        )}
        {post.retweets > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
            </svg>
            {post.retweets.toLocaleString()}
          </span>
        )}
        <a
          href={`/wall/${encodeURIComponent(post.id)}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto text-accent hover:text-text-primary transition text-[10px] uppercase tracking-wider"
        >
          Share Card
        </a>
      </div>
    </a>
  );
}

export function WallGrid({
  initialPosts,
  initialTotal,
  initialHasMore,
}: {
  initialPosts: WallPost[];
  initialTotal: number;
  initialHasMore: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);

  const fetchPosts = useCallback(
    async (cat: string, pg: number, append: boolean) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/wall?category=${cat}&page=${pg}&limit=20`,
        );
        const data: WallResponse = await res.json();
        setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(pg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    fetchPosts(cat, 1, false);
  };

  const handleLoadMore = () => {
    fetchPosts(category, page + 1, true);
  };

  // Distribute posts across columns for masonry
  const columnCount = 3; // CSS handles responsive via hidden columns
  const columns: WallPost[][] = Array.from({ length: columnCount }, () => []);
  posts.forEach((post, i) => {
    columns[i % columnCount]!.push(post);
  });

  return (
    <div>
      {/* Counter */}
      <div className="text-center mb-8">
        <p className="text-3xl font-bold text-text-primary">
          {total.toLocaleString()}{" "}
          <span className="text-text-muted text-lg font-normal">
            reactions and counting
          </span>
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat.key)}
            className={`px-4 py-2 rounded text-sm transition-colors border ${
              category === cat.key
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-muted hover:border-accent hover:text-text-secondary"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Masonry grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className={`flex flex-col gap-4 ${colIdx === 1 ? "" : ""} ${colIdx === 2 ? "hidden lg:flex" : ""} ${colIdx === 1 ? "hidden md:flex" : ""}`}>
            {col.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="text-center mt-10">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-6 py-3 border border-border hover:border-accent text-text-secondary hover:text-accent transition-colors rounded text-sm disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {posts.length === 0 && !loading && (
        <div className="text-center py-16 text-text-muted">
          No posts yet. Seed data with{" "}
          <code className="text-accent">npx tsx src/lib/seed-wall.ts</code>
        </div>
      )}
    </div>
  );
}
