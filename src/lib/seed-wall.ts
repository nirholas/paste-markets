/**
 * Seed wall_posts from JSON or CSV files.
 *
 * Usage:
 *   npx tsx src/lib/seed-wall.ts data/wall-posts.json
 *   npx tsx src/lib/seed-wall.ts data/wall-posts.csv
 *
 * JSON format (array):
 *   [{ "author_handle": "...", "content": "...", "tweet_url": "...", "posted_at": "...", "likes": 0, "retweets": 0 }]
 *
 * CSV columns (standard Twitter export):
 *   author_handle,author_display_name,content,tweet_url,posted_at,likes,retweets
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { upsertWallPostsBulk, type WallPost } from "./db";

interface RawPost {
  author_handle: string;
  author_display_name?: string;
  author_avatar_url?: string;
  content: string;
  tweet_url?: string;
  posted_at: string;
  likes?: number;
  retweets?: number;
  category?: string;
  featured?: number;
}

function parseCSV(raw: string): RawPost[] {
  const lines = raw.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const posts: RawPost[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]!);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]!] = values[j] ?? "";
    }

    if (!record["author_handle"] || !record["content"]) continue;

    posts.push({
      author_handle: record["author_handle"]!.replace(/^@/, ""),
      author_display_name: record["author_display_name"] || undefined,
      author_avatar_url: record["author_avatar_url"] || undefined,
      content: record["content"]!,
      tweet_url: record["tweet_url"] || undefined,
      posted_at: record["posted_at"] || new Date().toISOString(),
      likes: record["likes"] ? parseInt(record["likes"], 10) : 0,
      retweets: record["retweets"] ? parseInt(record["retweets"], 10) : 0,
      category: record["category"] || "reaction",
      featured: record["featured"] ? parseInt(record["featured"], 10) : 0,
    });
  }

  return posts;
}

/** Parse a CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseJSON(raw: string): RawPost[] {
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : [data];
  return arr.filter(
    (item: Record<string, unknown>) => item.author_handle && item.content,
  ) as RawPost[];
}

function toWallPost(raw: RawPost): Omit<WallPost, "created_at"> {
  return {
    id: randomUUID(),
    author_handle: raw.author_handle.replace(/^@/, "").toLowerCase().trim(),
    author_display_name: raw.author_display_name || null,
    author_avatar_url: raw.author_avatar_url || null,
    content: raw.content,
    tweet_url: raw.tweet_url || null,
    posted_at: raw.posted_at,
    likes: raw.likes ?? 0,
    retweets: raw.retweets ?? 0,
    category: (raw.category as WallPost["category"]) || "reaction",
    featured: raw.featured ?? 0,
  };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx src/lib/seed-wall.ts <file.json|file.csv>");
    process.exit(1);
  }

  const absPath = resolve(filePath);
  const raw = readFileSync(absPath, "utf-8");
  const isCSV = absPath.endsWith(".csv");

  const posts = isCSV ? parseCSV(raw) : parseJSON(raw);
  if (posts.length === 0) {
    console.error("No valid posts found in file.");
    process.exit(1);
  }

  const wallPosts = posts.map(toWallPost);
  await upsertWallPostsBulk(wallPosts);

  console.log(`Seeded ${wallPosts.length} wall posts.`);
}

main();
