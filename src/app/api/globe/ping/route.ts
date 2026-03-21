import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";

const sql = neon(process.env.DATABASE_URL!);

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS visitor_pings (
  id SERIAL PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  city TEXT,
  country TEXT,
  pinged_at TIMESTAMPTZ DEFAULT NOW()
)`;

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await sql(INIT_SQL);
  tableReady = true;
}

export async function POST(request: NextRequest) {
  try {
    // Extract location from Vercel geo headers
    const lat = parseFloat(request.headers.get("x-vercel-ip-latitude") ?? "");
    const lng = parseFloat(request.headers.get("x-vercel-ip-longitude") ?? "");
    const city = request.headers.get("x-vercel-ip-city") ?? null;
    const country = request.headers.get("x-vercel-ip-country") ?? null;

    if (isNaN(lat) || isNaN(lng)) {
      // No geo data (local dev or missing headers) — skip silently
      return NextResponse.json({ ok: true, stored: false });
    }

    await ensureTable();

    await sql`
      INSERT INTO visitor_pings (lat, lng, city, country)
      VALUES (${lat}, ${lng}, ${city}, ${country})
    `;

    // Prune pings older than 10 minutes (fire and forget)
    sql`DELETE FROM visitor_pings WHERE pinged_at < NOW() - INTERVAL '10 minutes'`.catch(() => {});

    return NextResponse.json({ ok: true, stored: true, lat, lng, city, country });
  } catch (err) {
    console.error("[api/globe/ping]", err);
    return NextResponse.json({ ok: true, stored: false });
  }
}
