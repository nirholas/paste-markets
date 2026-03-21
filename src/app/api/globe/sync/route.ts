/**
 * POST /api/globe/sync
 *
 * Pulls all authors from paste.trade (leaderboard + feed), checks which ones
 * we have location data for, geocodes what we can, and returns:
 *   - authors with resolved locations (plotted on globe)
 *   - authors needing X profile scrape (location unknown)
 *   - stats on the sync
 *
 * Also accepts an optional `locations` body to bulk-import scraped X locations:
 *   POST /api/globe/sync { "locations": { "handle1": "NYC", "handle2": "Dubai" } }
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { geocode, type GeoCoord } from "@/lib/geocode";
import { fetchPasteTradeLeaderboard, fetchPasteTradeFeed } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sql = neon(process.env.DATABASE_URL!);

interface SyncResult {
  total_authors: number;
  geocoded: number;
  unresolved: number;
  new_authors_added: number;
  locations_imported: number;
  resolved: Record<string, { lat: number; lng: number; label: string; location: string | null }>;
  needs_scrape: string[]; // handles where we have no location string at all
  unresolvable: Record<string, string>; // handle → location string we couldn't geocode
}

async function getAllPasteTradeAuthors(): Promise<
  Map<string, { name: string | null; avatar_url: string | null }>
> {
  const authors = new Map<string, { name: string | null; avatar_url: string | null }>();

  // 1. Pull from leaderboard (all windows)
  for (const window of ["7d", "30d", "all"] as const) {
    try {
      const lb = await fetchPasteTradeLeaderboard(window, "avg_pnl", 200);
      for (const a of lb.authors) {
        if (a.author?.handle) {
          authors.set(a.author.handle, {
            name: a.author.name ?? null,
            avatar_url: a.author.avatar_url ?? null,
          });
        }
      }
    } catch {
      // continue
    }
  }

  // 2. Pull from feed (new + top)
  for (const sort of ["new", "top"] as const) {
    try {
      const feed = await fetchPasteTradeFeed({ sort, limit: 100, window: "30d" });
      for (const item of feed.items) {
        const handle = item.author?.["handle"];
        if (handle && typeof handle === "string") {
          authors.set(handle, {
            name: (item.author?.["name"] as string) ?? null,
            avatar_url: (item.author?.["avatar_url"] as string) ?? null,
          });
        }
      }
    } catch {
      // continue
    }
  }

  return authors;
}

export async function POST(request: NextRequest) {
  try {
    // Optional: bulk import locations from request body
    let importedLocations: Record<string, string> = {};
    let locationsImported = 0;

    try {
      const body = await request.json();
      if (body?.locations && typeof body.locations === "object") {
        importedLocations = body.locations as Record<string, string>;
      }
    } catch {
      // No body or invalid JSON — that's fine
    }

    // 1. Get all authors from paste.trade
    const pasteAuthors = await getAllPasteTradeAuthors();

    // 2. Ensure all authors exist in our DB
    let newAuthorsAdded = 0;
    for (const [handle, meta] of pasteAuthors) {
      const rows = await sql`SELECT handle FROM authors WHERE handle = ${handle}`;
      if (rows.length === 0) {
        await sql`
          INSERT INTO authors (handle, display_name, avatar_url)
          VALUES (${handle}, ${meta.name}, ${meta.avatar_url})
          ON CONFLICT (handle) DO UPDATE SET
            display_name = COALESCE(EXCLUDED.display_name, authors.display_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, authors.avatar_url)
        `;
        newAuthorsAdded++;
      }
    }

    // 3. Import any provided locations
    for (const [handle, location] of Object.entries(importedLocations)) {
      if (!location || typeof location !== "string") continue;
      const coord = geocode(location);
      if (coord) {
        await sql`
          UPDATE authors SET
            location = ${location},
            lat = ${coord.lat},
            lng = ${coord.lng}
          WHERE handle = ${handle}
        `;
        locationsImported++;
      } else {
        // Store the location string even if we can't geocode it
        await sql`
          UPDATE authors SET location = ${location}
          WHERE handle = ${handle} AND (location IS NULL OR location = '')
        `;
      }
    }

    // 4. Fetch all authors from DB with their current location data
    const dbAuthors = await sql`
      SELECT handle, location, lat, lng FROM authors
      WHERE handle = ANY(${Array.from(pasteAuthors.keys())})
    ` as Array<{ handle: string; location: string | null; lat: number | null; lng: number | null }>;

    // 5. Geocode any that have location strings but no lat/lng
    const resolved: SyncResult["resolved"] = {};
    const needsScrape: string[] = [];
    const unresolvable: Record<string, string> = {};

    for (const row of dbAuthors) {
      if (row.lat != null && row.lng != null) {
        // Already geocoded
        resolved[row.handle] = {
          lat: row.lat,
          lng: row.lng,
          label: row.location ?? "Unknown",
          location: row.location,
        };
        continue;
      }

      if (row.location) {
        // Try to geocode
        const coord = geocode(row.location);
        if (coord) {
          await sql`UPDATE authors SET lat = ${coord.lat}, lng = ${coord.lng} WHERE handle = ${row.handle}`;
          resolved[row.handle] = { ...coord, location: row.location };
        } else {
          unresolvable[row.handle] = row.location;
        }
      } else {
        needsScrape.push(row.handle);
      }
    }

    const result: SyncResult = {
      total_authors: pasteAuthors.size,
      geocoded: Object.keys(resolved).length,
      unresolved: needsScrape.length + Object.keys(unresolvable).length,
      new_authors_added: newAuthorsAdded,
      locations_imported: locationsImported,
      resolved,
      needs_scrape: needsScrape,
      unresolvable,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/globe/sync] Error:", err);
    return NextResponse.json(
      { error: "Sync failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Also support GET for easy testing
export async function GET() {
  // Just return current state from DB
  try {
    const authors = await sql`
      SELECT handle, location, lat, lng FROM authors
      WHERE lat IS NOT NULL AND lng IS NOT NULL
    ` as Array<{ handle: string; location: string | null; lat: number; lng: number }>;

    const noLocation = await sql`
      SELECT handle, location FROM authors
      WHERE lat IS NULL OR lng IS NULL
    ` as Array<{ handle: string; location: string | null }>;

    return NextResponse.json({
      geocoded: authors.length,
      needs_data: noLocation.length,
      authors: authors.map((a) => ({
        handle: a.handle,
        location: a.location,
        lat: a.lat,
        lng: a.lng,
      })),
      needs_scrape: noLocation
        .filter((a) => !a.location)
        .map((a) => a.handle),
      unresolvable: Object.fromEntries(
        noLocation
          .filter((a) => a.location)
          .map((a) => [a.handle, a.location]),
      ),
    });
  } catch (err) {
    console.error("[api/globe/sync] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
