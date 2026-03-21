/**
 * Migration: Add lat/lng columns to the authors table for globe plotting.
 * Run once: npx tsx src/lib/migrate-geocode.ts
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding lat/lng columns to authors table...");

  try {
    await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS lat REAL`;
    console.log("  added lat column");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exists")) throw err;
  }

  try {
    await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS lng REAL`;
    console.log("  added lng column");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exists")) throw err;
  }

  console.log("Migration complete. lat/lng columns added to authors table.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
