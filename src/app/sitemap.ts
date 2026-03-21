import type { MetadataRoute } from "next";
import { getLeaderboard } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://paste.markets";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "hourly", priority: 1 },
    { url: `${base}/leaderboard`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/feed`, lastModified: new Date(), changeFrequency: "always", priority: 0.8 },
    { url: `${base}/circle`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/trade`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/vs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/wrapped`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/docs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/ticker`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
  ];

  try {
    const topTraders = await getLeaderboard("all", 100, 0);
    const authorRoutes: MetadataRoute.Sitemap = topTraders.map((trader) => ({
      url: `${base}/${trader.handle}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
    return [...staticRoutes, ...authorRoutes];
  } catch {
    return staticRoutes;
  }
}
