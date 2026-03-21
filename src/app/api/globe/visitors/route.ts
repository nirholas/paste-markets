import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

export interface VisitorRing {
  lat: number;
  lng: number;
  maxR: number;
  propagationSpeed: number;
  repeatPeriod: number;
  color: string;
  city: string | null;
  country: string | null;
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT lat, lng, city, country,
             EXTRACT(EPOCH FROM (NOW() - pinged_at)) AS age_seconds
      FROM visitor_pings
      WHERE pinged_at > NOW() - INTERVAL '10 minutes'
      ORDER BY pinged_at DESC
      LIMIT 200
    ` as Array<{ lat: number; lng: number; city: string | null; country: string | null; age_seconds: number }>;

    const rings: VisitorRing[] = rows.map((r) => {
      // Recent pings get brighter rings, older ones fade
      const freshness = Math.max(0, 1 - r.age_seconds / 600);
      return {
        lat: r.lat,
        lng: r.lng,
        maxR: 3 + freshness * 2, // 3-5 radius
        propagationSpeed: 2 + freshness * 2, // faster when fresh
        repeatPeriod: 1200 + (1 - freshness) * 800, // 1.2-2s cycle
        color: `rgba(59, 130, 246, ${0.3 + freshness * 0.5})`, // blue, brighter when fresh
        city: r.city,
        country: r.country,
      };
    });

    return NextResponse.json({ rings, count: rings.length }, {
      headers: { "Cache-Control": "s-maxage=3, stale-while-revalidate=2" },
    });
  } catch (err) {
    console.error("[api/globe/visitors]", err);
    return NextResponse.json({ rings: [], count: 0 });
  }
}
